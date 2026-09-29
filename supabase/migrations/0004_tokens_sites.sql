-- =============================================================================
-- AI 토큰제 · 오류 신고(무차감) · 사용 토큰 기록
-- 적용: 0003 다음에 실행.
--
-- 바뀌는 것
-- 1) request_kind 에 'bug'(오류 신고) 추가. 오류 신고는 한도·크레딧 어디에서도 차감하지 않는다.
-- 2) AI 반영은 "주 N회" 가 아니라 월 토큰 한도. 제출 시점에는 토큰을 모르므로 남은 토큰이 0 이면 막기만 하고,
--    처리 시점에 record_ai_usage() 로 실제 사용 토큰을 기록하면서 한도 초과분을 토큰 크레딧에서 차감한다.
-- 3) credits.kind='ai' 의 balance 는 이제 "토큰 수". 기존 "회" 잔액은 1회 ≈ 10,000 토큰으로 환산한다.
-- 4) 사이트(프로젝트) 수 제한은 앱(createProjectAction)이 플랜 상수로 검사한다. DB 는 플랜 상수를 모른다.
--
-- 주의: enum 값 추가는 같은 트랜잭션 안에서 "값으로 사용" 할 수 없다. 이 파일은 'bug' 를 함수 본문(plpgsql, 실행 시
-- 해석) 에서만 쓰므로 한 번에 실행해도 된다.
-- =============================================================================

alter type public.request_kind add value if not exists 'bug';

-- 처리 시 기록되는 실제 사용 토큰 (AI 반영만 의미 있음)
alter table public.change_requests add column if not exists tokens_used integer not null default 0 check (tokens_used >= 0);

-- 기존 AI 크레딧 "회" → 토큰 환산
update public.credits set balance = balance * 10000 where kind = 'ai' and balance > 0 and balance < 1000;

-- ----- 이번 결제 기간의 AI 토큰 사용량 -----
-- 기간 = 구독의 current_period_start~end. 구독이 없으면 이번 달(1일~).
create or replace function public.ai_token_usage(p_user_id uuid)
returns table (period_start timestamptz, period_end timestamptz, used bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  select s.current_period_start, s.current_period_end into v_start, v_end
  from public.subscriptions s where s.user_id = p_user_id;
  if v_start is null then
    v_start := date_trunc('month', now());
    v_end := v_start + interval '1 month';
  end if;
  return query
    select v_start, v_end, coalesce(sum(cr.tokens_used), 0)::bigint
    from public.change_requests cr
    join public.projects p on p.id = cr.project_id
    where p.user_id = p_user_id
      and cr.kind = 'ai'
      and cr.created_at >= v_start and cr.created_at < v_end;
end $$;
grant execute on function public.ai_token_usage(uuid) to authenticated;

-- ----- 수정 요청 묶음 제출 (토큰제) -----
-- 파라미터 이름이 바뀌므로 기존 함수를 지우고 다시 만든다.
drop function if exists public.submit_change_requests(uuid, jsonb, integer, integer);

-- p_items: [{"page_id","device","kind":"ai"|"expert"|"bug","seq","region":{x,y,w,h},"message"}]
-- p_monthly_ai_tokens: 플랜의 월 AI 토큰 한도 (null = 무제한)
-- p_weekly_expert:     플랜의 주간 전문가 요청 한도 (null = 무제한)
create or replace function public.submit_change_requests(
  p_project_id uuid,
  p_items jsonb,
  p_monthly_ai_tokens integer,
  p_weekly_expert integer
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

  -- 크레딧 행 잠금 후 잔액 확인
  select coalesce((select balance from public.credits where user_id = v_user and kind = 'ai' for update), 0) into v_credit_ai;
  select coalesce((select balance from public.credits where user_id = v_user and kind = 'expert' for update), 0) into v_credit_expert;

  -- AI: 남은 토큰(한도 - 사용 + 크레딧)이 0 이면 새 요청 불가. 실제 차감은 처리 시 record_ai_usage 가 한다.
  if v_need_ai > 0 and p_monthly_ai_tokens is not null then
    select coalesce(max(u.used), 0) into v_used_tokens from public.ai_token_usage(v_user) u;
    if (p_monthly_ai_tokens - v_used_tokens + v_credit_ai) <= 0 then
      raise exception 'AI_TOKENS_EXHAUSTED';
    end if;
  end if;

  -- 전문가: 주간 횟수 한도 초과분을 크레딧에서 즉시 차감
  if v_need_expert > 0 then
    select coalesce(max(used), 0) into v_used_expert from public.weekly_request_usage(v_user) where kind = 'expert';
    v_over_expert := case when p_weekly_expert is null then 0 else greatest(0, v_used_expert + v_need_expert - p_weekly_expert) end;
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
    insert into public.change_requests (project_id, page_id, batch_id, device, kind, seq, region, message)
    values (
      p_project_id,
      (v_item->>'page_id')::uuid,
      v_batch,
      (v_item->>'device')::public.device_kind,
      v_kind::public.request_kind,
      coalesce((v_item->>'seq')::integer, 1),
      v_item->'region',
      left(coalesce(v_item->>'message', ''), 2000)
    );
  end loop;

  update public.projects set status = 'review', updated_at = now() where id = p_project_id and status = 'live';
  return v_batch;
end $$;
grant execute on function public.submit_change_requests(uuid, jsonb, integer, integer) to authenticated;

-- ----- 실제 사용 토큰 기록 + 한도 초과분 크레딧 차감 -----
-- 관리자(전문가 화면) 또는 service role(AI 파이프라인)만 호출. 같은 요청에 다시 기록하면 차이만큼만 정산한다.
-- p_monthly_ai_tokens: 요청 소유자의 플랜 월 한도 (null = 무제한 → 크레딧 차감 없음)
create or replace function public.record_ai_usage(p_request_id uuid, p_tokens integer, p_monthly_ai_tokens integer)
returns table (tokens_used integer, period_used bigint, credits_deducted integer)
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_kind public.request_kind;
  v_prev integer;
  v_used_before bigint;
  v_used_after bigint;
  v_over_before bigint;
  v_over_after bigint;
  v_delta bigint;
  v_credit integer;
  v_deduct integer := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then raise exception 'FORBIDDEN'; end if;
  if p_tokens < 0 then raise exception 'INVALID_TOKENS'; end if;

  select p.user_id, cr.kind, cr.tokens_used into v_owner, v_kind, v_prev
  from public.change_requests cr join public.projects p on p.id = cr.project_id
  where cr.id = p_request_id for update of cr;
  if v_owner is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- 오류 신고·전문가 요청은 토큰을 쓰지 않는다
  if v_kind <> 'ai' then raise exception 'NOT_AI_REQUEST'; end if;

  select coalesce(max(u.used), 0) into v_used_before from public.ai_token_usage(v_owner) u;
  update public.change_requests set tokens_used = p_tokens where id = p_request_id;
  v_used_after := v_used_before - v_prev + p_tokens;

  if p_monthly_ai_tokens is not null then
    v_over_before := greatest(0, v_used_before - p_monthly_ai_tokens);
    v_over_after := greatest(0, v_used_after - p_monthly_ai_tokens);
    v_delta := v_over_after - v_over_before;
    if v_delta > 0 then
      -- 한도 초과분을 크레딧에서 차감. 잔액이 부족하면 0 까지만 깎는다 (음수 금지) — 초과 사용은 다음 제출을 막는 것으로 처리.
      select coalesce((select balance from public.credits where user_id = v_owner and kind = 'ai' for update), 0) into v_credit;
      v_deduct := least(v_credit, v_delta)::integer;
      if v_deduct > 0 then
        update public.credits set balance = balance - v_deduct where user_id = v_owner and kind = 'ai';
      end if;
    elsif v_delta < 0 then
      -- 토큰을 줄여 다시 기록한 경우: 초과분이 줄어든 만큼 환급
      v_deduct := v_delta::integer;
      insert into public.credits (user_id, kind, balance) values (v_owner, 'ai', -v_deduct)
      on conflict (user_id, kind) do update set balance = public.credits.balance - v_deduct;
    end if;
  end if;

  return query select p_tokens, v_used_after, v_deduct;
end $$;
grant execute on function public.record_ai_usage(uuid, integer, integer) to authenticated;
