import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, readJson, requireApiUser } from "@/lib/api";
import { isPaymentsMock } from "@/lib/env";
import { handleRenewalFailed, handleRenewalPaid } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * 개발 전용: 포트원 웹훅 없이 "다음 갱신 결제가 성공/실패했다" 를 흉내 낸다.
 * PAYMENTS_MOCK=true 일 때만 열리며, 로그인한 본인의 구독에만 적용된다.
 */
export async function POST(request: Request) {
  if (!isPaymentsMock()) return apiError(404, "NOT_FOUND", "개발 모드에서만 사용할 수 있습니다.");
  try {
    const user = await requireApiUser();
    const { outcome } = await readJson(request, z.object({ outcome: z.enum(["paid", "failed"]) }));
    const admin = createAdminClient();
    const { data } = await admin.from("subscriptions").select("next_payment_id").eq("user_id", user.id).maybeSingle();
    const paymentId = data?.next_payment_id as string | null | undefined;
    if (!paymentId) return apiError(400, "NO_SCHEDULE", "예약된 갱신 결제가 없습니다.");
    const handled = outcome === "paid" ? await handleRenewalPaid(paymentId) : await handleRenewalFailed(paymentId, "모의 실패");
    return NextResponse.json({ ok: true, handled, paymentId });
  } catch (e) {
    console.error("[dev/renewal]", e);
    return apiError(500, "INTERNAL", e instanceof Error ? e.message : "서버 오류");
  }
}
