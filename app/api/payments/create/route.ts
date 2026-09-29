import { NextResponse } from "next/server";
import { z } from "zod";

import { handleApiError, readJson, requireApiUser } from "@/lib/api";
import { createOrder } from "@/lib/payments";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("template"), templateId: z.uuid() }),
  z.object({ kind: z.literal("credits"), packCode: z.string().min(1).max(40) }),
]);

/** 단건 주문 생성 → { paymentId, amountKrw, orderName, mock } */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const input = await readJson(request, schema);
    return NextResponse.json(await createOrder(user, input));
  } catch (e) {
    return handleApiError(e);
  }
}
