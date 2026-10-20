/** AI 실행 기록의 모양과 표기 — 관리자 화면(클라이언트 부품 포함)이 같이 쓴다. 읽기는 lib/ai/runs.ts */

/** supabase/migrations/0008_ai.sql — AI 실행 한 번 */
export type AiRunRow = {
  id: string;
  project_id: string;
  user_id: string;
  request_id: string | null;
  task: "build" | "edit" | "bug";
  status: "running" | "applied" | "asked" | "handoff" | "error" | "refused" | "skipped";
  model: string | null;
  prompt_version: string;
  effort: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  applied: { changes?: { kind: string; key: string; path?: string; before: string; after: string }[]; rejected?: string[] } | null;
  usage: { input: number; output: number; cacheWrite: number; cacheRead: number } | null;
  tokens_billed: number;
  cost_usd: number | string;
  duration_ms: number | null;
  design_version_before: number | null;
  design_version_after: number | null;
  error: string | null;
  review: "good" | "bad" | "fixed" | null;
  review_note: string | null;
  created_at: string;
  finished_at: string | null;
};

export const RUN_STATUS: Record<AiRunRow["status"], { label: string; tone: "gray" | "blue" | "sky" | "dark" | "red" }> = {
  running: { label: "처리 중", tone: "sky" },
  applied: { label: "반영", tone: "dark" },
  asked: { label: "질문", tone: "blue" },
  handoff: { label: "담당자에게", tone: "gray" },
  error: { label: "실패", tone: "red" },
  refused: { label: "안전 거절", tone: "red" },
  skipped: { label: "건너뜀", tone: "gray" },
};
