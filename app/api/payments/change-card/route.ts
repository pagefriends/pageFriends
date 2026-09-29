import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, readJson, requireApiUser } from "@/lib/api";
import { PaymentError } from "@/lib/payments";
import { changeCard, SubscriptionError } from "@/lib/subscriptions";

export const runtime = "nodejs";

const schema = z.object({ billingKey: z.string().min(8).max(2000).nullable().default(null) });

/** 결제 수단 변경. 새 빌링키를 저장하고, 미납이면 즉시 재결제한다. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const { billingKey } = await readJson(request, schema);
    const r = await changeCard(user, billingKey);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof SubscriptionError || e instanceof PaymentError) return apiError(e.status, "SUBSCRIPTION_ERROR", e.message);
    console.error("[change-card]", e);
    return apiError(500, "INTERNAL", e instanceof Error ? e.message : "서버 오류");
  }
}
