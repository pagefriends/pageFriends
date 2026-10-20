-- =============================================================================
-- AI 엔진 1단계: 실행 기록 · 요청(네모)별 옵션 · AI 반영 함수
-- 적용: 0007 다음에 실행. 여러 번 실행해도 된다.
--
-- 바뀌는 것
-- 1) ai_runs — AI 실행 한 번 = 한 행. 지시서 버전 · 입력 요약 · AI 출력 · 실제 반영한 변경 · 토큰 · 비용 · 담당자 평가.
--    자체 모델을 학습시킬 때 쓰는 데이터다 (학습 데이터는 이 표에서만 가져온다 — brief 는 사이트 주인이 고칠 수 있다).
--    읽기는 관리자만, 쓰기는 서버(service role)만.
-- 2) change_requests.options — 네모마다 고른 디자인 유형 · 참고 템플릿 ({"styles":[...], "templateId": "..."}).
--    submit_change_requests 가 저장하고, 참고 템플릿은 구매한 것만 받는다.
-- 3) messages.via = 'ai' — AI 가 쓴 글 (화면에 "AI" 로 표시. AI 가 만든 답이라는 것을 알린다).
-- 4) ai_apply_design — 디자인 문서 · 페이지 캡처 · 네모 위치를 한 트랜잭션으로 바꾼다 (버전이 다르면 거절).
-- 5) ai_finish_request — 요청 상태 + 대화 글 + 사용 토큰 + 사이트 상태(수정 반영 중 → 제작 완료)를 한 번에.
-- 4 · 5 는 service role 만 부를 수 있다.
-- =============================================================================

do $$
begin
  if to_regclass('public.change_requests') is null or to_regclass('public.messages') is null or to_regclass('public.releases') is null then
    raise exception '이 데이터베이스에는 페이지프렌즈 테이블이 없습니다. 다른 Supabase 프로젝트에서 실행했거나 0001~0007 을 아직 실행하지 않았습니다.';
  end if;
end $$;

-- ----- 1) 실행 기록 -----
create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- 사이트 주인 (하루 한도 · 학습 데이터 동의 확인)
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid references public.change_requests (id) on delete set null,
  task text not null check (task in ('build', 'edit')),
  -- running 처리 중 · applied 반영 · asked 사용자에게 질문 · handoff 담당자에게 넘김 · error 실패 · refused 안전 거절 · skipped 건너뜀
  status text not null default 'running' check (status in ('running', 'applied', 'asked', 'handoff', 'error', 'refused', 'skipped')),
  model text,
  prompt_version text not null,
  effort text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  applied jsonb,
  usage jsonb,
  tokens_billed integer not null default 0 check (tokens_billed >= 0),
  cost_usd numeric(12, 6) not null default 0,
  duration_ms integer,
  design_version_before integer,
  design_version_after integer,
  error text,
  -- 담당자 평가: good 잘함 · bad 잘못함 · fixed 담당자가 고쳐서 마무리 (학습 데이터의 정답 · 오답 표시)
  review text check (review in ('good', 'bad', 'fixed')),
  review_note text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_runs_project_idx on public.ai_runs (project_id, created_at desc);
create index if not exists ai_runs_request_idx on public.ai_runs (request_id, created_at desc);
create index if not exists ai_runs_user_idx on public.ai_runs (user_id, created_at desc);
create index if not exists ai_runs_day_idx on public.ai_runs (created_at desc);
create index if not exists ai_runs_running_idx on public.ai_runs (created_at) where status = 'running';

alter table public.ai_runs enable row level security;
drop policy if exists "ai_runs: admin select" on public.ai_runs;
create policy "ai_runs: admin select" on public.ai_runs for select using (public.is_admin());

-- 담당자 평가 (학습 데이터 표시). 관리자만
create or replace function public.admin_review_ai_run(p_run_id uuid, p_review text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_review is not null and p_review not in ('good', 'bad', 'fixed') then raise exception 'INVALID_REVIEW'; end if;
  update public.ai_runs set review = p_review, review_note = nullif(left(btrim(coalesce(p_note, '')), 1000), '') where id = p_run_id;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
end $$;

-- ----- 2) 네모별 옵션 -----
alter table public.change_requests add column if not exists options jsonb not null default '{}'::jsonb;

-- ----- 3) AI 가 쓴 글 표시 -----
alter table public.messages add column if not exists via text;
do $$
begin
  alter table public.messages add constraint messages_via_check check (via is null or via in ('ai'));
exception when duplicate_object then null;
end $$;

-- ----- 수정 요청 묶음 제출 (0004 와 같고, 네모별 options 를 저장한다) -----
-- p_items: [{"page_id","device","kind","seq","region":{x,y,w,h},"message","options":{"styles":[...],"templateId":"..."}}]
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

-- ----- 4) 디자인 문서 · 캡처 · 네모 위치를 한 번에 -----
-- p_design:  새 디자인 문서 (brief.design 자리만 바꾼다 — brief 의 다른 칸은 그대로)
-- p_pages:   [{"id": 페이지 id, "screenshots": {...}}]  디자인이 바뀌어 다시 그린 캡처 (크기 · 이미지 자리 · 주소의 v)
-- p_regions: [{"id": 요청 id, "region": {...}}]          캡처 높이가 바뀌어 옮긴 네모 위치
-- 지금 버전이 p_expected_version 이 아니면 VERSION_CONFLICT — 그 사이 다른 수정이 먼저 반영된 것이다.
create or replace function public.ai_apply_design(p_project_id uuid, p_expected_version integer, p_design jsonb, p_pages jsonb, p_regions jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_current integer;
begin
  if auth.role() <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select coalesce((brief->'design'->>'version')::integer, 0) into v_current from public.projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if v_current <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if jsonb_typeof(p_design) <> 'object' or (p_design->>'version')::integer <= v_current then raise exception 'INVALID_DESIGN'; end if;

  update public.projects set brief = jsonb_set(brief, '{design}', p_design, true), updated_at = now() where id = p_project_id;

  update public.project_pages pp set screenshots = x.screenshots
  from jsonb_to_recordset(coalesce(p_pages, '[]'::jsonb)) as x(id uuid, screenshots jsonb)
  where pp.id = x.id and pp.project_id = p_project_id;

  update public.change_requests cr set region = x.region
  from jsonb_to_recordset(coalesce(p_regions, '[]'::jsonb)) as x(id uuid, region jsonb)
  where cr.id = x.id and cr.project_id = p_project_id;

  return (p_design->>'version')::integer;
end $$;

-- ----- 5) AI 처리 마무리 -----
-- 요청 상태를 바꾸고(반영 완료 · 확인 필요 · 담당자에게 넘김), 대화에 AI 글을 남기고, 사용 토큰을 기록한다.
-- p_tokens 는 이 요청의 누적 토큰(record_ai_usage 와 같다). 0 이면 기록하지 않는다.
-- 열린 요청이 하나도 남지 않으면 "수정 반영 중" 사이트를 "제작 완료" 로 돌린다 (관리자 화면의 syncProjectAfterRequests 와 같다).
create or replace function public.ai_finish_request(
  p_request_id uuid,
  p_status public.request_status,
  p_body text,
  p_awaiting_user boolean,
  p_tokens integer,
  p_monthly_ai_tokens integer
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_old public.request_status;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_await boolean := coalesce(p_awaiting_user, false) and p_status in ('pending', 'processing');
begin
  if auth.role() <> 'service_role' then raise exception 'FORBIDDEN'; end if;
  select cr.project_id, cr.status into v_project, v_old from public.change_requests cr where cr.id = p_request_id for update;
  if v_project is null then raise exception 'REQUEST_NOT_FOUND'; end if;

  update public.change_requests
  set status = p_status,
      awaiting_user = v_await,
      resolution_note = coalesce(left(v_body, 2000), resolution_note),
      resolved_at = case when p_status in ('done', 'rejected') then now() else null end
  where id = p_request_id;

  -- 끝났을 때(반영 완료 · 반영 불가)만 상태 변경 기록을 남긴다. AI 진행 중 ↔ 접수는 사용자에게 같은 "AI 진행 중" 이라 기록하지 않는다
  if v_body is not null or (v_old is distinct from p_status and p_status in ('done', 'rejected')) then
    insert into public.messages (project_id, request_id, author_id, author_role, body, status, via)
    values (v_project, p_request_id, null, 'admin', left(v_body, 2000), case when v_old is distinct from p_status and p_status in ('done', 'rejected') then p_status end, 'ai');
  end if;

  if coalesce(p_tokens, 0) > 0 then
    perform public.record_ai_usage(p_request_id, p_tokens, p_monthly_ai_tokens);
  end if;

  if not exists (select 1 from public.change_requests where project_id = v_project and status in ('pending', 'processing')) then
    update public.projects set status = 'live', updated_at = now() where id = v_project and status = 'review';
  end if;
end $$;

revoke all on function public.admin_review_ai_run(uuid, text, text) from public, anon;
grant execute on function public.admin_review_ai_run(uuid, text, text) to authenticated;
revoke all on function public.ai_apply_design(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ai_apply_design(uuid, integer, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.ai_finish_request(uuid, public.request_status, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_finish_request(uuid, public.request_status, text, boolean, integer, integer) to service_role;
