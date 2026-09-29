import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, readJson, requireApiUser } from "@/lib/api";
import { completePayment } from "@/lib/payments";

export const runtime = "nodejs";

const schema = z.object({ paymentId: z.string().min(1).max(200) });

/** 결제창 완료 후 클라이언트가 호출. 서버가 포트원에 재조회해 금액을 대조한 뒤 지급한다. */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const { paymentId } = await readJson(request, schema);
    const row = await completePayment(paymentId, user.id);
    return NextResponse.json({ ok: true, kind: row.kind, status: row.status });
  } catch (e) {
    return handleApiError(e);
  }
}
