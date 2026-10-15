"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSubscription, requireUser } from "@/lib/auth/session";
import { isMissingSchema } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  page_id: z.uuid(),
  device: z.enum(["mobile", "tablet", "desktop"]),
  kind: z.enum(["ai", "expert", "bug"]),
  seq: z.number().int().min(1).max(999),
  region: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
  message: z.string().trim().min(1, "요청사항을 입력하세요").max(2000),
});

export type SubmitResult = { ok: true; batchId: string; count: number } | { ok: false; error: string };

/**
 * "요청하기". 네모 하나 = 요청 하나 (seq 로 번호가 붙는다). 실제 삽입·한도 검사·크레딧 차감은
 * DB 함수 submit_change_requests 가 한 트랜잭션으로 처리한다.
 * 여기서는 입력 검증, 플랜 존재 확인, 플랜 상수(월 AI 토큰·주간 전문가 한도) 전달만 한다.
 */
export async function submitRequestsAction(projectId: string, rawItems: unknown): Promise<SubmitResult> {
  const user = await requireUser();
  const parsed = z.array(itemSchema).min(1).max(100).safeParse(rawItems);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "요청 내용을 확인하세요." };

  const { plan } = await getSubscription(user.id);
  if (!plan) return { ok: false, error: "플랜이 있어야 요청을 보낼 수 있습니다. 플랜을 먼저 선택하세요." };

  // 플랜이 허용하지 않는 디바이스 요청은 거부 (UI 우회 방지)
  if (parsed.data.some((i) => !plan.devices.includes(i.device))) {
    return { ok: false, error: `${plan.name} 플랜에서 지원하지 않는 화면이 포함되어 있습니다.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_change_requests", {
    p_project_id: projectId,
    p_items: parsed.data,
    p_monthly_ai_tokens: plan.monthlyAiTokens,
    p_weekly_expert: plan.weeklyExpert,
  });

  if (error) {
    const m = error.message;
    if (m.includes("AI_TOKENS_EXHAUSTED")) return { ok: false, error: "이번 달 토큰을 모두 썼습니다. 토큰 크레딧을 구매하거나 다음 결제 기간에 다시 요청하세요." };
    if (m.includes("QUOTA_EXCEEDED_EXPERT")) return { ok: false, error: `전문가 요청 주간 한도를 넘었고 크레딧이 ${m.split(":")[1] ?? ""}건 부족합니다.` };
    if (m.includes("PROJECT_NOT_FOUND")) return { ok: false, error: "프로젝트를 찾을 수 없습니다." };
    return { ok: false, error: m };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, batchId: data as string, count: parsed.data.length };
}

export type MessageResult = { ok: true } | { ok: false; error: string };

const messageSchema = z.object({
  projectId: z.uuid(),
  requestId: z.uuid().nullable(),
  body: z.string().trim().min(1, "내용을 입력하세요.").max(2000, "2,000자까지 보낼 수 있습니다."),
});

/**
 * 담당자에게 글 보내기. requestId 가 있으면 그 요청(네모)의 대화, null 이면 사이트 전체에 대한 메시지.
 * 토큰·횟수는 차감하지 않는다. 소유자 확인 · 도배 방지 · "확인 필요" 해제는 DB 함수 post_message 가 한다.
 */
export async function postMessageAction(projectId: string, requestId: string | null, body: string): Promise<MessageResult> {
  await requireUser();
  const parsed = messageSchema.safeParse({ projectId, requestId, body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "내용을 확인하세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_message", { p_project_id: parsed.data.projectId, p_request_id: parsed.data.requestId, p_body: parsed.data.body });
  if (error) {
    const m = error.message;
    if (isMissingSchema(error)) return { ok: false, error: "대화 기능을 아직 쓸 수 없습니다. 잠시 후 다시 시도해 주세요." };
    if (m.includes("TOO_MANY_MESSAGES")) return { ok: false, error: "짧은 시간에 너무 많이 보냈습니다. 1분 뒤에 다시 보내 주세요." };
    if (m.includes("PROJECT_NOT_FOUND") || m.includes("REQUEST_NOT_FOUND")) return { ok: false, error: "보낼 곳을 찾을 수 없습니다. 화면을 새로 고쳐 주세요." };
    return { ok: false, error: "보내지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/${parsed.data.requestId ? "requests" : "messages"}`);
  return { ok: true };
}

/**
 * 화면에 보여준 담당자 글을 읽음으로 표시한다. 다시 그리지 않는다 — 이번 방문 동안은 "새 글" 표시가 남아 있어야 한다.
 * 내 사이트의 담당자 글만 바뀐다 (DB 함수 mark_messages_read 가 확인).
 */
export async function markMessagesReadAction(ids: string[]): Promise<void> {
  await requireUser();
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("mark_messages_read", { p_ids: parsed.data });
}
