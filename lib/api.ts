import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { PaymentError } from "@/lib/payments";

/** API 응답 규약: 실패는 항상 { error: { code, message } } */
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new PaymentError(401, "로그인이 필요합니다.");
  return user;
}

export async function readJson<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PaymentError(400, "JSON 본문이 필요합니다.");
  }
  const r = schema.safeParse(body);
  if (!r.success) throw new PaymentError(400, r.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
  return r.data;
}

/** 라우트 공통 예외 → 응답 변환 */
export function handleApiError(e: unknown) {
  if (e instanceof PaymentError) return apiError(e.status, e.status === 401 ? "UNAUTHORIZED" : "PAYMENT_ERROR", e.message);
  console.error("[api]", e);
  return apiError(500, "INTERNAL", e instanceof Error ? e.message : "서버 오류");
}
