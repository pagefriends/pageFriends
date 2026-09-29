import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 의 proxy.ts (구 middleware.ts). 모든 요청에서 Supabase 세션을 갱신하고 보호 경로를 지킨다.
 * 1차 방어선일 뿐이다 — 각 Server Action·Route Handler 는 lib/auth/session.ts 로 자체 인증을 확인한다.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|css|js|map|txt|xml)$).*)"],
};
