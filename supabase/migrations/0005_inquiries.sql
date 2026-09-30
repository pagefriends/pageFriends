-- =============================================================================
-- 문의 · 뉴스레터 · 전문가 지원 접수
-- 적용: 0004 다음에 실행.
-- 공개 사이트의 폼(상담 신청, 뉴스레터 구독, 전문가 지원)은 로그인 없이 보내므로 사용자 RLS 정책을 두지 않고
-- 서버 액션이 service role 로만 삽입한다. 조회는 관리자(admin select 정책)만.
-- =============================================================================

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('consultation', 'newsletter', 'application', 'contact')),
  name text,
  email text not null,
  phone text,
  company text,
  message text,
  -- 폼별 추가 항목 (원하는 사이트 종류, 예산, 포트폴리오 URL 등)
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
create policy "inquiries: admin select" on public.inquiries for select using (public.is_admin());
create index if not exists inquiries_kind_created_idx on public.inquiries (kind, created_at desc);

-- 뉴스레터는 이메일당 1건
create unique index if not exists inquiries_newsletter_email_idx on public.inquiries (lower(email)) where kind = 'newsletter';

-- 관리자 상태 변경
create or replace function public.admin_update_inquiry(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('new', 'contacted', 'closed') then raise exception 'INVALID_STATUS'; end if;
  update public.inquiries set status = p_status where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
grant execute on function public.admin_update_inquiry(uuid, text) to authenticated;
