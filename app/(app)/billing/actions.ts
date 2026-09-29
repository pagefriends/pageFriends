"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { cancelSubscription, resumeSubscription, retryNow, SubscriptionError } from "@/lib/subscriptions";

export type BillingActionResult = { ok: true; message: string } | { ok: false; error: string };

function toResult(e: unknown): BillingActionResult {
  if (e instanceof SubscriptionError) return { ok: false, error: e.message };
  console.error("[billing]", e);
  return { ok: false, error: e instanceof Error ? e.message : "처리 중 오류가 발생했습니다." };
}

/** 해지 예약: 현재 결제 기간이 끝날 때까지 유지되고 갱신 결제만 멈춘다 */
export async function cancelSubscriptionAction(): Promise<BillingActionResult> {
  const user = await requireUser("/billing");
  try {
    await cancelSubscription(user);
    revalidatePath("/billing");
    return { ok: true, message: "해지를 예약했습니다. 현재 결제 기간이 끝날 때까지는 그대로 이용할 수 있습니다." };
  } catch (e) {
    return toResult(e);
  }
}

export async function resumeSubscriptionAction(): Promise<BillingActionResult> {
  const user = await requireUser("/billing");
  try {
    await resumeSubscription(user);
    revalidatePath("/billing");
    return { ok: true, message: "해지를 취소했습니다. 다음 갱신일에 정상 결제됩니다." };
  } catch (e) {
    return toResult(e);
  }
}

/** 미납 상태에서 등록된 카드로 즉시 재결제 */
export async function retryPaymentAction(): Promise<BillingActionResult> {
  const user = await requireUser("/billing");
  try {
    await retryNow(user);
    revalidatePath("/billing");
    return { ok: true, message: "결제가 완료되어 구독이 정상화되었습니다." };
  } catch (e) {
    return toResult(e);
  }
}
