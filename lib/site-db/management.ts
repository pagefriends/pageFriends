import "server-only";

import { getServerEnv } from "@/lib/env";

/**
 * Supabase 관리 API (https://api.supabase.com) — 사이트 전용 프로젝트를 만들고, 상태 · 키를 읽고, 표를 만드는 SQL 을 실행한다.
 * 토큰은 SUPABASE_ACCESS_TOKEN (대시보드 > Account > Access Tokens). 서버에서만 부른다.
 * 범위 제한 토큰(sbp_fc…)이면 리소스는 조직 전체(새로 만드는 프로젝트도 들어가게), 권한은 Full access 로 만든다 — 프로젝트 하나만 고르면 새 프로젝트를 만들 수 없다.
 * 요청 · 응답 형식은 관리 API v1 (OpenAPI https://api.supabase.com/api/v1-json) 을 따른다.
 */

const BASE = "https://api.supabase.com";

export class ManagementError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ManagementError";
  }
}

export type ProjectStatus =
  | "INACTIVE"
  | "ACTIVE_HEALTHY"
  | "ACTIVE_UNHEALTHY"
  | "COMING_UP"
  | "UNKNOWN"
  | "GOING_DOWN"
  | "INIT_FAILED"
  | "REMOVED"
  | "RESTORING"
  | "UPGRADING"
  | "PAUSING"
  | "RESTORE_FAILED"
  | "RESTARTING"
  | "PAUSE_FAILED"
  | "RESIZING";

export type ManagedProject = { ref: string; name: string; region: string; status: ProjectStatus; organization_slug: string; created_at: string };
export type ApiKey = { name: string; api_key: string | null; type: "legacy" | "publishable" | "secret" | null };

function token(): string {
  const t = getServerEnv().SUPABASE_ACCESS_TOKEN;
  if (!t) throw new ManagementError(0, "SUPABASE_ACCESS_TOKEN 이 없습니다 (.env.local).");
  return t;
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token()}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof ManagementError) throw e;
    throw new ManagementError(0, `관리 API 에 연결하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 500);
    try {
      const j = JSON.parse(text) as { message?: string; error?: string; missing_permissions?: unknown };
      message = j.message ?? j.error ?? message;
      // 범위 제한 토큰은 모자란 권한을 알려 준다
      if (Array.isArray(j.missing_permissions) && j.missing_permissions.length) message += ` (모자란 권한: ${j.missing_permissions.join(", ")})`;
    } catch {
      // 글 그대로
    }
    throw new ManagementError(res.status, message || `HTTP ${res.status}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export const management = {
  organizations: () => call<{ slug: string; name: string }[]>("GET", "/v1/organizations"),
  projects: () => call<ManagedProject[]>("GET", "/v1/projects"),
  createProject: (body: { name: string; organization_slug: string; db_pass: string; region_selection: { type: "specific"; code: string } }) =>
    call<ManagedProject>("POST", "/v1/projects", body, 60_000),
  project: (ref: string) => call<ManagedProject>("GET", `/v1/projects/${encodeURIComponent(ref)}`),
  health: (ref: string) => call<{ name: string; status: "COMING_UP" | "ACTIVE_HEALTHY" | "UNHEALTHY" }[]>("GET", `/v1/projects/${encodeURIComponent(ref)}/health?services=db,rest`),
  apiKeys: (ref: string) => call<ApiKey[]>("GET", `/v1/projects/${encodeURIComponent(ref)}/api-keys?reveal=true`),
  /** SQL 실행 (postgres 권한). 표를 만드는 SQL 은 lib/collections.ts planSchemaSync 가 정해진 규칙으로만 만든다 */
  query: (ref: string, sql: string) => call<unknown>("POST", `/v1/projects/${encodeURIComponent(ref)}/database/query`, { query: sql }, 60_000),
};

/** 관리자 화면 · 오류 기록에 남길 짧은 설명 (흔한 실패는 할 일을 같이 적는다) */
export function explainManagementError(e: unknown): string {
  if (!(e instanceof ManagementError)) return e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
  const m = e.message;
  if (e.status === 401) return "관리 API 토큰이 잘못됐거나 만료됐습니다 (SUPABASE_ACCESS_TOKEN).";
  if (e.status === 402 || /free|limit|maximum|exceed/i.test(m)) return `프로젝트를 더 만들 수 없습니다 — 무료 조직은 계정당 2개까지예요. 조직을 Pro 로 올려 주세요. (${m.slice(0, 200)})`;
  if (e.status === 403) return `권한이 없습니다 — 관리 API 토큰을 조직 전체 범위 · Full access 로 다시 만들어 주세요 (프로젝트 하나만 고른 토큰은 새 프로젝트를 만들 수 없어요). (${m.slice(0, 200)})`;
  if (e.status === 429) return "관리 API 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  return `${e.status ? `HTTP ${e.status}: ` : ""}${m.slice(0, 300)}`;
}
