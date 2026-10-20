import { NextResponse } from "next/server";
import { z } from "zod";

import { BILLING_CYCLES, PUBLIC_PLAN_CODES } from "@/config/plans";
import { handleApiError, readJson, requireApiUser } from "@/lib/api";
import { subscribe } from "@/lib/payments";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.enum(PUBLIC_PLAN_CODES),
  cycle: z.enum(BILLING_CYCLES as [string, ...string[]]).default("month"),
  paymentAddon: z.boolean().default(false),
  /** 포트원 requestIssueBillingKey 결과. mock 모드 · 다음 결제부터 바꾸기(결제 없음)에서는 null */
  billingKey: z.string().min(8).max(2000).nullable().default(null),
});

/** 플랜 시작 · 변경: 바로 결제(시작 · 올리기 · 결제 시스템 켜기) 또는 다음 결제부터 바꾸기 예약 (lib/payments.ts subscribe) */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = await readJson(request, schema);
    return NextResponse.json({ ok: true, ...(await subscribe(user, { ...input, cycle: input.cycle === "year" ? "year" : "month" })) });
  } catch (e) {
    return handleApiError(e);
  }
}
