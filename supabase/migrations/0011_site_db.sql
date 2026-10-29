-- =============================================================================
-- 사이트 전용 Supabase 프로젝트 · 관리자 목록 (lib/site-db, lib/collections.ts)
-- 적용: 0010 다음에 실행.
--
-- 고객이 사이트를 만들면 그 사이트만 쓰는 Supabase 프로젝트를 관리 API 로 만든다 (플랜의 siteDatabase).
-- AI 가 "관리자 목록"(공지 · 메뉴 · 상품 …)을 만들면 그 프로젝트에 표가 생기고, 사이트 주인은 관리자 페이지에서 글을 올리고 고친다.
--
-- site_databases  사이트마다 프로젝트 하나. 상태 · ref · 지역 · 키(비밀 키 · DB 비밀번호는 앱이 암호화) · 만든 표와 칸(schema).
--                 사이트(projects) 행이 지워져도 이 행은 남긴다 (project_id 만 비운다) — 지울 프로젝트를 담당자가 찾을 수 있게.
-- site_db_changes 사이트 DB 에 실행한 SQL 기록 (AI · 담당자 · 시스템, 성공 · 실패).
--
-- 쓰기는 서버(service role)만 한다. 읽기는 관리자만 — 사이트 주인에게는 서버가 상태만 보여 준다 (키가 브라우저로 가지 않게).
-- =============================================================================

create table if not exists public.site_databases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique references public.projects (id) on delete set null,
  -- 만들 때의 사이트 이름 · 프로젝트 이름 (사이트가 지워진 뒤에도 무엇이었는지 알 수 있게)
  project_name text,
  status text not null default 'creating' check (status in ('creating', 'provisioning', 'ready', 'failed', 'deleted')),
  ref text unique,
  region text,
  api_url text,
  publishable_key text,
  secret_key_enc text,
  db_pass_enc text,
  -- 만든 표 · 칸과 종류 {"notices": {"title": "text", ...}} — 늘어나기만 한다
  schema jsonb not null default '{}'::jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz
);
alter table public.site_databases enable row level security;
drop policy if exists "site_databases: admin select" on public.site_databases;
create policy "site_databases: admin select" on public.site_databases for select using (public.is_admin());
create index if not exists site_databases_status_idx on public.site_databases (status, updated_at desc);

create table if not exists public.site_db_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  site_database_id uuid references public.site_databases (id) on delete cascade,
  source text not null check (source in ('ai', 'admin', 'system')),
  request_id uuid references public.change_requests (id) on delete set null,
  ai_run_id uuid references public.ai_runs (id) on delete set null,
  statements text not null,
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);
alter table public.site_db_changes enable row level security;
drop policy if exists "site_db_changes: admin select" on public.site_db_changes;
create policy "site_db_changes: admin select" on public.site_db_changes for select using (public.is_admin());
create index if not exists site_db_changes_project_idx on public.site_db_changes (project_id, created_at desc);
