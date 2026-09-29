-- =============================================================================
-- 관리자(운영자/전문가) 역할 + 요청 처리 권한
-- 적용 후 관리자 지정:  update public.profiles set role = 'admin' where email = '<이메일>';
-- =============================================================================

alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- 현재 사용자가 관리자인지. RLS 정책 안에서 쓰므로 security definer + stable.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;
grant execute on function public.is_admin() to authenticated;

-- 관리자는 모든 사용자 데이터를 읽을 수 있다 (쓰기는 아래 RPC 로만)
create policy "profiles: admin select" on public.profiles for select using (public.is_admin());
create policy "subscriptions: admin select" on public.subscriptions for select using (public.is_admin());
create policy "projects: admin select" on public.projects for select using (public.is_admin());
create policy "project_pages: admin select" on public.project_pages for select using (public.is_admin());
create policy "change_requests: admin select" on public.change_requests for select using (public.is_admin());
create policy "payments: admin select" on public.payments for select using (public.is_admin());

-- 요청 상태 변경 + 답변. done/rejected 로 바꾸면 resolved_at 을 찍고, 다시 pending/processing 이면 비운다.
create or replace function public.admin_update_request(
  p_request_id uuid,
  p_status public.request_status,
  p_note text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.change_requests
  set status = p_status,
      resolution_note = nullif(left(coalesce(p_note, ''), 2000), ''),
      resolved_at = case when p_status in ('done', 'rejected') then now() else null end
  where id = p_request_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
end $$;
grant execute on function public.admin_update_request(uuid, public.request_status, text) to authenticated;

-- 묶음(batch) 단위 상태 일괄 변경 (답변은 건드리지 않는다)
create or replace function public.admin_update_batch(p_batch_id uuid, p_status public.request_status)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.change_requests
  set status = p_status,
      resolved_at = case when p_status in ('done', 'rejected') then now() else null end
  where batch_id = p_batch_id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.admin_update_batch(uuid, public.request_status) to authenticated;

-- 프로젝트 상태 변경 (제작 중 → 운영 중 등)
create or replace function public.admin_update_project_status(p_project_id uuid, p_status public.project_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.projects set status = p_status, updated_at = now() where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
end $$;
grant execute on function public.admin_update_project_status(uuid, public.project_status) to authenticated;
