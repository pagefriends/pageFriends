-- =============================================================================
-- 무료 베타 (config/beta.ts · lib/beta.ts)
-- 적용: 0013 다음에 실행.
--
-- 2026-11-23 사업자등록 전이라 결제를 받을 수 없어서, 가입한 사람에게 정해진 플랜을 몇 달 동안 무료로 연다 (AI 비용은 운영자가 낸다).
--   beta             지금 구독이 무료 베타인지. 결제로 플랜을 시작하면 false 로 바뀐다 (lib/payments.ts)
--   beta_started_at  무료 베타를 받은 시각. 지우지 않는다 — 한 사람당 한 번, 선착순 자리 수를 센다
-- 무료 베타 구독은 해지 예약(cancel_at_period_end) 상태로 만들어 기간이 끝나면 저절로 만료된다 (자동 결제 없음).
-- =============================================================================

alter table public.subscriptions
  add column if not exists beta boolean not null default false,
  add column if not exists beta_started_at timestamptz;

create index if not exists subscriptions_beta_started_idx on public.subscriptions (beta_started_at) where beta_started_at is not null;
