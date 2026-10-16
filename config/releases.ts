import { EXPERT_HOURS } from "@/config/plans";
import { expertDueAt } from "@/config/requests";
import type { ChangeRequestRow, ReleaseRow, ReleaseStatus } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

/**
 * 웹사이트 적용 (개발 서버 → 운영) 의 화면 표기와 규칙. supabase/migrations/0007_releases.sql 과 같은 규칙을 쓴다.
 *
 * 사용자에게는 "배포" 대신 "웹사이트에 적용" 이라고 하고 단계도 셋만 보여 준다: 적용 요청됨 → 점검 중 → 적용 완료.
 * 관리자에게는 실제 단계를 그대로 보여 준다: 개발 서버 배포 전 → (다시 고치는 중) → 개발 서버 확인 중 → 운영 반영 완료.
 * 운영 배포는 개발 서버에서 확인 목록을 모두 체크해야만 할 수 있다 (DB 함수 admin_release_live 가 다시 검사한다).
 */
type Tone = "gray" | "blue" | "sky" | "dark" | "red";

/** 관리자가 보는 단계. requested 인데 개발 서버에 한 번이라도 올렸으면 문제가 있어 "다시 고치는 중" 이다 */
export type ReleaseStage = "new" | "fixing" | "staging" | "live" | "cancelled";

export function releaseStage(r: Pick<ReleaseRow, "status" | "staging_rounds">): ReleaseStage {
  if (r.status === "requested") return r.staging_rounds > 0 ? "fixing" : "new";
  return r.status;
}

export const RELEASE_STAGE_ADMIN: Record<ReleaseStage, { label: string; tone: Tone }> = {
  new: { label: "개발 서버 배포 전", tone: "blue" },
  fixing: { label: "다시 고치는 중", tone: "red" },
  staging: { label: "개발 서버 확인 중", tone: "sky" },
  live: { label: "운영 반영 완료", tone: "dark" },
  cancelled: { label: "취소", tone: "gray" },
};

/** 사용자가 보는 단계. 개발 서버에 올린 뒤로는 문제가 있어 고치는 중이어도 "점검 중" 이다 */
export const RELEASE_STAGE_USER: Record<ReleaseStage, { label: string; tone: Tone }> = {
  new: { label: "적용 요청됨", tone: "blue" },
  fixing: { label: "점검 중", tone: "sky" },
  staging: { label: "점검 중", tone: "sky" },
  live: { label: "적용 완료", tone: "dark" },
  cancelled: { label: "취소됨", tone: "gray" },
};

/** 아직 끝나지 않은 적용 (한 사이트에 하나뿐) */
export function isActiveRelease(status: ReleaseStatus): boolean {
  return status === "requested" || status === "staging";
}

/** 사용자 화면의 세 단계 중 지금 몇 번째인가 (1 적용 요청 · 2 점검 중 · 3 적용 완료) */
export function userStep(r: Pick<ReleaseRow, "status" | "staging_rounds">): 1 | 2 | 3 {
  const s = releaseStage(r);
  return s === "live" ? 3 : s === "new" || s === "cancelled" ? 1 : 2;
}

/** 사람이 맡는 일이라 전문가 요청과 같은 약속 시간 (EXPERT_HOURS) 안에 적용한다 */
export function releaseDueLabel(requestedAt: string): string {
  return `${formatDateTime(expertDueAt(requestedAt).toISOString())}까지`;
}

/** 관리자용 남은 시간: "적용 기한 31시간 남음" · "적용 기한 5시간 지남" */
export function releaseRemaining(requestedAt: string, now: number = Date.now()): { text: string; late: boolean } {
  const hours = Math.round((expertDueAt(requestedAt).getTime() - now) / 3_600_000);
  return hours >= 0 ? { text: `적용 기한 ${hours}시간 남음`, late: false } : { text: `적용 기한 ${-hours}시간 지남`, late: true };
}

export const RELEASE_PROMISE = `담당자가 확인용 서버에서 먼저 점검한 뒤 실제 웹사이트에 적용해요 · ${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간 안에`;

// ----- 개발 서버 확인 목록 -----

/** 고정 항목의 키. 0007 의 admin_release_check · admin_release_live 가 같은 키를 쓴다 */
export type FixedCheck = "site" | "screens" | "db_dev" | "db_prod";

export const CHECK_LABEL: Record<FixedCheck, string> = {
  site: "개발 서버 주소에서 사이트가 열리고, 메뉴의 모든 페이지로 이동된다",
  /** 앞에 화면 이름을 붙여 쓴다: "모바일 · 웹 화면에서 깨지는 곳이 없다" */
  screens: "화면에서 깨지는 곳이 없다",
  db_dev: "개발 DB에 새 항목(컬럼)을 추가했고, 폼을 실제로 보내 새 항목까지 저장되는 것을 확인했다",
  db_prod: "운영 DB에 같은 변경을 먼저 반영했다 (기존 데이터를 백업한 뒤)",
};

/** 실린 수정마다 하나씩: "요청대로 바뀌었다" */
export function requestCheckKey(requestId: string): string {
  return `req:${requestId}`;
}

/** 운영 배포 전에 모두 체크해야 하는 키. 순서는 화면에 보이는 순서 (사이트 → 수정마다 → 화면 → 개발 DB → 운영 DB) */
export function requiredChecks(dbChange: boolean, requestIds: string[]): string[] {
  return ["site", ...requestIds.map(requestCheckKey), "screens", ...(dbChange ? ["db_dev", "db_prod"] : [])];
}

export function remainingChecks(checks: Record<string, boolean>, dbChange: boolean, requestIds: string[]): number {
  return requiredChecks(dbChange, requestIds).filter((k) => !checks[k]).length;
}

/**
 * 폼·DB 구조를 바꾸는 수정처럼 보이는지 (예: "문의하기에 받을 항목을 하나 더 추가"). 관리자에게 "폼·DB 변경 포함" 을
 * 켜 보라고 알려 주는 힌트일 뿐 — 켜고 끄는 것은 담당자가 정한다.
 */
export function looksLikeDataChange(message: string): boolean {
  return /(항목|컬럼|칼럼|필드|입력\s?칸|입력란|양식|DB|데이터베이스)/i.test(message);
}

// ----- 수정 하나의 적용 상태 (요청 내역 · 적용 화면) -----

export type ApplyState = "waiting" | "requested" | "checking" | "applied";

export const APPLY_STATE: Record<ApplyState, { label: string; tone: Tone }> = {
  waiting: { label: "웹사이트 적용 대기", tone: "gray" },
  requested: { label: "적용 요청됨", tone: "blue" },
  checking: { label: "적용 점검 중", tone: "sky" },
  applied: { label: "웹사이트 적용 완료", tone: "dark" },
};

/** 끝난 수정만 적용 상태가 있다. 진행 중 · 반영 불가면 null */
export function applyState(r: Pick<ChangeRequestRow, "status" | "release_id">, releases: Map<string, Pick<ReleaseRow, "status" | "staging_rounds">>): ApplyState | null {
  if (r.status !== "done") return null;
  const rel = r.release_id ? releases.get(r.release_id) : undefined;
  if (!rel) return "waiting";
  const s = releaseStage(rel);
  return s === "live" ? "applied" : s === "new" ? "requested" : s === "cancelled" ? "waiting" : "checking";
}
