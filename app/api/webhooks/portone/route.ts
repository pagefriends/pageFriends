import { NextResponse } from "next/server";

import { completePayment, markPaymentStatus, PaymentError } from "@/lib/payments";
import { verifyWebhook } from "@/lib/portone";
import { handleRenewalFailed, handleRenewalPaid } from "@/lib/subscriptions";

export const runtime = "nodejs";

/**
 * 포트원 V2 웹훅. 서명 검증 후 결제 상태를 동기화한다.
 * - 단건(템플릿·크레딧): 클라이언트가 /complete 를 못 부른 경우(모바일 리다이렉트 중단 등)를 보완
 * - 구독 갱신(pf_sub_*, 예약 결제): 성공이면 기간 연장 + 다음 예약, 실패면 재시도/해지
 * 포트원은 2xx 가 아니면 재시도하므로, 우리 쪽 일시 오류는 500 으로 돌려 재시도를 받는다.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(raw, request.headers);
  } catch (e) {
    console.warn("[webhook] 서명 검증 실패:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "서명이 올바르지 않습니다." } }, { status: 400 });
  }

  const type = (event as { type?: string }).type ?? "";
  const data = (event as { data?: { paymentId?: string; failure?: { reason?: string; pgMessage?: string } } }).data ?? {};
  const paymentId = data.paymentId;
  if (!paymentId) return NextResponse.json({ ok: true, ignored: true });

  try {
    if (paymentId.startsWith("pf_sub_")) {
      // 구독 결제. 첫 달 결제(/subscribe 가 이미 확정)는 next_payment_id 와 일치하지 않아 handle* 가 false 를 돌려 무시된다.
      if (type === "Transaction.Paid") await handleRenewalPaid(paymentId);
      else if (type === "Transaction.Failed") await handleRenewalFailed(paymentId, data.failure?.pgMessage ?? data.failure?.reason ?? null);
      return NextResponse.json({ ok: true });
    }

    if (type === "Transaction.Paid") await completePayment(paymentId);
    else if (type === "Transaction.Cancelled" || type === "Transaction.Failed") await markPaymentStatus(paymentId, type === "Transaction.Failed" ? "failed" : "cancelled");
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PaymentError && (e.status === 404 || e.status === 400)) return NextResponse.json({ ok: true, ignored: true });
    console.error("[webhook] 처리 실패:", e);
    return NextResponse.json({ error: { code: "RETRY", message: "잠시 후 재시도" } }, { status: 500 });
  }
}
