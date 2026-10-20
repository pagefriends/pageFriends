import { AI_QUEUE_MINUTES } from "@/config/ai";
import { BUG_HOURS, EXPERT_HOURS, type RequestKind } from "@/config/plans";
import type { ProjectStatus, RequestStatus } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

/** 요청 상태·종류의 화면 표기. 사용자 화면과 관리자 화면이 같은 말을 쓰도록 한 곳에 둔다. */
type Tone = "gray" | "blue" | "sky" | "dark" | "red";

/**
 * 상태는 사람이 고르기보다 일에 따라 저절로 바뀐다:
 *   접수(pending) → 담당자가 요청을 열면 확인 완료(processing) → 답변을 보내면 답변 완료(done).
 *   반영할 수 없으면 반영 불가(rejected). 관리자는 예외일 때만 콤보로 직접 고친다.
 * 종류를 알 때는 requestStatus(kind, status) 를 쓴다 — AI 반영은 사람이 확인하는 단계 없이 바로 진행된다.
 */
export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "접수", tone: "blue" },
  processing: { label: "확인 완료", tone: "sky" },
  done: { label: "답변 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

/**
 * AI 반영은 요청하면 바로 AI 차례다: 접수(pending) = "AI 진행 중" (AI 가 처리하거나, 질문해 두고 답을 기다림),
 * AI 가 맡지 못해 담당자에게 넘기면 processing = "담당자 확인 중", 끝나면 "반영 완료" (lib/ai/engine.ts).
 */
const AI_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "AI 진행 중", tone: "sky" },
  processing: { label: "담당자 확인 중", tone: "blue" },
  done: { label: "반영 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

/**
 * 오류 신고: AI 가 먼저 확인한다 — 접수(pending) = "확인 중" (AI · 담당자가 보는 중), 사람이 필요하면 processing = "담당자 확인 중"
 * (메일 · 문자로 알리고 BUG_HOURS 안에 고친다), 고치면 "고침 완료".
 */
const BUG_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "확인 중", tone: "sky" },
  processing: { label: "담당자 확인 중", tone: "blue" },
  done: { label: "고침 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

export function requestStatus(kind: RequestKind, status: RequestStatus): { label: string; tone: Tone } {
  return kind === "ai" ? AI_STATUS[status] : kind === "bug" ? BUG_STATUS[status] : REQUEST_STATUS[status];
}

/** 위저드 · 편집기의 "AI 이미지 생성" 요청 (lib/site-plan.ts 가 만든다). Claude 는 이미지를 만들지 않으므로 담당자가 처리한다 */
export function isImageRequest(message: string): boolean {
  return message.startsWith("[AI 이미지 생성]");
}

/**
 * 지금 AI 가 맡고 있는 요청인지 (편집기의 "AI 처리 중 N건" · "AI 작업 중" 화면 · 새 화면 확인).
 * AI 반영과 오류 신고(AI 가 먼저 확인한다)가 AI 차례(접수 · 사용자 답을 기다리지 않음)이고 요청한 지 AI_QUEUE_MINUTES 안 —
 * 그보다 오래된 접수는 담당자가 이어서 맡는다. AI 키가 없으면 부르는 쪽에서 쓰지 않는다 (원래 담당자 몫).
 */
export function isAiWorking(
  r: { kind: RequestKind; status: RequestStatus; awaiting_user?: boolean | null; message: string; created_at: string },
  now = Date.now(),
): boolean {
  return (
    (r.kind === "ai" || r.kind === "bug") &&
    r.status === "pending" &&
    !r.awaiting_user &&
    !isImageRequest(r.message) &&
    now - new Date(r.created_at).getTime() < AI_QUEUE_MINUTES * 60_000
  );
}

export const REQUEST_KIND_TONE: Record<RequestKind, "gray" | "sky" | "red"> = { ai: "gray", expert: "sky", bug: "red" };

/** 요청 종류별 처리 방식 안내 (편집기 요청 카드 · 요청 내역) */
export const REQUEST_KIND_PROMISE: Record<RequestKind, string> = {
  ai: "요청하면 AI가 바로 진행해요 · 토큰 사용",
  expert: `전문가가 ${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간(${EXPERT_HOURS.min / 24}~${EXPERT_HOURS.max / 24}일) 안에 답변해요`,
  bug: `무료 · AI가 바로 확인하고, 사람이 필요하면 담당자가 ${BUG_HOURS}시간 안에 고쳐요`,
};

/** 담당자가 글 없이 상태만 바꿨을 때 대화에 보이는 문장 */
export const STATUS_EVENT_TEXT: Record<RequestStatus, string> = {
  pending: "접수 상태로 되돌렸습니다.",
  processing: "담당자가 요청을 확인했습니다.",
  done: "처리를 마쳤습니다.",
  rejected: "반영할 수 없는 요청으로 처리했습니다.",
};

/** 아직 끝나지 않은 요청 (접수 · 확인 완료) */
export function isOpenStatus(status: RequestStatus): boolean {
  return status === "pending" || status === "processing";
}

/** 사람이 답해야 하는 요청 (전문가 요청 · 오류 신고). 답변 기한이 있다 */
export function needsPerson(kind: RequestKind): boolean {
  return kind !== "ai";
}

/** 사람이 맡는 일의 답변 기한 (시간): 오류 신고 24 · 그 밖(전문가 요청 · 전문가 첫 제작) 72 */
export function dueHours(kind: RequestKind = "expert"): number {
  return kind === "bug" ? BUG_HOURS : EXPERT_HOURS.max;
}

/** 사람이 맡는 일의 답변 기한 = 만든 시각 + dueHours */
export function expertDueAt(createdAt: string, kind: RequestKind = "expert"): Date {
  return new Date(new Date(createdAt).getTime() + dueHours(kind) * 3_600_000);
}

/** "10월 18일 오후 03:10까지" */
export function dueLabel(createdAt: string, kind: RequestKind = "expert"): string {
  return `${formatDateTime(expertDueAt(createdAt, kind).toISOString())}까지`;
}

/** 관리자용 남은 시간: "답변 기한 31시간 남음" · "답변 기한 5시간 지남" (서버 화면에서 그릴 때의 시각 기준) */
export function remainingLabel(createdAt: string, kind: RequestKind = "expert", now: number = Date.now()): { text: string; late: boolean } {
  const hours = Math.round((expertDueAt(createdAt, kind).getTime() - now) / 3_600_000);
  return hours >= 0 ? { text: `답변 기한 ${hours}시간 남음`, late: false } : { text: `답변 기한 ${-hours}시간 지남`, late: true };
}

/**
 * 프로젝트 상태. 만들면 "제작 중", 담당자가 "제작 완료" 를 누르면 "제작 완료".
 * 완료 뒤에 새 수정 요청이 오면 "수정 반영 중" 이 되고, 요청을 모두 처리하면 다시 "제작 완료" 로 돌아간다.
 */
export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" }> = {
  brief: { label: "정보 입력 중", tone: "gray" },
  building: { label: "제작 중", tone: "blue" },
  review: { label: "수정 반영 중", tone: "sky" },
  live: { label: "제작 완료", tone: "dark" },
};
