-- =============================================================================
-- 요금제 개편: 월간 · 연간 결제 + 한도를 "매달" 다시 채우기 + 전문가 요청 월 한도
-- 적용: 0008 다음에 Supabase SQL Editor 에서 한 번 실행. 여러 번 실행해도 된다.
--
-- 바뀌는 것
-- 1) subscriptions.billing_cycle ('month' | 'year'). 금액은 앱(config/plans.ts)이 정한다 — 연간 = 월 요금 × 10.
-- 2) 예약 변경(pending_plan_code · pending_billing_cycle): 아래 플랜으로 내리기 · 연간 → 월간은
--    지금 기간이 끝나는 날(다음 결제)에 적용한다. 올리기는 앱이 남은 기간을 빼고 바로 결제한다.
-- 3) 사용 기간(usage_window) = 결제 기간 시작일부터 한 달씩 센 "지금이 속한 달".
--    월간 결제면 결제 기간과 같고, 연간 결제면 1년 안에서 매달 새로 시작한다. 구독이 없으면 이번 달 1일부터.
--    토큰(ai_token_usage)과 요청 횟수(request_usage)가 같은 기간을 쓴다.
-- 4) 전문가 요청 한도: 주간 → 월간. submit_change_requests 의 p_weekly_expert → p_monthly_expert.
-- =============================================================================

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'month',
  add column if not exists pending_plan_code public.plan_code,
  add column if not exists pending_billing_cycle text;

do $$ begin
  alter table public.subscriptions add constraint subscriptions_billing_cycle_check check (billing_cycle in ('month', 'year'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.subscriptions add constraint subscriptions_pending_cycle_check
    check (pending_billing_cycle is null or pending_billing_cycle in ('month', 'year'));
exception when duplicate_object then null; end $$;

-- ----- 구독 활성화: 결제 주기 추가 (인자가 늘어서 지우고 다시 만든다) -----
drop function if exists public.activate_subscription(uuid, public.plan_code, boolean, text);
drop function if exists public.activate_subscription(uuid, public.plan_code, boolean, text, text);

create or replace function public.activate_subscription(
  p_user_id uuid, p_plan public.plan_code, p_payment_addon boolean, p_billing_key_enc text, p_billing_cycle text default 'month'
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_len interval;
begin
  if p_billing_cycle is null or p_billing_cycle not in ('month', 'year') then raise exception 'INVALID_CYCLE'; end if;
  v_len := case when p_billing_cycle = 'year' then interval '1 year' else interval '1 month' end;

  insert into public.subscriptions (user_id, plan_code, status, payment_addon, billing_key_enc, billing_cycle, current_period_start, current_period_end, updated_at)
  values (p_user_id, p_plan, 'active', p_payment_addon, p_billing_key_enc, p_billing_cycle, now(), now() + v_len, now())
  on conflict (user_id) do update set
    plan_code = excluded.plan_code,
    status = 'active',
    payment_addon = excluded.payment_addon,
    billing_key_enc = coalesce(excluded.billing_key_enc, public.subscriptions.billing_key_enc),
    billing_cycle = excluded.billing_cycle,
    pending_plan_code = null,
    pending_billing_cycle = null,
    current_period_start = now(),
    current_period_end = now() + v_len,
    cancel_at_period_end = false,
    cancelled_at = null,
    failed_attempts = 0,
    last_failure_at = null,
    last_failure_reason = null,
    next_payment_id = null,
    portone_schedule_id = null,
    next_payment_at = null,
    updated_at = now();
end $$;

-- 결제 확정 뒤 service role 만 부른다
revoke all on function public.activate_subscription(uuid, public.plan_code, boolean, text, text) from public, anon, authenticated;

-- ----- 이번 사용 기간 -----
-- 본인 · 관리자 · service role 만 (다른 사람의 구독 기간을 보지 못하게)
create or replace function public.usage_window(p_user_id uuid)
returns table (window_start timestamptz, window_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_ps timestamptz;
  v_age interval;
  v_n integer;
begin
  if auth.uid() is distinct from p_user_id and not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;

  select s.current_period_start into v_ps from public.subscriptions s where s.user_id = p_user_id;
  if v_ps is null then
    return query select date_trunc('month', now()), date_trunc('month', now()) + interval '1 month';
    return;
  end if;

  v_age := age(now(), v_ps);
  v_n := greatest(0, (extract(year from v_age) * 12 + extract(month from v_age))::integer);
  -- 말일 보정(1/31 + 한 달 = 2/28 같은 경우)으로 한 칸 어긋나면 맞춘다
  if v_n > 0 and v_ps + make_interval(months => v_n) > now() then v_n := v_n - 1; end if;
  if v_ps + make_interval(months => v_n + 1) <= now() then v_n := v_n + 1; end if;

  return query select v_ps + make_interval(months => v_n), v_ps + make_interval(months => v_n + 1);
end $$;
grant execute on function public.usage_window(uuid) to authenticated;

-- ----- 이번 사용 기간의 AI 토큰 사용량 (기간 계산만 usage_window 로 바뀜, 반환 형식은 그대로) -----
create or replace function public.ai_token_usage(p_user_id uuid)
returns table (period_start timestamptz, period_end timestamptz, used bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  select w.window_start, w.window_end into v_start, v_end from public.usage_window(p_user_id) w;
  return query
    select v_start, v_end, coalesce(sum(cr.tokens_used), 0)::bigint
    from public.change_requests cr
    join public.projects p on p.id = cr.project_id
    where p.user_id = p_user_id
      and cr.kind = 'ai'
      and cr.created_at >= v_start and cr.created_at < v_end;
end $$;
grant execute on function public.ai_token_usage(uuid) to authenticated;

-- ----- 이번 사용 기간의 요청 수 (종류별, 반려 제외) — 예전 weekly_request_usage 를 대신한다 -----
create or replace function public.request_usage(p_user_id uuid)
returns table (kind public.request_kind, used bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  select w.window_start, w.window_end into v_start, v_end from public.usage_window(p_user_id) w;
  return query
    select cr.kind, count(*)::bigint
    from public.change_requests cr
    join public.projects p on p.id = cr.project_id
    where p.user_id = p_user_id
      and cr.created_at >= v_start and cr.created_at < v_end
      and cr.status <> 'rejected'
    group by cr.kind;
end $$;
grant execute on function public.request_usage(uuid) to authenticated;

-- ----- 수정 요청 묶음 제출 (0008 과 같고, 전문가 한도만 월간) -----
-- 인자 이름이 바뀌므로 지우고 다시 만든다.
drop function if exists public.submit_change_requests(uuid, jsonb, integer, integer);

-- p_items: [{"page_id","device","kind","seq","region":{x,y,w,h},"message","options":{"styles":[...],"templateId":"..."}}]
-- p_monthly_ai_tokens: 플랜의 월 AI 토큰 한도 (null = 무제한)
-- p_monthly_expert:    플랜의 월 전문가 요청 한도 (null = 무제한)
create or replace function public.submit_change_requests(
  p_project_id uuid,
  p_items jsonb,
  p_monthly_ai_tokens integer,
  p_monthly_expert integer
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_need_ai integer;
  v_need_expert integer;
  v_used_tokens bigint := 0;
  v_used_expert integer := 0;
  v_over_expert integer;
  v_credit_ai integer;
  v_credit_expert integer;
  v_item jsonb;
  v_kind text;
  v_options jsonb;
  v_tpl text;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.projects where id = p_project_id and user_id = v_user) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ITEMS';
  end if;

  select count(*) filter (where i->>'kind' = 'ai'), count(*) filter (where i->>'kind' = 'expert')
    into v_need_ai, v_need_expert
  from jsonb_array_elements(p_items) i;

  select coalesce((select balance from public.credits where user_id = v_user and kind = 'ai' for update), 0) into v_credit_ai;
  select coalesce((select balance from public.credits where user_id = v_user and kind = 'expert' for update), 0) into v_credit_expert;

  if v_need_ai > 0 and p_monthly_ai_tokens is not null then
    select coalesce(max(u.used), 0) into v_used_tokens from public.ai_token_usage(v_user) u;
    if (p_monthly_ai_tokens - v_used_tokens + v_credit_ai) <= 0 then
      raise exception 'AI_TOKENS_EXHAUSTED';
    end if;
  end if;

  -- 전문가: 이번 달(사용 기간) 한도를 넘는 만큼 크레딧에서 바로 차감
  if v_need_expert > 0 then
    select coalesce(max(u.used), 0) into v_used_expert from public.request_usage(v_user) u where u.kind = 'expert';
    v_over_expert := case when p_monthly_expert is null then 0 else greatest(0, v_used_expert + v_need_expert - p_monthly_expert) end;
    if v_over_expert > v_credit_expert then
      raise exception 'QUOTA_EXCEEDED_EXPERT:%', v_over_expert - v_credit_expert;
    end if;
    if v_over_expert > 0 then
      update public.credits set balance = balance - v_over_expert where user_id = v_user and kind = 'expert';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.project_pages where id = (v_item->>'page_id')::uuid and project_id = p_project_id) then
      raise exception 'PAGE_NOT_IN_PROJECT';
    end if;
    v_kind := coalesce(v_item->>'kind', 'ai');
    if v_kind not in ('ai', 'expert', 'bug') then raise exception 'INVALID_KIND'; end if;
    v_options := case when jsonb_typeof(v_item->'options') = 'object' then v_item->'options' else '{}'::jsonb end;
    if length(v_options::text) > 2000 then raise exception 'OPTIONS_TOO_LARGE'; end if;
    v_tpl := nullif(v_options->>'templateId', '');
    if v_tpl is not null and not exists (select 1 from public.template_purchases where user_id = v_user and template_id::text = v_tpl) then
      raise exception 'TEMPLATE_NOT_PURCHASED';
    end if;
    insert into public.change_requests (project_id, page_id, batch_id, device, kind, seq, region, message, options)
    values (
      p_project_id,
      (v_item->>'page_id')::uuid,
      v_batch,
      (v_item->>'device')::public.device_kind,
      v_kind::public.request_kind,
      coalesce((v_item->>'seq')::integer, 1),
      v_item->'region',
      left(coalesce(v_item->>'message', ''), 2000),
      v_options
    );
  end loop;

  update public.projects set status = 'review', updated_at = now() where id = p_project_id and status = 'live';
  return v_batch;
end $$;
grant execute on function public.submit_change_requests(uuid, jsonb, integer, integer) to authenticated;
