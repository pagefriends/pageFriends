import "server-only";

import { randomUUID } from "node:crypto";

import { BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW, CREDIT_PACK_BY_CODE, PLAN_BY_CODE, REQUEST_KIND_LABEL, creditAmountLabel, type PlanCode } from "@/config/plans";
import type { SessionUser } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto";
import { isPaymentsMock, paymentsAvailable } from "@/lib/env";
import { getBillingKey, getPayment, payWithBillingKey, verifyPaymentMatches } from "@/lib/portone";
import { clearRenewal, scheduleRenewal } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentRow, SubscriptionRow } from "@/lib/types/db";

export class PaymentError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type OneTimePurchase = { kind: "template"; templateId: string } | { kind: "credits"; packCode: string };

/**
 * 단건 주문 생성. 금액·주문명은 서버가 상수/DB 에서 정한다 — 브라우저가 보낸 금액은 절대 쓰지 않는다.
 * payments 행을 pending 으로 먼저 만들어 두고, 완료 단계에서 포트원 조회 금액과 대조한다.
 */
export async function createOrder(user: SessionUser, purchase: OneTimePurchase) {
  const admin = createAdminClient();
  let amountKrw: number;
  let orderName: string;
  let meta: Record<string, unknown>;

  if (purchase.kind === "template") {
    const { data: t } = await admin.from("templates").select("id, name, price_krw, is_published").eq("id", purchase.templateId).maybeSingle();
    if (!t || !t.is_published) throw new PaymentError(404, "템플릿을 찾을 수 없습니다.");
    const { data: owned } = await admin.from("template_purchases").select("id").eq("user_id", user.id).eq("template_id", t.id).maybeSingle();
    if (owned) throw new PaymentError(409, "이미 구매한 템플릿입니다.");
    amountKrw = t.price_krw as number;
    orderName = `템플릿 · ${t.name as string}`;
    meta = { templateId: t.id };
  } else {
    const pack = CREDIT_PACK_BY_CODE[purchase.packCode];
    if (!pack) throw new PaymentError(400, "알 수 없는 크레딧 팩입니다.");
    amountKrw = pack.priceKrw;
    orderName = `${REQUEST_KIND_LABEL[pack.kind]} 크레딧 ${creditAmountLabel(pack)}`;
    // amount: AI 는 토큰 수, 전문가는 횟수. (예전 행은 count 로 저장돼 있어 completePayment 가 둘 다 읽는다)
    meta = { packCode: pack.code, kind: pack.kind, amount: pack.amount };
  }

  const paymentId = `pf_${randomUUID()}`;
  const { error } = await admin
    .from("payments")
    .insert({ user_id: user.id, portone_payment_id: paymentId, kind: purchase.kind, status: "pending", amount_krw: amountKrw, order_name: orderName, meta });
  if (error) throw new PaymentError(500, error.message);

  return { paymentId, amountKrw, orderName, mock: isPaymentsMock() };
}

/** 결제 완료 확인 + 지급. 여러 번 호출돼도(클라이언트 + 웹훅) 한 번만 지급된다. */
export async function completePayment(paymentId: string, expectedUserId?: string): Promise<PaymentRow> {
  const admin = createAdminClient();
  const { data } = await admin.from("payments").select("*").eq("portone_payment_id", paymentId).maybeSingle();
  const row = data as PaymentRow | null;
  if (!row) throw new PaymentError(404, "주문을 찾을 수 없습니다.");
  if (expectedUserId && row.user_id !== expectedUserId) throw new PaymentError(403, "다른 사용자의 주문입니다.");
  if (row.status === "paid") return row;
  if (row.kind === "subscription") throw new PaymentError(400, "구독 결제는 이 경로로 확정하지 않습니다.");

  if (!isPaymentsMock()) {
    const payment = await getPayment(paymentId);
    if (!payment) throw new PaymentError(404, "포트원에서 결제를 찾을 수 없습니다.");
    verifyPaymentMatches(payment, { paymentId, amountKrw: row.amount_krw });
  }

  // 상태를 먼저 paid 로 바꾸되 pending 이었을 때만 — 동시 호출에서 이중 지급 방지
  const { data: updated } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!updated) {
    const { data: again } = await admin.from("payments").select("*").eq("id", row.id).single();
    return again as PaymentRow;
  }

  if (row.kind === "template") {
    await admin.from("template_purchases").upsert({ user_id: row.user_id, template_id: row.meta.templateId as string, payment_id: row.id }, { onConflict: "user_id,template_id" });
  } else if (row.kind === "credits") {
    const amount = Number(row.meta.amount ?? row.meta.count ?? 0);
    if (amount > 0) await admin.rpc("grant_credits", { p_user_id: row.user_id, p_kind: row.meta.kind as string, p_count: amount });
  }
  return { ...row, status: "paid" };
}

export async function markPaymentStatus(paymentId: string, status: "failed" | "cancelled") {
  const admin = createAdminClient();
  await admin.from("payments").update({ status }).eq("portone_payment_id", paymentId).eq("status", "pending");
}

/** 구독 금액: 비즈니스 + 결제 시스템 옵션이면 첫 달 289,000원 */
export function subscriptionAmount(planCode: PlanCode, paymentAddon: boolean, firstMonth: boolean): number {
  const plan = PLAN_BY_CODE[planCode];
  if (planCode === "business" && paymentAddon && firstMonth) return BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW;
  return plan.priceKrw;
}

/**
 * 구독 시작. 빌링키로 첫 달을 즉시 결제하고, 성공하면 구독을 활성화한 뒤 다음 달 결제를 예약한다.
 * mock 모드에서는 포트원을 부르지 않고 바로 활성화한다.
 */
export async function subscribe(user: SessionUser, input: { planCode: PlanCode; paymentAddon: boolean; billingKey: string | null }) {
  const plan = PLAN_BY_CODE[input.planCode];
  if (!plan) throw new PaymentError(400, "알 수 없는 플랜입니다.");
  const paymentAddon = input.planCode === "business" && input.paymentAddon;
  const amountKrw = subscriptionAmount(input.planCode, paymentAddon, true);
  const admin = createAdminClient();
  const paymentId = `pf_sub_${randomUUID()}`;
  const orderName = `${plan.name} 플랜 (월)${paymentAddon ? " + 결제 시스템 초기 구축" : ""}`;

  // 플랜 변경이면 이전 구독의 갱신 예약을 먼저 취소한다 (이중 결제 방지)
  const { data: prev } = await admin.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if (prev) await clearRenewal(prev as SubscriptionRow);

  const { error: insErr } = await admin.from("payments").insert({
    user_id: user.id,
    portone_payment_id: paymentId,
    kind: "subscription",
    status: "pending",
    amount_krw: amountKrw,
    order_name: orderName,
    meta: { planCode: input.planCode, paymentAddon },
  });
  if (insErr) throw new PaymentError(500, insErr.message);

  let billingKeyEnc: string | null = null;
  if (!isPaymentsMock()) {
    const avail = paymentsAvailable();
    if (!avail.enabled) throw new PaymentError(503, `결제 설정이 없습니다: ${avail.missing.join(", ")}`);
    if (!input.billingKey) throw new PaymentError(400, "빌링키가 없습니다.");
    const bk = await getBillingKey(input.billingKey);
    if (!bk || bk.status !== "ISSUED") throw new PaymentError(400, "빌링키가 유효하지 않습니다.");

    try {
      await payWithBillingKey({ paymentId, billingKey: input.billingKey, orderName, customerId: user.id, amountKrw });
    } catch (e) {
      await markPaymentStatus(paymentId, "failed");
      throw new PaymentError(402, e instanceof Error ? e.message : "결제에 실패했습니다.");
    }
    const payment = await getPayment(paymentId);
    if (!payment) throw new PaymentError(500, "결제 조회에 실패했습니다.");
    verifyPaymentMatches(payment, { paymentId, amountKrw });
    billingKeyEnc = encryptSecret(input.billingKey);
  }

  await admin.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("portone_payment_id", paymentId);
  const { error: actErr } = await admin.rpc("activate_subscription", {
    p_user_id: user.id,
    p_plan: input.planCode,
    p_payment_addon: paymentAddon,
    p_billing_key_enc: billingKeyEnc,
  });
  if (actErr) throw new PaymentError(500, actErr.message);

  // 다음 달 자동 결제 예약. 실패해도 구독 활성화는 유지하고 로그만 남긴다 (결제 수단 변경으로 다시 예약 가능).
  const { data: fresh } = await admin.from("subscriptions").select("*").eq("user_id", user.id).single();
  try {
    await scheduleRenewal(fresh as SubscriptionRow, new Date((fresh as SubscriptionRow).current_period_end));
  } catch (e) {
    console.error("[payments] 다음 달 결제 예약 실패:", e instanceof Error ? e.message : e);
  }

  return { paymentId, amountKrw, planCode: input.planCode };
}
