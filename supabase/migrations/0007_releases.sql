-- =============================================================================
-- 웹사이트 적용 (개발 서버 → 운영)
-- 적용: 0006 다음에 실행. 여러 번 실행해도 된다.
--
-- 사용자는 "배포" 대신 "웹사이트에 적용" 이라는 말을 쓴다. 흐름:
--   사용자  끝난 수정을 "웹사이트에 적용 요청" (request_release). 한 사이트에 진행 중인 적용은 하나뿐이다.
--   관리자  ① 개발 서버에 배포하고 주소를 기록한다 (admin_release_staging)
--           ② 개발 서버에서 확인 목록을 하나씩 체크한다 (admin_release_check · admin_release_db_change)
--              문제가 있으면 다시 고치기로 돌린다 (admin_release_issue) → ① 부터 다시
--           ③ 확인을 모두 마친 뒤에만 운영에 배포한다 (admin_release_live)
--              개발 서버를 거치지 않았거나 확인이 남았으면 DB 가 거절한다 — 화면을 건너뛰어도 운영으로 바로 갈 수 없다.
--
-- 바뀌는 것
-- 1) releases 테이블. 한 행 = 사이트 하나의 n번째 웹사이트 적용.
-- 2) change_requests.release_id = 그 수정이 실린 적용. status = 'done' 인데 release_id 가 null 이면 "적용 대기".
--    적용 전에 수정이 다시 열리면 그 적용에서 빠지고, 이미 적용된 수정을 다시 고쳐 끝내면 다음 적용으로 넘어간다 (트리거).
-- 3) 단계가 바뀌면 사이트 메시지로 사용자에게 알린다 (점검 시작 · 적용 완료 · 취소).
--
-- 확인 목록 키 (config/releases.ts 와 같아야 한다)
--   site      개발 서버에서 사이트가 열리고 모든 페이지로 이동된다
--   req:<id>  이 적용에 실린 수정마다 "요청대로 바뀌었다"
--   screens   화면 크기별로 깨지는 곳이 없다
--   db_dev    (폼·DB 변경일 때) 개발 DB 에 새 항목을 넣고 폼을 보내 저장까지 확인했다
--   db_prod   (폼·DB 변경일 때) 운영 DB 에 같은 변경을 먼저 반영했다
-- =============================================================================

-- 엉뚱한 곳에서 실행했을 때 바로 알 수 있게 먼저 확인한다 (아무것도 바꾸지 않고 멈춘다).
do $$
begin
  if to_regclass('public.change_requests') is null or to_regclass('public.messages') is null then
    raise exception '이 데이터베이스에는 페이지프렌즈 테이블이 없습니다. 다른 Supabase 프로젝트에서 실행했거나 0001~0006 을 아직 실행하지 않았습니다.';
  end if;
end $$;

do $$
begin
  create type public.release_status as enum ('requested', 'staging', 'live', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- 사이트별 n번째 적용
  seq integer not null,
  status public.release_status not null default 'requested',
  -- 처음 적용 = 사이트 전체를 처음 공개
  first_publish boolean not null default false,
  -- 사용자가 남긴 말
  note text,
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  -- ① 개발 서버. 문제로 다시 올리면 staging_rounds 가 늘어난다
  staging_url text,
  staging_at timestamptz,
  staging_rounds integer not null default 0,
  -- ② 개발 서버 확인 목록 {"site": true, "req:<id>": true, ...}
  checks jsonb not null default '{}'::jsonb,
  -- 폼·DB 구조 변경 포함 (예: 문의하기에 받을 항목 추가). 켜면 개발 DB · 운영 DB 확인이 더해진다
  db_change boolean not null default false,
  -- 개발 서버에서 찾은 문제 (마지막 것)
  issue_note text,
  -- ③ 운영
  production_url text,
  live_at timestamptz,
  cancelled_at timestamptz,
  cancel_note text,
  updated_at timestamptz not null default now(),
  unique (project_id, seq)
);
-- 사이트마다 진행 중인 적용은 하나
create unique index if not exists releases_one_active_idx on public.releases (project_id) where status in ('requested', 'staging');
create index if not exists releases_status_idx on public.releases (status, requested_at desc);

alter table public.releases enable row level security;
drop policy if exists "releases: own select" on public.releases;
create policy "releases: own select" on public.releases for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "releases: admin select" on public.releases;
create policy "releases: admin select" on public.releases for select using (public.is_admin());

alter table public.change_requests add column if not exists release_id uuid references public.releases (id) on delete set null;
create index if not exists change_requests_release_idx on public.change_requests (release_id) where release_id is not null;
create index if not exists change_requests_waiting_idx on public.change_requests (project_id) where status = 'done' and release_id is null;

-- 수정 상태가 바뀌면 적용 묶음을 맞춘다.
--   아직 적용 전인 묶음에서 수정이 다시 열리면(진행 중 · 반영 불가) 묶음에서 뺀다 → 다시 끝나면 다음 개발 서버 배포 때 들어간다.
--   이미 웹사이트에 적용된 수정을 다시 고쳐 끝내면 다음 적용 때 다시 올라가야 한다.
create or replace function public.change_requests_release_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status public.release_status;
begin
  if new.release_id is null or new.status is not distinct from old.status then
    return new;
  end if;
  select status into v_status from public.releases where id = new.release_id;
  if new.status = 'done' and v_status = 'live' then
    new.release_id := null;
  elsif new.status <> 'done' and v_status in ('requested', 'staging') then
    new.release_id := null;
  end if;
  return new;
end $$;
drop trigger if exists change_requests_release_sync on public.change_requests;
create trigger change_requests_release_sync before update of status on public.change_requests
  for each row execute function public.change_requests_release_sync();

-- =============================================================================
-- 사용자(사이트 소유자)
-- =============================================================================

-- 웹사이트에 적용 요청. 끝난 수정(적용 대기)을 모두 싣는다. 처음 적용(공개)은 실을 수정이 없어도 된다.
create or replace function public.request_release(p_project_id uuid, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status public.project_status;
  v_first boolean;
  v_waiting integer;
  v_seq integer;
  v_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  -- 두 번 눌러도 하나만 만들어지게 사이트 행을 잠근다
  select status into v_status from public.projects where id = p_project_id and user_id = v_user for update;
  if v_status is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  -- 담당자가 "제작 완료" 를 누른 사이트만 (제작 완료 · 수정 반영 중)
  if v_status not in ('live', 'review') then raise exception 'SITE_NOT_READY'; end if;
  if exists (select 1 from public.releases where project_id = p_project_id and status in ('requested', 'staging')) then
    raise exception 'RELEASE_IN_PROGRESS';
  end if;

  v_first := not exists (select 1 from public.releases where project_id = p_project_id and status = 'live');
  select count(*) into v_waiting from public.change_requests where project_id = p_project_id and status = 'done' and release_id is null;
  if not v_first and v_waiting = 0 then raise exception 'NOTHING_TO_APPLY'; end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.releases where project_id = p_project_id;
  insert into public.releases (project_id, seq, first_publish, note, requested_by)
  values (p_project_id, v_seq, v_first, nullif(left(btrim(coalesce(p_note, '')), 1000), ''), v_user)
  returning id into v_id;

  update public.change_requests set release_id = v_id where project_id = p_project_id and status = 'done' and release_id is null;
  return v_id;
end $$;

-- 적용 요청 취소. 담당자가 개발 서버에 올리기 전에만 (그 뒤에는 메시지로 담당자에게 알린다).
create or replace function public.cancel_release(p_release_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.release_status;
  v_rounds integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select r.status, r.staging_rounds into v_status, v_rounds
  from public.releases r join public.projects p on p.id = r.project_id
  where r.id = p_release_id and p.user_id = auth.uid()
  for update of r;
  if v_status is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status <> 'requested' or v_rounds > 0 then raise exception 'CANNOT_CANCEL'; end if;

  update public.releases set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = p_release_id;
  update public.change_requests set release_id = null where release_id = p_release_id;
end $$;

-- =============================================================================
-- 관리자
-- =============================================================================

-- ① 개발 서버에 배포했다. 처음이면 사용자에게 "점검 중" 을 알린다. 다시 올리면 확인 목록은 처음부터 다시 한다.
create or replace function public.admin_release_staging(p_release_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_status public.release_status;
  v_rounds integer;
  v_url text := btrim(coalesce(p_url, ''));
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' or length(v_url) > 500 then raise exception 'INVALID_URL'; end if;
  select project_id, status, staging_rounds into v_project, v_status, v_rounds from public.releases where id = p_release_id for update;
  if v_project is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status not in ('requested', 'staging') then raise exception 'INVALID_STATE'; end if;

  -- 개발 서버에 올린 빌드에는 그 사이 끝난 수정도 들어 있다 — 같이 확인하도록 이 적용에 싣는다
  update public.change_requests set release_id = p_release_id
  where project_id = v_project and status = 'done' and release_id is null;

  update public.releases
  set status = 'staging', staging_url = v_url, staging_at = now(), staging_rounds = staging_rounds + 1, checks = '{}'::jsonb, updated_at = now()
  where id = p_release_id;

  if v_rounds = 0 then
    insert into public.messages (project_id, author_id, author_role, body)
    values (v_project, auth.uid(), 'admin', '웹사이트에 적용하기 전에 확인용 서버에 먼저 올려 점검하고 있어요. 점검이 끝나면 실제 웹사이트에 적용해 드릴게요.');
  end if;
end $$;

-- ② 확인 목록 한 칸 체크/해제. 개발 서버에 올린 뒤에만. 바뀐 목록 전체를 돌려준다.
create or replace function public.admin_release_check(p_release_id uuid, p_key text, p_value boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status public.release_status;
  v_checks jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_key is null or p_key !~ '^(site|screens|db_dev|db_prod|req:[0-9a-f-]{36})$' then raise exception 'INVALID_KEY'; end if;
  select status into v_status from public.releases where id = p_release_id for update;
  if v_status is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status <> 'staging' then raise exception 'NOT_STAGED'; end if;

  update public.releases
  set checks = case when coalesce(p_value, false) then checks || jsonb_build_object(p_key, true) else checks - p_key end,
      updated_at = now()
  where id = p_release_id
  returning checks into v_checks;
  return v_checks;
end $$;

-- ② 폼·DB 구조 변경 포함 여부. 켜면 개발 DB · 운영 DB 확인이 확인 목록에 더해진다.
create or replace function public.admin_release_db_change(p_release_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.release_status;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select status into v_status from public.releases where id = p_release_id for update;
  if v_status is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status not in ('requested', 'staging') then raise exception 'INVALID_STATE'; end if;
  update public.releases set db_change = coalesce(p_value, false), updated_at = now() where id = p_release_id;
end $$;

-- ② 개발 서버에서 문제를 찾았다 → 다시 고치기 (개발 서버에 다시 올려야 한다). 사용자에게는 계속 "점검 중" 으로 보인다.
create or replace function public.admin_release_issue(p_release_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.release_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_note is null then raise exception 'NOTE_REQUIRED'; end if;
  select status into v_status from public.releases where id = p_release_id for update;
  if v_status is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status <> 'staging' then raise exception 'NOT_STAGED'; end if;
  update public.releases set status = 'requested', issue_note = left(v_note, 1000), checks = '{}'::jsonb, updated_at = now() where id = p_release_id;
end $$;

-- ③ 운영에 배포했다. 개발 서버에서 확인 목록을 모두 마쳤을 때만. 사용자에게 실제 웹사이트 주소와 함께 알린다.
create or replace function public.admin_release_live(p_release_id uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_r public.releases%rowtype;
  v_url text := btrim(coalesce(p_url, ''));
  v_left integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_url !~* '^https?://[^[:space:]/?#]+([/?#][^[:space:]]*)?$' or length(v_url) > 500 then raise exception 'INVALID_URL'; end if;
  select * into v_r from public.releases where id = p_release_id for update;
  if v_r.id is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  -- 개발 서버에 올려 확인하지 않은 것은 운영에 올리지 않는다
  if v_r.status <> 'staging' or v_r.staging_at is null then raise exception 'NOT_STAGED'; end if;

  select count(*) into v_left
  from (
    select 'site'::text as k
    union all select 'screens'
    union all select 'db_dev' where v_r.db_change
    union all select 'db_prod' where v_r.db_change
    union all select 'req:' || cr.id::text from public.change_requests cr where cr.release_id = p_release_id
  ) need
  where coalesce(v_r.checks ->> need.k, '') <> 'true';
  if v_left > 0 then raise exception 'CHECKS_INCOMPLETE:%', v_left; end if;

  update public.releases set status = 'live', production_url = v_url, live_at = now(), updated_at = now() where id = p_release_id;

  insert into public.messages (project_id, author_id, author_role, body)
  values (
    v_r.project_id, auth.uid(), 'admin',
    case when v_r.first_publish
      then '웹사이트를 공개했어요. 실제 웹사이트에서 확인해 보세요: ' || v_url
      else '요청하신 수정을 웹사이트에 적용했어요. 실제 웹사이트에서 확인해 보세요: ' || v_url
    end
  );
end $$;

-- 적용 취소 (운영 반영 전). 실렸던 수정은 다시 "적용 대기" 가 되고, 사용자에게 알린다.
create or replace function public.admin_release_cancel(p_release_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_status public.release_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select project_id, status into v_project, v_status from public.releases where id = p_release_id for update;
  if v_project is null then raise exception 'RELEASE_NOT_FOUND'; end if;
  if v_status not in ('requested', 'staging') then raise exception 'INVALID_STATE'; end if;

  update public.releases set status = 'cancelled', cancelled_at = now(), cancel_note = left(v_note, 1000), updated_at = now() where id = p_release_id;
  update public.change_requests set release_id = null where release_id = p_release_id;

  insert into public.messages (project_id, author_id, author_role, body)
  values (
    v_project, auth.uid(), 'admin',
    '웹사이트 적용 요청을 취소했어요.' || coalesce(' (' || left(v_note, 500) || ')', '') || ' 다시 적용하려면 웹사이트 적용 화면에서 요청해 주세요.'
  );
end $$;

revoke all on function public.change_requests_release_sync() from public, anon, authenticated;
revoke all on function public.request_release(uuid, text) from public, anon;
revoke all on function public.cancel_release(uuid) from public, anon;
revoke all on function public.admin_release_staging(uuid, text) from public, anon;
revoke all on function public.admin_release_check(uuid, text, boolean) from public, anon;
revoke all on function public.admin_release_db_change(uuid, boolean) from public, anon;
revoke all on function public.admin_release_issue(uuid, text) from public, anon;
revoke all on function public.admin_release_live(uuid, text) from public, anon;
revoke all on function public.admin_release_cancel(uuid, text) from public, anon;
grant execute on function public.request_release(uuid, text) to authenticated;
grant execute on function public.cancel_release(uuid) to authenticated;
grant execute on function public.admin_release_staging(uuid, text) to authenticated;
grant execute on function public.admin_release_check(uuid, text, boolean) to authenticated;
grant execute on function public.admin_release_db_change(uuid, boolean) to authenticated;
grant execute on function public.admin_release_issue(uuid, text) to authenticated;
grant execute on function public.admin_release_live(uuid, text) to authenticated;
grant execute on function public.admin_release_cancel(uuid, text) to authenticated;

-- 새 테이블·함수를 API 가 바로 알아보게 한다
notify pgrst, 'reload schema';
