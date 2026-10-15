import type { RequestKind } from "@/config/plans";
import type { ProjectStatus, RequestStatus } from "@/lib/types/db";

/** 요청 상태·종류의 화면 표기. 사용자 화면과 관리자 화면이 같은 말을 쓰도록 한 곳에 둔다. */
type Tone = "gray" | "blue" | "sky" | "dark" | "red";

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  pending: { label: "접수", tone: "blue" },
  processing: { label: "처리중", tone: "sky" },
  done: { label: "반영 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

export const REQUEST_KIND_TONE: Record<RequestKind, "gray" | "sky" | "red"> = { ai: "gray", expert: "sky", bug: "red" };

/** 담당자가 글 없이 상태만 바꿨을 때 대화에 보이는 문장 */
export const STATUS_EVENT_TEXT: Record<RequestStatus, string> = {
  pending: "접수 상태로 되돌렸습니다.",
  processing: "작업을 시작했습니다.",
  done: "반영을 마쳤습니다.",
  rejected: "반영할 수 없는 요청으로 처리했습니다.",
};

/** 아직 끝나지 않은 요청 (접수 · 처리중) */
export function isOpenStatus(status: RequestStatus): boolean {
  return status === "pending" || status === "processing";
}

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" }> = {
  brief: { label: "정보 입력 중", tone: "gray" },
  building: { label: "제작 중", tone: "blue" },
  review: { label: "수정 반영 중", tone: "sky" },
  live: { label: "운영 중", tone: "dark" },
};
