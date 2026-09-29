import "server-only";

import { randomUUID } from "node:crypto";

import { PLAN_BY_CODE, type PlanCode } from "@/config/plans";
import type { SessionUser } from "@/lib/auth/session";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { isPaymentsMock } from "@/lib/env";
import { deleteBillingKey, getBillingKey, getPayment, payWithBillingKey, revokeSchedules, scheduleNextPayment, verifyPaymentMatches } from "@/lib/portone";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/types/db";

/**
 * 구독 수명주기.
 *
 * 흐름 요약
 * - 활성화(subscribe) 직후 scheduleRenewal 로 다음 달 결제를 포트원에 예약하고 next_payment_id 를 저장한다.
 * - 예약 결제 결과는 웹훅으로 온다: Transaction.Paid → handleRenewalPaid(기간 연장 + 다음 예약),
 *   Transaction.Failed → handleRenewalFailed(past_due, 3일 뒤 재시도, 3회 실패면 해지).
 * - 해지(cancel)는 예약만 취소하고 기간 끝까지 유지한다. 해지 취소(resume)는 다시 예약한다.
 * - 결제 수단 변경(changeCard)은 빌링키를 교체하고, 미납 상태면 즉시 재결제한다.
 *
 * 크론 없이 동작하도록 만료 판정은 읽는 쪽(effectiveSubscription)에서 한다.
 */

export const MAX_RENEWAL_ATTEMPTS = 3;
export const RETRY_INTERVAL_DAYS = 3;
/** 갱신 실패 후에도 서비스를 쓸 수 있는 유예 기간 */
export const PAST_DUE_GRACE_DAYS = 7;

export class SubscriptionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export type SubscriptionState = "none" | "active" | "cancelling" | "past_due" | "expired" | "cancelled";

/** DB 행 → 지금 이 순간의 유효 상태. 플랜 사용 가능 여부(usable)도 함께. */
export function effectiveSubscription(sub: SubscriptionRow | null, now = new Date()): { state: SubscriptionState; usable: boolean; graceUntil: Date | null } {
  if (!sub) return { state: "none", usable: false, graceUntil: null };
  const periodEnd = new Date(sub.current_period_end);
  if (sub.status === "cancelled") return { state: "cancelled", usable: false, graceUntil: null };
  if (sub.status === "past_due") {
    const graceUntil = addDays(periodEnd, PAST_DUE_GRACE_DAYS);
    return { state: now < graceUntil ? "past_due" : "expired", usable: now < graceUntil, graceUntil };
  }
  // active
  if (sub.cancel_at_period_end) {
    return now < periodEnd ? { state: "cancelling", usable: true, graceUntil: null } : { state: "expired", usable: false, graceUntil: null };
  }
  // 예약 결제가 아직 안 들어온 채 기간이 지났을 수 있다(웹훅 지연) → 유예 기간만큼은 사용 가능
  const graceUntil = addDays(periodEnd, PAST_DUE_GRACE_DAYS);
  if (now >= periodEnd) return { state: now < graceUntil ? "active" : "expired", usable: now < graceUntil, graceUntil };
  return { state: "active", usable: true, graceUntil: null };
}

async function loadSubscription(userId: string): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

async function loadByNextPaymentId(paymentId: string): Promise<SubscriptionRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("*").eq("next_payment_id", paymentId).maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

function renewalAmount(sub: Pick<SubscriptionRow, "plan_code">): number {
  return PLAN_BY_CODE[sub.plan_code as PlanCode].priceKrw;
}
function renewalOrderName(sub: Pick<SubscriptionRow, "plan_code">): string {
  return `${PLAN_BY_CODE[sub.plan_code as PlanCode].name} 플랜 (월) 자동 갱신`;
}

/**
 * 다음 갱신 결제 예약. payments 행을 pending 으로 먼저 만들어 웹훅이 금액을 대조할 수 있게 한다.
 * 기존 예약이 있으면 먼저 취소한다(중복 결제 방지).
 */
export async function scheduleRenewal(sub: SubscriptionRow, at: Date): Promise<void> {
  const admin = createAdminClient();
  if (sub.portone_schedule_id && !isPaymentsMock()) {
    await revokeSchedules([sub.portone_schedule_id]).catch((e) => console.error("[subscriptions] 기존 예약 취소 실패:", e));
  }
  if (sub.next_payment_id) {
    await admin.from("payments").update({ status: "cancelled" }).eq("portone_payment_id", sub.next_payment_id).eq("status", "pending");
  }

  const paymentId = `pf_sub_${randomUUID()}`;
  const amountKrw = renewalAmount(sub);
  await admin.from("payments").insert({
    user_id: sub.user_id,
    portone_payment_id: paymentId,
    kind: "subscription",
    status: "pending",
    amount_krw: amountKrw,
    order_name: renewalOrderName(sub),
    meta: { planCode: sub.plan_code, renewal: true, scheduledAt: at.toISOString() },
  });

  let scheduleId: string | null = null;
  if (!isPaymentsMock()) {
    if (!sub.billing_key_enc) throw new SubscriptionError(400, "등록된 결제 수단이 없습니다.");
    const r = await scheduleNextPayment({
      paymentId,
      billingKey: decryptSecret(sub.billing_key_enc),
      orderName: renewalOrderName(sub),
      customerId: sub.user_id,
      amountKrw,
      timeToPay: at,
    });
    scheduleId = r.scheduleId;
  }
  await admin
    .from("subscriptions")
    .update({ next_payment_id: paymentId, portone_schedule_id: scheduleId, next_payment_at: at.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", sub.id);
}

/** 예약 취소만 (해지·플랜 변경 시) */
export async function clearRenewal(sub: SubscriptionRow): Promise<void> {
  const admin = createAdminClient();
  if (sub.portone_schedule_id && !isPaymentsMock()) {
    await revokeSchedules([sub.portone_schedule_id]).catch((e) => console.error("[subscriptions] 예약 취소 실패:", e));
  }
  if (sub.next_payment_id) {
    await admin.from("payments").update({ status: "cancelled" }).eq("portone_payment_id", sub.next_payment_id).eq("status", "pending");
  }
  await admin.from("subscriptions").update({ next_payment_id: null, portone_schedule_id: null, next_payment_at: null, updated_at: new Date().toISOString() }).eq("id", sub.id);
}

/** 결제 성공 반영: 기간 연장, 실패 카운터 초기화, 다음 달 예약 */
async function applyRenewalSuccess(sub: SubscriptionRow, paymentId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date();
  const oldEnd = new Date(sub.current_period_end);
  // 제때 결제되면 기간이 이어지고, 많이 늦었으면(유예 지나 재결제) 오늘부터 새로 센다
  const start = oldEnd > addDays(now, -PAST_DUE_GRACE_DAYS) ? oldEnd : now;
  const end = addMonths(start, 1);

  await admin.from("payments").update({ status: "paid", paid_at: now.toISOString() }).eq("portone_payment_id", paymentId);
  const { data } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      failed_attempts: 0,
      last_failure_at: null,
      last_failure_reason: null,
      next_payment_id: null,
      portone_schedule_id: null,
      next_payment_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", sub.id)
    .select("*")
    .single();
  const fresh = data as SubscriptionRow;
  if (!fresh.cancel_at_period_end) await scheduleRenewal(fresh, end);
}

/** 웹훅 Transaction.Paid (paymentId = next_payment_id). 여러 번 와도 한 번만 반영한다. */
export async function handleRenewalPaid(paymentId: string): Promise<boolean> {
  const sub = await loadByNextPaymentId(paymentId);
  if (!sub) return false; // 이미 처리됐거나(next_payment_id 가 비워짐) 우리 구독이 아님
  if (!isPaymentsMock()) {
    const payment = await getPayment(paymentId);
    if (!payment) throw new SubscriptionError(404, "포트원에서 결제를 찾을 수 없습니다.");
    verifyPaymentMatches(payment, { paymentId, amountKrw: renewalAmount(sub) });
  }
  await applyRenewalSuccess(sub, paymentId);
  return true;
}

/** 웹훅 Transaction.Failed. 3일 뒤 재시도, MAX_RENEWAL_ATTEMPTS 회 실패면 해지. */
export async function handleRenewalFailed(paymentId: string, reason: string | null): Promise<boolean> {
  const sub = await loadByNextPaymentId(paymentId);
  if (!sub) return false;
  const admin = createAdminClient();
  const now = new Date();
  const attempts = sub.failed_attempts + 1;

  await admin.from("payments").update({ status: "failed" }).eq("portone_payment_id", paymentId);

  if (attempts >= MAX_RENEWAL_ATTEMPTS) {
    await admin
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: now.toISOString(),
        failed_attempts: attempts,
        last_failure_at: now.toISOString(),
        last_failure_reason: reason ?? "결제 실패",
        next_payment_id: null,
        portone_schedule_id: null,
        next_payment_at: null,
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);
    if (sub.billing_key_enc && !isPaymentsMock()) await deleteBillingKey(decryptSecret(sub.billing_key_enc)).catch(() => undefined);
    return true;
  }

  const { data } = await admin
    .from("subscriptions")
    .update({
      status: "past_due",
      failed_attempts: attempts,
      last_failure_at: now.toISOString(),
      last_failure_reason: reason ?? "결제 실패",
      next_payment_id: null,
      portone_schedule_id: null,
      next_payment_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", sub.id)
    .select("*")
    .single();
  await scheduleRenewal(data as SubscriptionRow, addDays(now, RETRY_INTERVAL_DAYS));
  return true;
}

/** 지금 즉시 빌링키로 결제 (미납 재결제·카드 변경 후). 성공하면 기간 연장. */
async function chargeNow(sub: SubscriptionRow, billingKey: string): Promise<void> {
  const admin = createAdminClient();
  // 대기 중인 재시도 예약이 있으면 먼저 정리해 이중 결제를 막는다
  await clearRenewal(sub);
  const paymentId = `pf_sub_${randomUUID()}`;
  const amountKrw = renewalAmount(sub);
  await admin.from("payments").insert({
    user_id: sub.user_id,
    portone_payment_id: paymentId,
    kind: "subscription",
    status: "pending",
    amount_krw: amountKrw,
    order_name: renewalOrderName(sub),
    meta: { planCode: sub.plan_code, renewal: true, manual: true },
  });
  if (!isPaymentsMock()) {
    try {
      await payWithBillingKey({ paymentId, billingKey, orderName: renewalOrderName(sub), customerId: sub.user_id, amountKrw });
    } catch {
      await admin.from("payments").update({ status: "failed" }).eq("portone_payment_id", paymentId);
      throw new SubscriptionError(402, "결제에 실패했습니다. 카드 한도·유효기간을 확인하거나 다른 카드를 등록하세요.");
    }
    const payment = await getPayment(paymentId);
    if (!payment) throw new SubscriptionError(500, "결제 조회에 실패했습니다.");
    verifyPaymentMatches(payment, { paymentId, amountKrw });
  }
  await applyRenewalSuccess(sub, paymentId);
}

// ----- 사용자 동작 -----

export async function cancelSubscription(user: SessionUser): Promise<void> {
  const sub = await loadSubscription(user.id);
  if (!sub || sub.status === "cancelled") throw new SubscriptionError(400, "해지할 구독이 없습니다.");
  if (sub.cancel_at_period_end) return;
  await clearRenewal(sub);
  const admin = createAdminClient();
  await admin.from("subscriptions").update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", sub.id);
}

export async function resumeSubscription(user: SessionUser): Promise<void> {
  const sub = await loadSubscription(user.id);
  if (!sub || !sub.cancel_at_period_end || sub.status === "cancelled") throw new SubscriptionError(400, "해지 예약 상태가 아닙니다.");
  if (new Date(sub.current_period_end) <= new Date()) throw new SubscriptionError(400, "이미 만료되었습니다. 플랜을 다시 선택하세요.");
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: false, cancelled_at: null, updated_at: new Date().toISOString() })
    .eq("id", sub.id)
    .select("*")
    .single();
  await scheduleRenewal(data as SubscriptionRow, new Date(sub.current_period_end));
}

/** 결제 수단 변경. 미납이면 새 카드로 즉시 결제, 아니면 다음 예약을 새 카드로 바꾼다. */
export async function changeCard(user: SessionUser, billingKey: string | null): Promise<{ chargedNow: boolean }> {
  const sub = await loadSubscription(user.id);
  if (!sub || sub.status === "cancelled") throw new SubscriptionError(400, "활성 구독이 없습니다.");
  const admin = createAdminClient();

  let enc: string | null = sub.billing_key_enc;
  if (!isPaymentsMock()) {
    if (!billingKey) throw new SubscriptionError(400, "빌링키가 없습니다.");
    const bk = await getBillingKey(billingKey);
    if (!bk || bk.status !== "ISSUED") throw new SubscriptionError(400, "빌링키가 유효하지 않습니다.");
    enc = encryptSecret(billingKey);
    if (sub.billing_key_enc) await deleteBillingKey(decryptSecret(sub.billing_key_enc)).catch(() => undefined);
  }
  const { data } = await admin.from("subscriptions").update({ billing_key_enc: enc, updated_at: new Date().toISOString() }).eq("id", sub.id).select("*").single();
  const fresh = data as SubscriptionRow;

  if (fresh.status === "past_due") {
    await chargeNow(fresh, billingKey ?? "");
    return { chargedNow: true };
  }
  if (!fresh.cancel_at_period_end) {
    await scheduleRenewal(fresh, fresh.next_payment_at ? new Date(fresh.next_payment_at) : new Date(fresh.current_period_end));
  }
  return { chargedNow: false };
}

/** 미납 상태에서 등록된 카드로 지금 다시 결제 */
export async function retryNow(user: SessionUser): Promise<void> {
  const sub = await loadSubscription(user.id);
  if (!sub || sub.status !== "past_due") throw new SubscriptionError(400, "재결제가 필요한 상태가 아닙니다.");
  const key = sub.billing_key_enc ? decryptSecret(sub.billing_key_enc) : "";
  if (!key && !isPaymentsMock()) throw new SubscriptionError(400, "등록된 결제 수단이 없습니다. 카드를 다시 등록하세요.");
  await chargeNow(sub, key);
}
