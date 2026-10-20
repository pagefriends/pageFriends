"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { aiConfigured } from "@/lib/ai/claude";
import { processAiRequest, startSiteBuild } from "@/lib/ai/engine";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AiActionState = { ok: boolean; message: string } | null;

/**
 * 관리자 "AI로 다시 만들기" — 디자인 유형 · 스킬을 바꾼 뒤 결과를 다시 보고 싶을 때. 하루 한도는 보지 않는다(비용 상한은 본다).
 * 몇십 초 걸리므로 바로 돌려주고 뒤에서 처리한다. 실행 기록에 남는다.
 */
export async function rerunBuildAction(projectId: string): Promise<AiActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(projectId).success) return { ok: false, message: "잘못된 요청입니다." };
  if (!aiConfigured()) return { ok: false, message: "AI 키(ANTHROPIC_API_KEY)가 없습니다." };
  after(() => startSiteBuild(projectId, { force: true }));
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, message: "AI 가 다시 만들고 있어요. 1~2분 뒤 새로 고쳐 보세요." };
}

/** 관리자 "AI로 다시 처리" — 끝난 요청도 다시 처리한다 (반영되면 토큰이 더해진다) */
export async function rerunRequestAction(requestId: string): Promise<AiActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(requestId).success) return { ok: false, message: "잘못된 요청입니다." };
  if (!aiConfigured()) return { ok: false, message: "AI 키(ANTHROPIC_API_KEY)가 없습니다." };
  after(() => processAiRequest(requestId, { force: true }));
  revalidatePath(`/admin/requests/${requestId}`);
  return { ok: true, message: "AI 가 다시 처리하고 있어요. 잠시 뒤 새로 고쳐 보세요." };
}

/** AI 결과 평가 — 학습 데이터의 정답 · 오답 표시 (good 잘함 · bad 잘못함 · fixed 담당자가 고쳐서 마무리) */
export async function reviewRunAction(runId: string, review: "good" | "bad" | "fixed" | null, note: string, path: string): Promise<AiActionState> {
  await requireAdmin();
  const parsed = z
    .object({ runId: z.uuid(), review: z.enum(["good", "bad", "fixed"]).nullable(), note: z.string().max(1000) })
    .safeParse({ runId, review, note });
  if (!parsed.success) return { ok: false, message: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_ai_run", { p_run_id: parsed.data.runId, p_review: parsed.data.review, p_note: parsed.data.note });
  if (error) return { ok: false, message: error.message.includes("FORBIDDEN") ? "관리자만 평가할 수 있습니다." : "저장하지 못했습니다." };
  if (path.startsWith("/admin/")) revalidatePath(path);
  return { ok: true, message: "평가를 저장했어요." };
}
