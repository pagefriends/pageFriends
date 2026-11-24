"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { BetaError, startBeta } from "@/lib/beta";
import { cancelPendingChange, cancelSubscription, resumeSubscription, retryNow, SubscriptionError } from "@/lib/subscriptions";
import { formatDate } from "@/lib/utils";

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

/** 다음 결제부터 바꾸기로 한 플랜 변경 취소 */
export async function cancelPendingChangeAction(): Promise<BillingActionResult> {
  const user = await requireUser("/billing");
  try {
    await cancelPendingChange(user);
    revalidatePath("/billing");
    return { ok: true, message: "예약한 플랜 변경을 취소했습니다. 다음 결제도 지금 플랜 그대로 나갑니다." };
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

/** 무료 베타 시작: 결제 없이 정해진 플랜을 몇 달 동안 연다 (lib/beta.ts) */
export async function startBetaAction(): Promise<BillingActionResult> {
  const user = await requireUser("/billing");
  try {
    const { until } = await startBeta(user.id);
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { ok: true, message: `무료 베타를 시작했어요. ${formatDate(until)}까지 무료로 쓸 수 있어요.` };
  } catch (e) {
    if (e instanceof BetaError) return { ok: false, error: e.message };
    console.error("[beta] start", e);
    return { ok: false, error: "무료 베타를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
}
