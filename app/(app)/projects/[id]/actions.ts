"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { MAX_STYLES, normalizeStyles } from "@/config/design-styles";
import type { RequestKind } from "@/config/plans";
import { isAiWorking, isImageRequest } from "@/config/requests";
import { aiConfigured } from "@/lib/ai/claude";
import { processBatch, resumeAfterAnswer } from "@/lib/ai/engine";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { designOf, isAiPending } from "@/lib/design-doc";
import { isMissingSchema } from "@/lib/messages";
import { submitChangeRequests } from "@/lib/submit-requests";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief } from "@/lib/types/db";

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
  /** 네모를 그린 화면의 디자인 버전 (캡처 주소의 v). 그 사이 디자인이 바뀌었으면 네모 위치가 어긋나므로 받지 않는다 */
  version: z.number().int().min(0).default(0),
  /** AI 반영 네모의 디자인 유형 · 참고 템플릿 (선택) */
  options: z
    .object({
      styles: z.array(z.string().max(20)).max(MAX_STYLES).default([]),
      templateId: z.uuid().nullable().default(null),
    })
    .optional(),
});

export type SubmitResult = { ok: true; batchId: string; count: number; aiStarted: boolean } | { ok: false; error: string; stale?: boolean };

/**
 * "요청하기". 네모 하나 = 요청 하나 (seq 로 번호가 붙는다). 실제 삽입·한도 검사·크레딧 차감은
 * DB 함수 submit_change_requests 가 한 트랜잭션으로 처리한다.
 * 여기서는 입력 검증, 플랜 존재 확인, 플랜 상수(월 AI 토큰·월 전문가 한도) 전달만 한다.
 * AI 키가 있으면 응답 뒤 백그라운드에서 AI 반영 네모를 처리한다 (lib/ai/engine.ts processBatch).
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
  // 네모를 그린 뒤 AI 가 디자인을 바꿨으면(첫 제작 · 앞선 수정) 그림 높이가 달라져 네모가 엉뚱한 곳을 가리킨다
  const { data: project } = await supabase.from("projects").select("brief").eq("id", projectId).maybeSingle();
  if (project?.brief) {
    const version = designOf(project.brief as ProjectBrief).version;
    if (parsed.data.some((i) => i.version !== version)) {
      return { ok: false, stale: true, error: "그사이 AI 가 화면을 새로 바꿨어요. 위의 '새 화면 보기' 를 누른 뒤 네모를 다시 그려 주세요." };
    }
  }

  // DB 함수에는 버전을 넘기지 않는다. 옵션은 AI 반영 네모만 (디자인 유형은 알려진 것만, 순서 유지)
  const items = parsed.data.map(({ page_id, device, kind, seq, region, message, options }) => ({
    page_id,
    device,
    kind,
    seq,
    region,
    message,
    ...(kind === "ai" && options && (options.styles.length || options.templateId) ? { options: { styles: normalizeStyles(options.styles), templateId: options.templateId } } : {}),
  }));
  const { data, error } = await submitChangeRequests(supabase, projectId, items, plan);

  if (error) {
    const m = error.message;
    if (m.includes("AI_TOKENS_EXHAUSTED")) return { ok: false, error: "이번 달 토큰을 모두 썼습니다. 토큰 크레딧을 구매하거나 한도가 다시 채워진 뒤 요청하세요." };
    if (m.includes("QUOTA_EXCEEDED_EXPERT")) return { ok: false, error: `이번 달 전문가 요청 한도를 넘었고 크레딧이 ${m.split(":")[1] ?? ""}건 부족합니다.` };
    if (m.includes("PROJECT_NOT_FOUND")) return { ok: false, error: "프로젝트를 찾을 수 없습니다." };
    if (m.includes("TEMPLATE_NOT_PURCHASED")) return { ok: false, error: "구매한 템플릿만 참고 템플릿으로 붙일 수 있어요." };
    return { ok: false, error: m };
  }

  const batchId = data as string;
  // AI 가 바로 맡는 것: AI 반영(이미지 생성 요청 제외) · 오류 신고(AI 가 먼저 확인). 편집기는 "AI 작업 중" 화면으로 지켜본다
  const aiStarted = aiConfigured() && parsed.data.some((i) => (i.kind === "ai" && !isImageRequest(i.message)) || i.kind === "bug");
  if (aiStarted) after(() => processBatch(batchId));

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, batchId, count: parsed.data.length, aiStarted };
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

  // AI 가 물어본 요청에 답했으면 AI 가 이어서 처리한다 (마지막 AI 실행이 질문이었을 때만)
  const requestIdForAi = parsed.data.requestId;
  if (requestIdForAi && aiConfigured()) after(() => resumeAfterAnswer(requestIdForAi));

  revalidatePath(`/projects/${parsed.data.projectId}/${parsed.data.requestId ? "requests" : "messages"}`);
  return { ok: true };
}

export type AiStatus = { version: number; aiPending: boolean; aiOpen: number };

/**
 * 편집기가 AI 작업이 끝났는지 볼 때 부른다 (몇 초마다). 디자인 버전이 바뀌면 편집기가 "새 화면 보기" 를 띄우고,
 * aiOpen 이 줄면(질문 · 담당자에게 넘김 · 반영) 요청 목록을 새로 읽는다.
 * aiOpen = 지금 AI 가 맡고 있는 AI 반영 네모 수 (config/requests.ts isAiWorking)
 */
export async function aiStatusAction(projectId: string): Promise<AiStatus | null> {
  await requireUser();
  if (!z.uuid().safeParse(projectId).success) return null;
  const supabase = await createClient();
  const [{ data: project }, { data: open }] = await Promise.all([
    supabase.from("projects").select("brief").eq("id", projectId).maybeSingle(),
    supabase.from("change_requests").select("kind, status, awaiting_user, message, created_at").eq("project_id", projectId).eq("kind", "ai").eq("status", "pending").eq("awaiting_user", false).limit(200),
  ]);
  if (!project) return null;
  const design = designOf(project.brief as ProjectBrief);
  type Row = { kind: RequestKind; status: "pending"; awaiting_user: boolean; message: string; created_at: string };
  return {
    version: design.version,
    aiPending: isAiPending(design),
    aiOpen: ((open as Row[] | null) ?? []).filter((r) => isAiWorking(r)).length,
  };
}

export type ReleaseResult = { ok: true } | { ok: false; error: string };

function releaseRevalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/apply`);
  revalidatePath(`/projects/${projectId}/requests`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * "웹사이트에 적용 요청". 끝난 수정(적용 대기)을 모두 실어 담당자에게 보낸다. 담당자가 개발 서버에서 먼저 점검한 뒤 운영에 올린다.
 * 사이트 상태 · 진행 중인 적용 · 실을 수정 여부 검사와 생성은 DB 함수 request_release 가 한 트랜잭션으로 한다.
 */
export async function requestReleaseAction(projectId: string, note: string): Promise<ReleaseResult> {
  const user = await requireUser();
  const parsed = z.object({ projectId: z.uuid(), note: z.string().max(1000, "1,000자까지 남길 수 있습니다.") }).safeParse({ projectId, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "내용을 확인하세요." };

  const { plan } = await getSubscription(user.id);
  if (!plan) return { ok: false, error: "플랜이 있어야 웹사이트에 적용할 수 있습니다. 플랜을 먼저 선택하세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_release", { p_project_id: parsed.data.projectId, p_note: parsed.data.note.trim() });
  if (error) {
    const m = error.message;
    if (isMissingSchema(error)) return { ok: false, error: "웹사이트 적용 기능을 준비하고 있습니다. 잠시 후 다시 시도해 주세요." };
    if (m.includes("SITE_NOT_READY")) return { ok: false, error: "사이트 제작이 끝나면 웹사이트에 적용할 수 있어요." };
    if (m.includes("RELEASE_IN_PROGRESS") || m.includes("releases_one_active_idx")) return { ok: false, error: "이미 웹사이트 적용이 진행 중이에요. 끝나면 다시 요청해 주세요." };
    if (m.includes("NOTHING_TO_APPLY")) return { ok: false, error: "지금 적용할 수정이 없어요. 수정 요청이 끝나면 다시 요청해 주세요." };
    if (m.includes("PROJECT_NOT_FOUND")) return { ok: false, error: "사이트를 찾을 수 없습니다." };
    return { ok: false, error: "요청하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  releaseRevalidate(parsed.data.projectId);
  return { ok: true };
}

/** 적용 요청 취소. 담당자가 개발 서버에 올리기 전에만 된다 (DB 함수 cancel_release 가 확인) */
export async function cancelReleaseAction(projectId: string, releaseId: string): Promise<ReleaseResult> {
  await requireUser();
  const parsed = z.object({ projectId: z.uuid(), releaseId: z.uuid() }).safeParse({ projectId, releaseId });
  if (!parsed.success) return { ok: false, error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_release", { p_release_id: parsed.data.releaseId });
  if (error) {
    if (error.message.includes("CANNOT_CANCEL")) return { ok: false, error: "담당자가 이미 점검을 시작했어요. 취소하려면 담당자에게 메시지를 남겨 주세요." };
    if (error.message.includes("RELEASE_NOT_FOUND")) return { ok: false, error: "적용 요청을 찾을 수 없습니다. 화면을 새로 고쳐 주세요." };
    return { ok: false, error: "취소하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
  releaseRevalidate(parsed.data.projectId);
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
