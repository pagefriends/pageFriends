import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, readJson, requireApiUser } from "@/lib/api";
import { subscribe } from "@/lib/payments";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.enum(["starter", "business", "pro", "enterprise"]),
  paymentAddon: z.boolean().default(false),
  /** 포트원 requestIssueBillingKey 결과. mock 모드에서는 null */
  billingKey: z.string().min(8).max(2000).nullable().default(null),
});

/** 구독 시작: 빌링키로 첫 달 결제 → 구독 활성화 → 다음 달 예약 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = await readJson(request, schema);
    return NextResponse.json({ ok: true, ...(await subscribe(user, input)) });
  } catch (e) {
    return handleApiError(e);
  }
}
