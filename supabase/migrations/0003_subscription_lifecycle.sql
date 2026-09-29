-- =============================================================================
-- 구독 수명주기: 해지 예약, 자동 갱신 추적, 갱신 실패 재시도
-- =============================================================================

alter table public.subscriptions
  -- 해지: 즉시 끊지 않고 현재 결제 기간이 끝날 때까지 유지한다
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  -- 다음 갱신 결제: 우리가 미리 정한 paymentId (웹훅에서 구독을 찾는 키) + 포트원 예약 id (해지 시 취소용)
  add column if not exists next_payment_id text unique,
  add column if not exists portone_schedule_id text,
  add column if not exists next_payment_at timestamptz,
  -- 갱신 실패 추적
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_failure_reason text;

create index if not exists subscriptions_next_payment_idx on public.subscriptions (next_payment_id);

-- activate_subscription 갱신: 새 구독/플랜 변경 시 해지 예약·실패 카운터를 초기화하고 예약 정보를 함께 저장
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
    cancel_at_period_end = false,
    cancelled_at = null,
    failed_attempts = 0,
    last_failure_at = null,
    last_failure_reason = null,
    next_payment_id = null,
    portone_schedule_id = null,
    next_payment_at = null,
    updated_at = now()
$$;
