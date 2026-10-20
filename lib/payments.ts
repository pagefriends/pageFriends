import "server-only";

import { randomUUID } from "node:crypto";

import { BILLING_CYCLE_LABEL, CREDIT_PACK_BY_CODE, PLAN_BY_CODE, REQUEST_KIND_LABEL, creditAmountLabel, type BillingCycle, type PlanCode } from "@/config/plans";
import type { SessionUser } from "@/lib/auth/session";
import { quoteChange, type ChangeMode } from "@/lib/billing-quote";
import { encryptSecret } from "@/lib/crypto";
import { isPaymentsMock, paymentsAvailable } from "@/lib/env";
import { getBillingKey, getPayment, payWithBillingKey, verifyPaymentMatches } from "@/lib/portone";
import { clearRenewal, currentTerms, cycleOf, scheduleChange, scheduleRenewal } from "@/lib/subscriptions";
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

export type SubscribeInput = { planCode: PlanCode; cycle: BillingCycle; paymentAddon: boolean; billingKey: string | null };

export type SubscribeResult = {
  mode: ChangeMode;
  planCode: PlanCode;
  cycle: BillingCycle;
  /** 지금 결제한 금액 (later · same 는 0) */
  amountKrw: number;
  paymentId: string | null;
  /** later: 바뀌는 날 */
  effectiveAt: string | null;
};

/**
 * 플랜 시작 · 변경 · 결제 시스템 켜기. 금액과 적용 방식은 quoteChange(결제 화면과 같은 계산)로 정한다.
 * - new · now · addon: 빌링키로 바로 결제하고, 성공하면 구독을 활성화(새 기간)하거나 결제 시스템을 켠 뒤 다음 결제를 예약한다.
 * - later: 결제 없이 다음 결제부터 바뀌게 예약한다. same: 예약해 둔 변경이 있으면 취소한다.
 * mock 모드에서는 포트원을 부르지 않는다.
 */
export async function subscribe(user: SessionUser, input: SubscribeInput): Promise<SubscribeResult> {
  const plan = PLAN_BY_CODE[input.planCode];
  if (!plan || plan.hidden) throw new PaymentError(400, "알 수 없는 플랜입니다.");
  const admin = createAdminClient();
  const { data: prevData } = await admin.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  const prev = (prevData as SubscriptionRow | null) ?? null;
  if (input.cycle === "year" && prev && !("billing_cycle" in prev)) throw new PaymentError(503, "연간 결제는 DB 업데이트(0009) 뒤에 쓸 수 있습니다.");

  const q = quoteChange({ current: currentTerms(prev), hadAddon: Boolean(prev?.payment_addon) }, input);
  const base = { mode: q.mode, planCode: input.planCode, cycle: input.cycle };

  if (q.mode === "same") {
    if (prev?.pending_plan_code) {
      await scheduleChange(prev, prev.plan_code, cycleOf(prev));
      return { ...base, amountKrw: 0, paymentId: null, effectiveAt: null };
    }
    throw new PaymentError(409, "이미 이용 중인 플랜이에요.");
  }
  if (q.mode === "later") {
    await scheduleChange(prev!, input.planCode, input.cycle);
    return { ...base, amountKrw: 0, paymentId: null, effectiveAt: q.effectiveAt };
  }

  // ----- 지금 결제 (new · now · addon) -----
  const cycleLabel = BILLING_CYCLE_LABEL[input.cycle];
  const orderName =
    q.mode === "addon"
      ? `결제 시스템 연동 (${plan.name} 플랜)`
      : `${q.mode === "now" && prev ? `${PLAN_BY_CODE[prev.plan_code].name} → ` : ""}${plan.name} 플랜 (${cycleLabel})${q.setupFeeKrw > 0 ? " + 결제 시스템 연동" : ""}`;
  const paymentId = `pf_sub_${randomUUID()}`;
  const { error: insErr } = await admin.from("payments").insert({
    user_id: user.id,
    portone_payment_id: paymentId,
    kind: "subscription",
    status: "pending",
    amount_krw: q.chargeKrw,
    order_name: orderName,
    meta: { planCode: input.planCode, cycle: input.cycle, mode: q.mode, creditKrw: q.creditKrw, setupFeeKrw: q.setupFeeKrw, paymentAddon: q.paymentAddon },
  });
  if (insErr) throw new PaymentError(500, insErr.message);

  let billingKeyEnc: string | null = null;
  if (!isPaymentsMock()) {
    const avail = paymentsAvailable();
    if (!avail.enabled) throw new PaymentError(503, `결제 설정이 없습니다: ${avail.missing.join(", ")}`);
    if (!input.billingKey) throw new PaymentError(400, "빌링키가 없습니다.");
    const bk = await getBillingKey(input.billingKey);
    if (!bk || bk.status !== "ISSUED") throw new PaymentError(400, "빌링키가 유효하지 않습니다.");

    if (q.chargeKrw > 0) {
      try {
        await payWithBillingKey({ paymentId, billingKey: input.billingKey, orderName, customerId: user.id, amountKrw: q.chargeKrw });
      } catch (e) {
        await markPaymentStatus(paymentId, "failed");
        throw new PaymentError(402, e instanceof Error ? e.message : "결제에 실패했습니다.");
      }
      const payment = await getPayment(paymentId);
      if (!payment) throw new PaymentError(500, "결제 조회에 실패했습니다.");
      verifyPaymentMatches(payment, { paymentId, amountKrw: q.chargeKrw });
    }
    billingKeyEnc = encryptSecret(input.billingKey);
  }
  await admin.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("portone_payment_id", paymentId);

  if (q.mode === "addon") {
    // 같은 플랜에 결제 시스템만 켠다 — 기간은 그대로, 다음 결제는 새 카드로 다시 예약
    const { data: updated } = await admin
      .from("subscriptions")
      .update({ payment_addon: true, ...(billingKeyEnc ? { billing_key_enc: billingKeyEnc } : {}), updated_at: new Date().toISOString() })
      .eq("id", prev!.id)
      .select("*")
      .single();
    const fresh = updated as SubscriptionRow;
    if (billingKeyEnc && !fresh.cancel_at_period_end && fresh.status === "active") {
      await scheduleRenewal(fresh, fresh.next_payment_at ? new Date(fresh.next_payment_at) : new Date(fresh.current_period_end)).catch((e) =>
        console.error("[payments] 다음 결제 재예약 실패:", e instanceof Error ? e.message : e),
      );
    }
    return { ...base, amountKrw: q.chargeKrw, paymentId, effectiveAt: null };
  }

  // 새 기간을 시작하기 전에 예전 구독의 갱신 예약을 취소한다 (이중 결제 방지). 결제가 성공한 뒤에 해야 실패해도 예전 구독이 이어진다
  if (prev) await clearRenewal(prev);
  await activateSubscription({ userId: user.id, planCode: input.planCode, cycle: input.cycle, paymentAddon: q.paymentAddon, billingKeyEnc });

  // 다음 자동 결제 예약. 실패해도 구독 활성화는 유지하고 로그만 남긴다 (결제 수단 변경으로 다시 예약 가능).
  const { data: fresh } = await admin.from("subscriptions").select("*").eq("user_id", user.id).single();
  try {
    await scheduleRenewal(fresh as SubscriptionRow, new Date((fresh as SubscriptionRow).current_period_end));
  } catch (e) {
    console.error("[payments] 다음 결제 예약 실패:", e instanceof Error ? e.message : e);
  }

  return { ...base, amountKrw: q.chargeKrw, paymentId, effectiveAt: null };
}

/** activate_subscription 호출. 0009 전 DB(결제 주기 인자 없음)면 월간만 예전 방식으로 활성화한다 */
async function activateSubscription(a: { userId: string; planCode: PlanCode; cycle: BillingCycle; paymentAddon: boolean; billingKeyEnc: string | null }) {
  const admin = createAdminClient();
  const args = { p_user_id: a.userId, p_plan: a.planCode, p_payment_addon: a.paymentAddon, p_billing_key_enc: a.billingKeyEnc };
  const { error } = await admin.rpc("activate_subscription", { ...args, p_billing_cycle: a.cycle });
  if (!error) return;
  if (error.code === "PGRST202" && a.cycle === "month") {
    const { error: legacy } = await admin.rpc("activate_subscription", args);
    if (!legacy) return;
    throw new PaymentError(500, legacy.message);
  }
  throw new PaymentError(500, error.code === "PGRST202" ? "연간 결제는 DB 업데이트(0009) 뒤에 쓸 수 있습니다." : error.message);
}
