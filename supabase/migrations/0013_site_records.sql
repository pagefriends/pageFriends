-- =============================================================================
-- 공용 DB: 관리자 목록의 글 (lib/site-data.ts, lib/collections.ts)
-- 적용: 0012 다음에 실행.
--
-- 2026-11-11 사이트마다 Supabase 프로젝트를 만들던 방식(0011)을 그만두고, 모든 사이트의 목록 글을 이 표 하나에 사이트별로 저장한다.
--   · 목록 정의(공지 · 메뉴 · 상품 · 강의 …의 칸 이름과 종류)는 그대로 디자인 문서(projects.brief.design.collections)에 있다.
--   · 글 한 줄 = 이 표 한 행. 칸 값은 data(JSON)에 { "칸 키": 값 } 으로 넣는다 → 업종마다 칸이 달라도 표를 새로 만들 필요가 없다.
--   · AI 가 목록을 만들어도 SQL 을 실행하지 않는다 (디자인 문서만 바뀐다). 관리 API 토큰 · 프로젝트 비용 · 1~3분 대기가 없다.
--
-- 다른 사이트의 글은 볼 수 없다:
--   · 읽기: 사이트 주인(projects.user_id)과 관리자만 (RLS). 로그인하지 않은 사람(anon)은 읽을 수 없다
--     — 고객 사이트를 공개할 때는 서버가 공개된 글(published)만 골라 읽는다.
--   · 쓰기: 서버(service role)만. 서버 액션이 사이트 주인 · 플랜(관리자 페이지)을 확인한 뒤 project_id 로 범위를 묶어 쓴다.
-- 사이트를 지우면 그 사이트의 글도 함께 지워진다 (on delete cascade).
--
-- 0011 의 site_databases · site_db_changes 표는 더 쓰지 않는다 (예전 기록이라 남겨 둔다).
-- =============================================================================

create table if not exists public.site_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- 목록 키 (디자인 문서 collections[].key — 영어 소문자 · 숫자 · 밑줄)
  collection text not null check (collection ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- 칸 값 { "title": "…", "price": 12000, … }. 칸을 목록에서 빼도 값은 남는다 (다시 넣으면 보인다)
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536),
  -- 공개 여부 (false 면 사이트에 보이지 않고 관리자 페이지에만 보인다)
  published boolean not null default true,
  -- 순서 (작을수록 앞, 같으면 최근 글이 앞)
  sort integer not null default 0 check (sort between -100000 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_records enable row level security;

drop policy if exists "site_records: owner select" on public.site_records;
create policy "site_records: owner select" on public.site_records for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists "site_records: admin select" on public.site_records;
create policy "site_records: admin select" on public.site_records for select using (public.is_admin());

-- 목록 한 쪽 (사이트 · 목록 → 순서 → 최근 순)
create index if not exists site_records_list_idx on public.site_records (project_id, collection, sort, created_at desc);
