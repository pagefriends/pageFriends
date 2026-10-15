-- =============================================================================
-- 사용자 ↔ 관리자 대화
-- 적용: 0005 다음에 실행. 여러 번 실행해도 된다.
--
-- 바뀌는 것
-- 1) messages 테이블. 한 행 = 글 하나 또는 상태 변경 기록 하나.
--    · request_id 가 있으면 그 요청(네모)의 대화, null 이면 사이트 전체에 대한 메시지.
--    · 관리자가 상태를 바꾸면 status 에 새 상태가 남는다 (사용자에게 "상태 변경" 으로 보인다).
--    · read_at = 상대편이 읽은 시각. 사용자 글은 관리자가, 관리자 글은 사용자가 읽으면 찍힌다.
-- 2) change_requests.awaiting_user. 관리자가 질문했고 사용자의 답을 기다리는 중 ("확인 필요").
--    작업 상태(status)와 따로 둔다 — 상태는 "일이 어디까지 갔나", 이 값은 "누구 차례인가".
-- 3) 예전 답변(resolution_note)은 대화의 첫 관리자 글로 옮긴다. 컬럼은 남겨 두고 마지막 관리자 글로 계속 채운다.
--
-- 쓰기는 전부 아래 함수로만 한다 (insert/update 정책 없음). 읽기는 소유자와 관리자만.
-- =============================================================================

-- 엉뚱한 곳에서 실행했을 때 바로 알 수 있게 먼저 확인한다 (아무것도 바꾸지 않고 멈춘다).
do $$
begin
  if to_regclass('public.change_requests') is null or to_regprocedure('public.is_admin()') is null then
    raise exception '이 데이터베이스에는 페이지프렌즈 테이블이 없습니다. 다른 Supabase 프로젝트에서 실행했거나 0001~0005 를 아직 실행하지 않았습니다.';
  end if;
end $$;

alter table public.change_requests add column if not exists awaiting_user boolean not null default false;
create index if not exists change_requests_awaiting_idx on public.change_requests (project_id) where awaiting_user;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  request_id uuid references public.change_requests (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_role text not null check (author_role in ('user', 'admin')),
  body text,
  status public.request_status,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_empty check (body is not null or status is not null),
  -- 상태 변경 기록은 관리자만, 요청 대화에서만 남긴다
  constraint messages_status_by_admin check (status is null or (author_role = 'admin' and request_id is not null))
);
create index if not exists messages_request_idx on public.messages (request_id, created_at);
create index if not exists messages_project_idx on public.messages (project_id, created_at);
create index if not exists messages_unread_idx on public.messages (author_role, project_id) where read_at is null;
create index if not exists messages_author_idx on public.messages (author_id, created_at);

alter table public.messages enable row level security;
drop policy if exists "messages: own select" on public.messages;
create policy "messages: own select" on public.messages for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
drop policy if exists "messages: admin select" on public.messages;
create policy "messages: admin select" on public.messages for select using (public.is_admin());

-- 예전 답변을 대화로 옮긴다. 이미 본 답변일 수 있으므로 읽음으로 넣는다 (알림이 한꺼번에 뜨지 않게).
insert into public.messages (project_id, request_id, author_role, body, created_at, read_at)
select cr.project_id, cr.id, 'admin', cr.resolution_note, coalesce(cr.resolved_at, cr.created_at), now()
from public.change_requests cr
where cr.resolution_note is not null
  and not exists (select 1 from public.messages m where m.request_id = cr.id and m.author_role = 'admin' and m.body is not null);

-- =============================================================================
-- 사용자(사이트 소유자)
-- =============================================================================

-- 글 쓰기. p_request_id 가 null 이면 사이트 전체에 대한 메시지.
-- 요청 대화에 답하면 "확인 필요" 가 풀린다. 토큰·횟수는 차감하지 않는다.
create or replace function public.post_message(p_project_id uuid, p_request_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if v_user is null then raise exception 'UNAUTHENTICATED'; end if;
  if v_body is null then raise exception 'EMPTY_MESSAGE'; end if;
  if not exists (select 1 from public.projects where id = p_project_id and user_id = v_user) then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if p_request_id is not null and not exists (select 1 from public.change_requests where id = p_request_id and project_id = p_project_id) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  -- 도배 방지: 1분에 20개까지
  if (select count(*) from public.messages where author_id = v_user and author_role = 'user' and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'TOO_MANY_MESSAGES';
  end if;

  insert into public.messages (project_id, request_id, author_id, author_role, body)
  values (p_project_id, p_request_id, v_user, 'user', left(v_body, 2000))
  returning id into v_id;

  if p_request_id is not null then
    update public.change_requests set awaiting_user = false where id = p_request_id and awaiting_user;
  end if;
  return v_id;
end $$;

-- 관리자 글을 읽음으로 표시. 화면에 실제로 보여준 글의 id 만 넘긴다 (그 사이 새로 온 글이 읽음 처리되지 않게).
create or replace function public.mark_messages_read(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.messages m
  set read_at = now()
  where m.id = any(p_ids)
    and m.read_at is null
    and m.author_role = 'admin'
    and exists (select 1 from public.projects p where p.id = m.project_id and p.user_id = auth.uid());
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 내 사이트별 알림 수. 세 값은 서로 겹치지 않는다 (더하면 "확인할 것" 의 개수).
--   awaiting        내 답을 기다리는 요청 수 ("확인 필요")
--   unread_requests 담당자의 새 글·상태 변경이 있는 요청 수 (awaiting 에 든 요청은 뺀다)
--   unread_general  안 읽은 사이트 메시지 수
create or replace function public.my_message_summary()
returns table (project_id uuid, unread_requests integer, unread_general integer, awaiting integer)
language sql stable security definer set search_path = public as $$
  select p.id,
    (select count(distinct m.request_id) from public.messages m
      join public.change_requests cr on cr.id = m.request_id
      where m.project_id = p.id and m.author_role = 'admin' and m.read_at is null
        and not (cr.awaiting_user and cr.status in ('pending', 'processing')))::integer,
    (select count(*) from public.messages m
      where m.project_id = p.id and m.author_role = 'admin' and m.read_at is null and m.request_id is null)::integer,
    (select count(*) from public.change_requests cr
      where cr.project_id = p.id and cr.awaiting_user and cr.status in ('pending', 'processing'))::integer
  from public.projects p
  where p.user_id = auth.uid()
$$;

-- =============================================================================
-- 관리자
-- =============================================================================

-- 요청 1건: 상태 변경 + 사용자에게 보낼 글 + "확인 필요" 표시. 바뀐 것이 있을 때만 대화에 기록을 남긴다.
-- p_awaiting_user 는 접수·처리중일 때만 의미가 있다 (완료·반영 불가면 항상 꺼진다).
create or replace function public.admin_reply_request(
  p_request_id uuid,
  p_status public.request_status,
  p_body text,
  p_awaiting_user boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_project uuid;
  v_old public.request_status;
  v_old_await boolean;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_await boolean := coalesce(p_awaiting_user, false) and p_status in ('pending', 'processing');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select cr.project_id, cr.status, cr.awaiting_user into v_project, v_old, v_old_await
  from public.change_requests cr where cr.id = p_request_id for update;
  if v_project is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- 질문 없이 "확인 필요" 만 켜면 사용자가 무엇을 답해야 할지 모른다
  if v_await and not v_old_await and v_body is null then raise exception 'MESSAGE_REQUIRED'; end if;

  update public.change_requests
  set status = p_status,
      awaiting_user = v_await,
      resolution_note = coalesce(left(v_body, 2000), resolution_note),
      resolved_at = case
        when p_status in ('done', 'rejected') then (case when v_old = p_status then coalesce(resolved_at, now()) else now() end)
        else null
      end
  where id = p_request_id;

  if v_body is not null or v_old is distinct from p_status then
    insert into public.messages (project_id, request_id, author_id, author_role, body, status)
    values (v_project, p_request_id, auth.uid(), 'admin', left(v_body, 2000), case when v_old is distinct from p_status then p_status end);
  end if;
end $$;

-- 묶음(batch) 전체 상태 변경. 실제로 상태가 바뀌는 요청에만 기록을 남긴다 (사용자에게 "상태 변경" 알림).
create or replace function public.admin_update_batch(p_batch_id uuid, p_status public.request_status)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.messages (project_id, request_id, author_id, author_role, status)
  select cr.project_id, cr.id, auth.uid(), 'admin', p_status
  from public.change_requests cr
  where cr.batch_id = p_batch_id and cr.status is distinct from p_status;

  update public.change_requests
  set status = p_status,
      awaiting_user = awaiting_user and p_status in ('pending', 'processing'),
      resolved_at = case when p_status in ('done', 'rejected') then now() else null end
  where batch_id = p_batch_id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 사이트 전체에 대한 메시지 (네모와 상관없는 안내·질문)
create or replace function public.admin_post_message(p_project_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_body is null then raise exception 'EMPTY_MESSAGE'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then raise exception 'PROJECT_NOT_FOUND'; end if;
  insert into public.messages (project_id, author_id, author_role, body)
  values (p_project_id, auth.uid(), 'admin', left(v_body, 2000))
  returning id into v_id;
  return v_id;
end $$;

-- 사용자 글을 읽음으로 표시 (관리자 누구든 읽으면 팀 전체가 읽은 것으로 본다)
create or replace function public.admin_mark_messages_read(p_ids uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.messages set read_at = now() where id = any(p_ids) and read_at is null and author_role = 'user';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

drop function if exists public.admin_message_summary();
-- 관리자 상단 배지
--   todo            지금 손댈 요청 수: 접수·처리중이고 사용자 답을 기다리지 않는 것 + 사용자가 새 답글을 단 것
--   unread_requests 그중 사용자의 새 답글이 있는 요청 수
--   unread_general  새 메시지가 온 사이트 수
create or replace function public.admin_message_summary()
returns table (todo integer, unread_requests integer, unread_general integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query select
    (select count(*) from public.change_requests cr
      where (cr.status in ('pending', 'processing') and not cr.awaiting_user)
         or exists (select 1 from public.messages m where m.request_id = cr.id and m.author_role = 'user' and m.read_at is null))::integer,
    (select count(distinct m.request_id) from public.messages m where m.author_role = 'user' and m.read_at is null and m.request_id is not null)::integer,
    (select count(distinct m.project_id) from public.messages m where m.author_role = 'user' and m.read_at is null and m.request_id is null)::integer;
end $$;

revoke all on function public.post_message(uuid, uuid, text) from public, anon;
revoke all on function public.mark_messages_read(uuid[]) from public, anon;
revoke all on function public.my_message_summary() from public, anon;
revoke all on function public.admin_reply_request(uuid, public.request_status, text, boolean) from public, anon;
revoke all on function public.admin_post_message(uuid, text) from public, anon;
revoke all on function public.admin_mark_messages_read(uuid[]) from public, anon;
revoke all on function public.admin_message_summary() from public, anon;
grant execute on function public.post_message(uuid, uuid, text) to authenticated;
grant execute on function public.mark_messages_read(uuid[]) to authenticated;
grant execute on function public.my_message_summary() to authenticated;
grant execute on function public.admin_reply_request(uuid, public.request_status, text, boolean) to authenticated;
grant execute on function public.admin_update_batch(uuid, public.request_status) to authenticated;
grant execute on function public.admin_post_message(uuid, text) to authenticated;
grant execute on function public.admin_mark_messages_read(uuid[]) to authenticated;
grant execute on function public.admin_message_summary() to authenticated;

-- 새 테이블·함수를 API 가 바로 알아보게 한다 (Supabase 는 보통 자동으로 하지만 확실히 해 둔다)
notify pgrst, 'reload schema';
