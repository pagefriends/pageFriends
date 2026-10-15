import { NextResponse } from "next/server";

import { getAdminCounts } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import { getMessageSummary } from "@/lib/messages";

/**
 * 상단 바 알림 숫자. 배지가 주기적으로 부른다 (lib/use-live-counts.ts).
 *   GET /api/notifications              → { unread, awaiting }        사용자: 새 답변·메시지 수, 내 답을 기다리는 요청 수
 *   GET /api/notifications?scope=admin  → { todo, replies, messages } 관리자: 손댈 요청, 새 답글이 달린 요청, 새 메시지가 온 사이트
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  const headers = { "Cache-Control": "no-store" };
  if (new URL(request.url).searchParams.get("scope") === "admin") {
    if (!(await isAdmin(user.id))) return apiError(403, "FORBIDDEN", "관리자 권한이 없습니다.");
    return NextResponse.json(await getAdminCounts(), { headers });
  }

  const { total } = await getMessageSummary();
  return NextResponse.json({ unread: total.unreadRequests + total.unreadGeneral, awaiting: total.awaiting }, { headers });
}
