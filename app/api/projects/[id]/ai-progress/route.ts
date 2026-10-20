import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api";
import { loadBatchProgress } from "@/lib/ai/progress";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * 편집기 "AI 작업 중" 화면의 진행 상황.
 *   GET /api/projects/{id}/ai-progress?batch={묶음 id} → BatchProgress (lib/ai/progress.ts)
 * 사이트 주인(과 관리자)만 — 프로젝트 · 요청을 사용자 세션(RLS)으로 읽어 보고, 읽히면 권한이 있는 것이다.
 * 1초마다 불리므로 가볍게: 요청 · 페이지 · 실행 기록을 한 번씩만 읽는다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = new URL(request.url).searchParams.get("batch") ?? "";
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(batch).success) return apiError(400, "BAD_REQUEST", "잘못된 요청입니다.");
  const user = await getSessionUser();
  if (!user) return apiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
  try {
    const supabase = await createClient();
    const progress = await loadBatchProgress(supabase, id, batch);
    if (!progress) return apiError(404, "NOT_FOUND", "진행 중인 요청을 찾을 수 없습니다.");
    return NextResponse.json(progress, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[ai-progress]", e);
    return apiError(500, "INTERNAL", "진행 상황을 읽지 못했습니다.");
  }
}
