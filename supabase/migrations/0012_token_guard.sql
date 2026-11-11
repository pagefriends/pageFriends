-- =============================================================================
-- 0012 토큰 · 요청 한도를 서버만 정하게 (2026-11-11)
-- 적용: 0011 다음에 SQL Editor 에서 실행. 실행 전에도 앱은 예전 방식으로 동작한다 (lib/submit-requests.ts 가 알아서 고른다).
--
-- 왜
--   예전 submit_change_requests 는 로그인한 사용자 누구나 PostgREST(/rest/v1/rpc)로 직접 부를 수 있었고,
--   플랜 한도(p_monthly_ai_tokens · p_monthly_expert)를 부르는 쪽이 넘겼다. 한도에 null 을 넣으면 "무제한" 으로 읽혀
--   토큰이 0 이어도 AI 요청을, 전문가 한도를 넘어도 전문가 요청을 보낼 수 있었다 (토큰은 "정해진 만큼만" 이어야 한다).
--
-- 바뀌는 것
--   1) submit_change_requests 를 service role(서버)만 부를 수 있게 하고, 사용자 id 를 인자로 받는다.
--      서버(app/(app)/projects/[id]/actions.ts · 위저드)가 로그인과 플랜을 확인한 뒤 사용자 id 와 플랜 한도를 넘긴다.
--      함수 몸통은 0009 와 같다 — auth.uid() 대신 p_user_id 를 쓰는 것과 아래 2) 만 다르다.
--   2) 남은 토큰 계산 고침: 예전에는 "한도 - 사용 + 크레딧" 이라, 한도를 넘은 사용분을 record_ai_usage 가 이미 크레딧에서 뺐는데도
--      한 번 더 빼서 크레딧이 남아 있어도 AI 요청이 막혔다 (예: 한도 30만 · 사용 41.6만 · 크레딧 8.4만 → -3.2만으로 막힘).
--      이제 "한도에서 남은 것(0 아래로 안 내려감) + 크레딧" 으로 센다 (앱의 lib/quota.ts 와 같다).
--
-- 토큰 차감 규칙(2026-11-11)은 DB 를 바꾸지 않는다: AI 엔진 · 이미지 요청 · 관리자 "반영 불가" 가
-- 이미 있는 record_ai_usage / ai_finish_request 로 요청마다 바로 기록한다 (config/plans.ts 사용량 모델).
-- =============================================================================

drop function if exists public.submit_change_requests(uuid, jsonb, integer, integer);

-- p_user_id:           요청하는 사용자 (서버가 로그인 세션에서 얻은 값)
-- p_items:             [{"page_id","device","kind","seq","region":{x,y,w,h},"message","options":{"styles":[...],"templateId":"..."}}]
-- p_monthly_ai_tokens: 플랜의 월 AI 토큰 한도 (null = 무제한)
-- p_monthly_expert:    플랜의 월 전문가 요청 한도 (null = 무제한)
create or replace function public.submit_change_requests(
  p_user_id uuid,
  p_project_id uuid,
  p_items jsonb,
  p_monthly_ai_tokens integer,
  p_monthly_expert integer
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := p_user_id;
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
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'FORBIDDEN'; end if;
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

  -- AI: 남은 토큰(한도에서 남은 것 + 크레딧)이 0 이면 새 요청 불가. 실제 차감은 처리하는 순간 record_ai_usage 가 한다
  if v_need_ai > 0 and p_monthly_ai_tokens is not null then
    select coalesce(max(u.used), 0) into v_used_tokens from public.ai_token_usage(v_user) u;
    if (greatest(0, p_monthly_ai_tokens - v_used_tokens) + v_credit_ai) <= 0 then
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

-- 서버만 (Supabase 는 public 스키마 함수에 anon · authenticated 실행 권한을 기본으로 준다 → 거둔다)
revoke all on function public.submit_change_requests(uuid, uuid, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.submit_change_requests(uuid, uuid, jsonb, integer, integer) to service_role;
