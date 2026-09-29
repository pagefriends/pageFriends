import "server-only";

import * as PortOne from "@portone/server-sdk";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";

/**
 * 포트원 V2 서버 API 래퍼 (PG: 토스페이먼츠). 결제 검증은 항상 서버에서 포트원에 다시 조회해 금액·상점을 대조한다.
 * 브라우저가 보낸 금액은 믿지 않는다.
 */

const paymentSchema = z.looseObject({
  id: z.string(),
  status: z.string(),
  storeId: z.string(),
  currency: z.string(),
  amount: z.looseObject({ total: z.number().int().nonnegative() }),
});
export type PortOnePayment = z.infer<typeof paymentSchema>;

const billingKeySchema = z.looseObject({
  status: z.enum(["ISSUED", "DELETED"]),
  billingKey: z.string().min(1),
  storeId: z.string(),
});

function auth() {
  const env = getServerEnv();
  if (!env.PORTONE_API_SECRET) throw new Error("PORTONE_API_SECRET 이 없습니다.");
  return { Authorization: `PortOne ${env.PORTONE_API_SECRET}` };
}

export async function getPayment(paymentId: string): Promise<PortOnePayment | null> {
  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: auth(),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PORTONE_PAYMENT_QUERY_FAILED:${res.status}`);
  return paymentSchema.parse(await res.json());
}

export async function getBillingKey(billingKey: string) {
  const env = getServerEnv();
  const url = new URL(`https://api.portone.io/billing-keys/${encodeURIComponent(billingKey)}`);
  url.searchParams.set("storeId", env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "");
  const res = await fetch(url, { headers: auth(), signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PORTONE_BILLING_KEY_QUERY_FAILED:${res.status}`);
  return billingKeySchema.parse(await res.json());
}

/** 빌링키로 즉시 결제. 응답은 요약 래퍼라 반드시 getPayment 로 재조회해 확정한다. */
export async function payWithBillingKey(input: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  customerId: string;
  amountKrw: number;
}): Promise<void> {
  const env = getServerEnv();
  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(input.paymentId)}/billing-key`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json", "Idempotency-Key": `"${input.paymentId}"` },
    body: JSON.stringify({
      storeId: env.NEXT_PUBLIC_PORTONE_STORE_ID,
      channelKey: env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
      billingKey: input.billingKey,
      orderName: input.orderName,
      customer: { id: input.customerId },
      amount: { total: input.amountKrw },
      currency: "KRW",
    }),
    signal: AbortSignal.timeout(70_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PORTONE_CHARGE_FAILED:${res.status}:${body.slice(0, 300)}`);
  }
  await res.arrayBuffer();
}

/** 빌링키 자동 결제 예약. 예약 id 를 돌려준다(해지 시 취소용). 결제 결과는 웹훅(Transaction.Paid/Failed)으로 온다. */
export async function scheduleNextPayment(input: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  customerId: string;
  amountKrw: number;
  timeToPay: Date;
}): Promise<{ scheduleId: string | null }> {
  const env = getServerEnv();
  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(input.paymentId)}/schedule`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      payment: {
        storeId: env.NEXT_PUBLIC_PORTONE_STORE_ID,
        channelKey: env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY,
        billingKey: input.billingKey,
        orderName: input.orderName,
        customer: { id: input.customerId },
        amount: { total: input.amountKrw },
        currency: "KRW",
      },
      timeToPay: input.timeToPay.toISOString(),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`PORTONE_SCHEDULE_FAILED:${res.status}`);
  const body = (await res.json().catch(() => ({}))) as { schedule?: { id?: string } };
  return { scheduleId: body.schedule?.id ?? null };
}

/** 예약 취소 (해지·플랜 변경·재시도 예약 교체 시). 이미 취소됐거나 없는 예약이면 무시한다. */
export async function revokeSchedules(scheduleIds: string[]): Promise<void> {
  if (scheduleIds.length === 0) return;
  const env = getServerEnv();
  const res = await fetch("https://api.portone.io/payment-schedules", {
    method: "DELETE",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: env.NEXT_PUBLIC_PORTONE_STORE_ID, scheduleIds }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok && res.status !== 404) throw new Error(`PORTONE_REVOKE_FAILED:${res.status}`);
}

/** 빌링키 삭제 (구독 완전 종료 시). 실패해도 치명적이지 않다. */
export async function deleteBillingKey(billingKey: string): Promise<void> {
  const env = getServerEnv();
  const url = new URL(`https://api.portone.io/billing-keys/${encodeURIComponent(billingKey)}`);
  url.searchParams.set("storeId", env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "");
  const res = await fetch(url, { method: "DELETE", headers: auth(), signal: AbortSignal.timeout(20_000) });
  if (!res.ok && res.status !== 404) throw new Error(`PORTONE_BILLING_KEY_DELETE_FAILED:${res.status}`);
}

export function verifyPaymentMatches(payment: PortOnePayment, expected: { paymentId: string; amountKrw: number }) {
  const env = getServerEnv();
  if (payment.id !== expected.paymentId) throw new Error("PAYMENT_ID_MISMATCH");
  if (payment.storeId !== env.NEXT_PUBLIC_PORTONE_STORE_ID) throw new Error("PAYMENT_STORE_MISMATCH");
  if (payment.currency !== "KRW") throw new Error("PAYMENT_CURRENCY_MISMATCH");
  if (payment.amount.total !== expected.amountKrw) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  if (payment.status !== "PAID") throw new Error(`PAYMENT_NOT_PAID:${payment.status}`);
}

/** 웹훅 서명 검증. 서명이 틀리면 throw. */
export async function verifyWebhook(rawBody: string, headers: Headers) {
  const env = getServerEnv();
  if (!env.PORTONE_WEBHOOK_SECRET) throw new Error("PORTONE_WEBHOOK_SECRET 이 없습니다.");
  return PortOne.Webhook.verify(env.PORTONE_WEBHOOK_SECRET, rawBody, Object.fromEntries(headers.entries()));
}
