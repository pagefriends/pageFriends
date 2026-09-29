-- =============================================================================
-- 페이지프렌즈 초기 스키마
-- 적용: Supabase 대시보드 SQL Editor 에 붙여넣어 실행하거나 `supabase db push`.
-- 원칙: 모든 사용자 테이블은 RLS 로 보호하고, 결제·크레딧처럼 사용자가 직접 써서는 안 되는 값은
--       SECURITY DEFINER 함수 또는 service role 로만 변경한다.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----- enum -----
create type public.plan_code as enum ('starter', 'business', 'pro', 'enterprise');
create type public.subscription_status as enum ('active', 'past_due', 'cancelled');
create type public.device_kind as enum ('mobile', 'tablet', 'desktop');
create type public.request_kind as enum ('ai', 'expert');
create type public.request_status as enum ('pending', 'processing', 'done', 'rejected');
create type public.project_status as enum ('brief', 'building', 'review', 'live');
create type public.template_kind as enum ('demo', 'live');
create type public.payment_kind as enum ('subscription', 'template', 'credits');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled');

-- ----- profiles -----
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: own select" on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- 가입 시 프로필 자동 생성 (auth.users 트리거)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----- subscriptions (사용자당 1행) -----
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan_code public.plan_code not null,
  status public.subscription_status not null default 'active',
  -- 비즈니스 플랜 결제 시스템 옵션 (첫 달 289,000원)
  payment_addon boolean not null default false,
  -- 포트원 빌링키 (AES-256-GCM 암호화, lib/crypto.ts). 브라우저에 절대 내려주지 않는다.
  billing_key_enc text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '1 month',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
-- 왜 select 만 허용하나: 플랜 변경은 결제 확정(서비스 롤)으로만 일어나야 한다.
create policy "subscriptions: own select" on public.subscriptions for select using (auth.uid() = user_id);

-- ----- templates (공개 카탈로그) -----
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  kind public.template_kind not null,
  category text not null,
  description text not null default '',
  price_krw integer not null check (price_krw >= 0),
  thumbnail_url text not null,
  preview_urls jsonb not null default '[]'::jsonb,
  pages jsonb not null default '[]'::jsonb,
  -- live 템플릿은 실제 운영 사이트 소유자의 동의가 있어야만 노출한다.
  owner_consent boolean not null default false,
  owner_site_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint live_requires_consent check (kind = 'demo' or owner_consent = true)
);
alter table public.templates enable row level security;
create policy "templates: public read" on public.templates for select using (is_published = true);

create table public.template_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete restrict,
  payment_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, template_id)
);
alter table public.template_purchases enable row level security;
create policy "template_purchases: own select" on public.template_purchases for select using (auth.uid() = user_id);

-- ----- projects / pages -----
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  template_id uuid references public.templates (id) on delete set null,
  brief jsonb not null default '{}'::jsonb,
  status public.project_status not null default 'brief',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "projects: own all" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index projects_user_idx on public.projects (user_id, created_at desc);

create table public.project_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  path text not null,
  sort_order integer not null default 0,
  -- {"mobile": {"url","width","height"}, "tablet": {...}, "desktop": {...}} — 캡처 원본 픽셀 크기를 함께 저장해
  -- 네모 영역(0~1 정규화)을 화면 좌표로 되돌릴 수 있게 한다.
  screenshots jsonb not null default '{}'::jsonb,
  unique (project_id, path)
);
alter table public.project_pages enable row level security;
create policy "project_pages: via project" on public.project_pages for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- ----- change_requests (네모 영역 1개 = 1행, 한 번에 요청한 묶음 = batch_id) -----
create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  page_id uuid not null references public.project_pages (id) on delete cascade,
  batch_id uuid not null,
  device public.device_kind not null,
  kind public.request_kind not null default 'ai',
  status public.request_status not null default 'pending',
  seq integer not null default 1,
  region jsonb not null,
  message text not null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.change_requests enable row level security;
-- 왜 insert 정책이 없나: 삽입은 주간 한도·크레딧 차감을 원자적으로 처리하는 submit_change_requests() 로만 한다.
create policy "change_requests: own select" on public.change_requests for select
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create index change_requests_project_idx on public.change_requests (project_id, created_at desc);
create index change_requests_page_device_idx on public.change_requests (page_id, device, status);

-- ----- credits (추가 요청 크레딧, 만료 없음) -----
create table public.credits (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.request_kind not null,
  balance integer not null default 0 check (balance >= 0),
  primary key (user_id, kind)
);
alter table public.credits enable row level security;
create policy "credits: own select" on public.credits for select using (auth.uid() = user_id);

-- ----- payments -----
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  portone_payment_id text not null unique,
  kind public.payment_kind not null,
  status public.payment_status not null default 'pending',
  amount_krw integer not null check (amount_krw >= 0),
  order_name text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.payments enable row level security;
create policy "payments: own select" on public.payments for select using (auth.uid() = user_id);

-- =============================================================================
-- 함수
-- =============================================================================

-- 이번 주(월요일 시작) 사용량. 주간 한도 계산에 쓴다.
create or replace function public.weekly_request_usage(p_user_id uuid)
returns table (kind public.request_kind, used bigint)
language sql stable security definer set search_path = public as $$
  select cr.kind, count(*)
  from public.change_requests cr
  join public.projects p on p.id = cr.project_id
  where p.user_id = p_user_id
    and cr.created_at >= date_trunc('week', now())
    and cr.status <> 'rejected'
  group by cr.kind
$$;

-- 수정 요청 묶음 제출. 주간 한도(플랜 상수는 앱이 넘긴다)를 넘는 분량은 크레딧에서 차감하고, 그마저 부족하면 실패한다.
-- 한 트랜잭션에서 처리해 한도 초과·이중 차감을 막는다.
-- p_items: [{"page_id","device","kind","seq","region":{x,y,w,h},"message"}]
create or replace function public.submit_change_requests(
  p_project_id uuid,
  p_items jsonb,
  p_weekly_ai integer,      -- null = 무제한
  p_weekly_expert integer   -- null = 무제한
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_batch uuid := gen_random_uuid();
  v_need_ai integer;
  v_need_expert integer;
  v_used_ai integer := 0;
  v_used_expert integer := 0;
  v_over_ai integer;
  v_over_expert integer;
  v_credit_ai integer;
  v_credit_expert integer;
  v_item jsonb;
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

  select coalesce(max(used) filter (where kind = 'ai'), 0), coalesce(max(used) filter (where kind = 'expert'), 0)
    into v_used_ai, v_used_expert
  from public.weekly_request_usage(v_user);

  -- 한도 초과분 계산 (무제한이면 0)
  v_over_ai := case when p_weekly_ai is null then 0 else greatest(0, v_used_ai + v_need_ai - p_weekly_ai) end;
  v_over_expert := case when p_weekly_expert is null then 0 else greatest(0, v_used_expert + v_need_expert - p_weekly_expert) end;

  -- 크레딧 행 잠금 후 잔액 확인
  select coalesce((select balance from public.credits where user_id = v_user and kind = 'ai' for update), 0) into v_credit_ai;
  select coalesce((select balance from public.credits where user_id = v_user and kind = 'expert' for update), 0) into v_credit_expert;

  if v_over_ai > v_credit_ai then
    raise exception 'QUOTA_EXCEEDED_AI:%', v_over_ai - v_credit_ai;
  end if;
  if v_over_expert > v_credit_expert then
    raise exception 'QUOTA_EXCEEDED_EXPERT:%', v_over_expert - v_credit_expert;
  end if;

  if v_over_ai > 0 then
    update public.credits set balance = balance - v_over_ai where user_id = v_user and kind = 'ai';
  end if;
  if v_over_expert > 0 then
    update public.credits set balance = balance - v_over_expert where user_id = v_user and kind = 'expert';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.project_pages where id = (v_item->>'page_id')::uuid and project_id = p_project_id) then
      raise exception 'PAGE_NOT_IN_PROJECT';
    end if;
    insert into public.change_requests (project_id, page_id, batch_id, device, kind, seq, region, message)
    values (
      p_project_id,
      (v_item->>'page_id')::uuid,
      v_batch,
      (v_item->>'device')::public.device_kind,
      coalesce((v_item->>'kind')::public.request_kind, 'ai'),
      coalesce((v_item->>'seq')::integer, 1),
      v_item->'region',
      left(coalesce(v_item->>'message', ''), 2000)
    );
  end loop;

  update public.projects set status = 'review', updated_at = now() where id = p_project_id and status = 'live';
  return v_batch;
end $$;

-- 크레딧 지급 (결제 확정 후 service role 이 호출). upsert.
create or replace function public.grant_credits(p_user_id uuid, p_kind public.request_kind, p_count integer)
returns void language sql security definer set search_path = public as $$
  insert into public.credits (user_id, kind, balance) values (p_user_id, p_kind, p_count)
  on conflict (user_id, kind) do update set balance = public.credits.balance + excluded.balance
$$;

-- 구독 활성화/갱신 (결제 확정 후 service role 이 호출)
create or replace function public.activate_subscription(
  p_user_id uuid, p_plan public.plan_code, p_payment_addon boolean, p_billing_key_enc text
)
returns void language sql security definer set search_path = public as $$
  insert into public.subscriptions (user_id, plan_code, status, payment_addon, billing_key_enc, current_period_start, current_period_end, updated_at)
  values (p_user_id, p_plan, 'active', p_payment_addon, p_billing_key_enc, now(), now() + interval '1 month', now())
  on conflict (user_id) do update set
    plan_code = excluded.plan_code,
    status = 'active',
    payment_addon = excluded.payment_addon,
    billing_key_enc = coalesce(excluded.billing_key_enc, public.subscriptions.billing_key_enc),
    current_period_start = now(),
    current_period_end = now() + interval '1 month',
    updated_at = now()
$$;

-- 서비스 롤 외에는 위 함수를 호출하지 못하게 (submit_change_requests / weekly_request_usage 만 사용자 허용)
revoke all on function public.grant_credits(uuid, public.request_kind, integer) from public, anon, authenticated;
revoke all on function public.activate_subscription(uuid, public.plan_code, boolean, text) from public, anon, authenticated;
grant execute on function public.submit_change_requests(uuid, jsonb, integer, integer) to authenticated;
grant execute on function public.weekly_request_usage(uuid) to authenticated;
