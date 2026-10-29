import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SITE_DB_BUILD_WAIT_MS,
  SITE_DB_NAME_PREFIX,
  SITE_DB_POLL_MS,
  SITE_DB_REGION_DEFAULT,
  SITE_DB_STALE_CREATING_MS,
} from "@/config/site-db";
import { planSchemaSync, toSqlScript, type Collection, type SchemaSnapshot } from "@/lib/collections";
import { encryptSecret } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { isMissingSchema } from "@/lib/messages";
import { ManagementError, explainManagementError, management } from "@/lib/site-db/management";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 사이트 전용 Supabase 프로젝트 — 만들기 · 준비 확인 · 표 맞추기 (0011_site_db.sql).
 *
 *   creating      만들기를 맡았다 (관리 API 에 요청하는 중)
 *   provisioning  프로젝트가 생겼고 켜지기를 기다린다 (보통 1~3분)
 *   ready         키까지 받아 쓸 수 있다
 *   failed        만들지 못했다 (error 에 이유) — 담당자가 관리자 화면에서 다시 시도한다
 *
 * 누가 만드나: 사이트를 만들 때(플랜의 siteDatabase · 백그라운드), AI 가 관리자 목록을 처음 만들 때, 관리자 페이지를 열었는데 목록이 있을 때, 담당자.
 * 여러 곳에서 동시에 불러도 프로젝트는 하나만 만든다 (site_databases.project_id 유일 + 조건부 갱신으로 "만들기" 를 한 곳만 맡는다).
 * 만들다 끊기면 다음 시도에서 이름(pf-<사이트 id 앞 8자리>-…)으로 이미 생긴 프로젝트를 찾아 이어서 쓴다 — 같은 사이트에 프로젝트가 두 개 생겨 돈이 새지 않게.
 * 쓰기는 모두 service role 이다. 비밀 키 · DB 비밀번호는 APP_ENCRYPTION_KEY 로 암호화해 둔다.
 */

type Admin = SupabaseClient;

export type SiteDbStatus = "creating" | "provisioning" | "ready" | "failed" | "deleted";

export type SiteDbRow = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  status: SiteDbStatus;
  ref: string | null;
  region: string | null;
  api_url: string | null;
  publishable_key: string | null;
  secret_key_enc: string | null;
  db_pass_enc: string | null;
  schema: SchemaSnapshot | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
};

export type SiteDbInfo = {
  /** 0011 이 적용됐는지 */
  available: boolean;
  /** 토큰 · 암호화 키가 있어 만들 수 있는지 */
  configured: boolean;
  status: SiteDbStatus | "none";
  ref: string | null;
  region: string | null;
  error: string | null;
  createdAt: string | null;
  readyAt: string | null;
  schema: SchemaSnapshot;
  dashboardUrl: string | null;
};

const NONE: SiteDbInfo = { available: true, configured: true, status: "none", ref: null, region: null, error: null, createdAt: null, readyAt: null, schema: {}, dashboardUrl: null };

/** 사이트 프로젝트를 만들 수 있는 설정인지. 없는 값 이름을 돌려준다 (관리자 화면 안내) */
export function siteDbConfigured(): { ok: boolean; missing: string[] } {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.SUPABASE_ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!env.APP_ENCRYPTION_KEY || env.APP_ENCRYPTION_KEY.length < 32) missing.push("APP_ENCRYPTION_KEY");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return { ok: missing.length === 0 && env.SITE_DB !== "off", missing };
}

export function dashboardUrl(ref: string): string {
  return `https://supabase.com/dashboard/project/${ref}`;
}

function toInfo(row: SiteDbRow | null, configured: boolean): SiteDbInfo {
  if (!row) return { ...NONE, configured };
  return {
    available: true,
    configured,
    status: row.status,
    ref: row.ref,
    region: row.region,
    error: row.error,
    createdAt: row.created_at,
    readyAt: row.ready_at,
    schema: row.schema ?? {},
    dashboardUrl: row.ref ? dashboardUrl(row.ref) : null,
  };
}

async function loadRow(admin: Admin, projectId: string): Promise<SiteDbRow | null | "missing"> {
  const { data, error } = await admin.from("site_databases").select("*").eq("project_id", projectId).maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return "missing";
    throw new Error(`site_databases 읽기 실패: ${error.message}`);
  }
  return (data as SiteDbRow | null) ?? null;
}

async function patchRow(admin: Admin, id: string, patch: Partial<SiteDbRow>): Promise<void> {
  const { error } = await admin
    .from("site_databases")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[site-db] update", error.message);
}

/** 이 사이트의 프로젝트 상태 (화면 · 엔진). 0011 전이면 available=false */
export async function getSiteDatabase(projectId: string, admin: Admin = createAdminClient()): Promise<SiteDbInfo> {
  const configured = siteDbConfigured().ok;
  const row = await loadRow(admin, projectId);
  if (row === "missing") return { ...NONE, available: false, configured };
  return toInfo(row, configured);
}

/** 만들 조직: SUPABASE_SITES_ORG → 앱 메인 프로젝트가 있는 조직 → 토큰으로 보이는 첫 조직 (조직이 여러 개일 때 엉뚱한 곳에 만들지 않게) */
let cachedOrg: string | null = null;
async function orgSlug(): Promise<string> {
  const env = getServerEnv();
  if (env.SUPABASE_SITES_ORG) return env.SUPABASE_SITES_ORG;
  if (cachedOrg) return cachedOrg;
  const mainRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1];
  if (mainRef) {
    try {
      cachedOrg = (await management.project(mainRef)).organization_slug || null;
    } catch (e) {
      console.error("[site-db] main project org", e);
    }
  }
  if (!cachedOrg) {
    const orgs = await management.organizations();
    if (!orgs.length) throw new ManagementError(0, "토큰으로 볼 수 있는 Supabase 조직이 없습니다.");
    cachedOrg = orgs[0].slug;
  }
  return cachedOrg;
}

/** 대시보드에 보일 이름: pf-<사이트 id 앞 8자리>-<영문 이름> (한글 이름이면 site) */
function projectNameOf(projectId: string, siteName: string): string {
  const ascii = siteName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${SITE_DB_NAME_PREFIX}${projectId.slice(0, 8)}-${ascii || "site"}`;
}

const isStaleCreating = (row: SiteDbRow) => row.status === "creating" && Date.now() - new Date(row.updated_at).getTime() > SITE_DB_STALE_CREATING_MS;

/**
 * "만들기" 를 맡는다. 처음이면 행을 넣고, 실패했거나 만들다 끊긴 행이면 조건부로 되살린다. 다른 곳이 이미 맡았으면 null.
 * 이미 프로젝트(ref)가 있는 실패 행은 새로 만들지 않고 준비 확인부터 다시 한다.
 */
async function claim(admin: Admin, projectId: string, name: string): Promise<SiteDbRow | null> {
  const { data, error } = await admin.from("site_databases").insert({ project_id: projectId, project_name: name, status: "creating", attempts: 1 }).select("*").single();
  if (!error && data) return data as SiteDbRow;
  if (error && error.code !== "23505") throw new Error(`site_databases 넣기 실패: ${error.message}`);
  const row = await loadRow(admin, projectId);
  if (!row || row === "missing") return null;
  if (!(row.status === "failed" || isStaleCreating(row))) return null;
  const next: Partial<SiteDbRow> = row.ref ? { status: "provisioning", error: null } : { status: "creating", error: null };
  const { data: took } = await admin
    .from("site_databases")
    .update({ ...next, attempts: row.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", row.status)
    .eq("updated_at", row.updated_at)
    .select("*")
    .maybeSingle();
  if (!took) return null;
  return row.ref ? null : (took as SiteDbRow);
}

/** 관리 API 로 프로젝트를 만든다 (같은 이름의 프로젝트가 이미 있으면 그것을 쓴다) */
async function create(admin: Admin, row: SiteDbRow, projectId: string, name: string): Promise<void> {
  try {
    const prefix = `${SITE_DB_NAME_PREFIX}${projectId.slice(0, 8)}-`;
    const existing = (await management.projects()).find((p) => p.name.startsWith(prefix) && p.status !== "REMOVED" && p.status !== "GOING_DOWN");
    let ref: string;
    let region: string;
    let dbPassEnc: string | null = null;
    if (existing) {
      ref = existing.ref;
      region = existing.region;
    } else {
      const dbPass = randomBytes(24).toString("base64url");
      const created = await management.createProject({
        name,
        organization_slug: await orgSlug(),
        db_pass: dbPass,
        region_selection: { type: "specific", code: getServerEnv().SUPABASE_SITES_REGION || SITE_DB_REGION_DEFAULT },
      });
      ref = created.ref;
      region = created.region;
      dbPassEnc = encryptSecret(dbPass);
    }
    await patchRow(admin, row.id, { status: "provisioning", ref, region, api_url: `https://${ref}.supabase.co`, ...(dbPassEnc ? { db_pass_enc: dbPassEnc } : {}), error: null });
  } catch (e) {
    console.error("[site-db] create", e);
    await patchRow(admin, row.id, { status: "failed", error: explainManagementError(e) });
  }
}

/** 켜지는 중인 프로젝트를 확인한다: 켜졌으면 키를 받아 ready 로. 아직이면 그대로 */
async function advance(admin: Admin, row: SiteDbRow): Promise<void> {
  if (row.status !== "provisioning" || !row.ref) return;
  try {
    const p = await management.project(row.ref);
    if (p.status === "INIT_FAILED" || p.status === "REMOVED" || p.status === "GOING_DOWN") {
      await patchRow(admin, row.id, { status: "failed", error: `프로젝트 상태 ${p.status}` });
      return;
    }
    if (p.status !== "ACTIVE_HEALTHY") return;
    const health = await management.health(row.ref);
    if (!health.length || health.some((h) => h.status !== "ACTIVE_HEALTHY")) return;
    const keys = await management.apiKeys(row.ref);
    const secret = keys.find((k) => k.type === "secret" && k.api_key)?.api_key ?? keys.find((k) => k.name === "service_role" && k.api_key)?.api_key;
    const publishable = keys.find((k) => k.type === "publishable" && k.api_key)?.api_key ?? keys.find((k) => k.name === "anon" && k.api_key)?.api_key ?? null;
    if (!secret) return;
    // SQL 이 실제로 도는지 한 번 확인한다 (표를 만들 수 있어야 쓸 수 있다)
    await management.query(row.ref, "select 1");
    await patchRow(admin, row.id, { status: "ready", secret_key_enc: encryptSecret(secret), publishable_key: publishable, ready_at: new Date().toISOString(), error: null });
  } catch (e) {
    if (e instanceof ManagementError && e.status === 404) {
      await patchRow(admin, row.id, { status: "failed", error: "Supabase 에서 프로젝트를 찾을 수 없습니다 (지워졌을 수 있어요)." });
      return;
    }
    // 켜지는 동안의 일시적인 실패는 기록만 하고 다음 확인에서 다시 본다
    await patchRow(admin, row.id, { error: explainManagementError(e) });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 프로젝트가 없으면 만들고, 켜지는 중이면 waitMs 동안 확인하며 기다린다. 설정이 없거나 0011 전이면 아무것도 하지 않는다.
 * 플랜 확인은 부르는 쪽이 한다 (만들면 매달 비용이 든다).
 */
export async function ensureSiteDatabase(projectId: string, opts: { waitMs?: number } = {}): Promise<SiteDbInfo> {
  const configured = siteDbConfigured();
  const admin = createAdminClient();
  let row = await loadRow(admin, projectId);
  if (row === "missing") return { ...NONE, available: false, configured: configured.ok };
  if (!configured.ok) return toInfo(row, false);

  if (!row || row.status === "failed" || isStaleCreating(row)) {
    const { data: project } = await admin.from("projects").select("name").eq("id", projectId).maybeSingle();
    if (!project) return toInfo(row, true);
    const name = projectNameOf(projectId, String(project.name ?? ""));
    const claimed = await claim(admin, projectId, name);
    if (claimed) await create(admin, claimed, projectId, name);
  }

  const deadline = Date.now() + (opts.waitMs ?? 0);
  for (;;) {
    row = await loadRow(admin, projectId);
    if (!row || row === "missing") return { ...NONE, available: row !== "missing" };
    if (row.status === "provisioning") {
      await advance(admin, row);
      row = (await loadRow(admin, projectId)) as SiteDbRow | null;
      if (!row) return NONE;
    }
    if (row.status === "ready" || row.status === "failed" || row.status === "deleted" || Date.now() + SITE_DB_POLL_MS > deadline) return toInfo(row, true);
    await sleep(SITE_DB_POLL_MS);
  }
}

/** 사이트를 만든 뒤 백그라운드(after)에서 부른다. 실패해도 사이트 만들기에는 영향이 없다 (상태에 이유가 남는다) */
export async function startSiteDatabase(projectId: string): Promise<void> {
  try {
    if (!siteDbConfigured().ok) return;
    await ensureSiteDatabase(projectId, { waitMs: SITE_DB_BUILD_WAIT_MS });
  } catch (e) {
    console.error("[site-db] start", e);
  }
}

/** 두 표 목록을 합친다 (동시에 맞춘 경우 서로의 표 · 칸을 지우지 않게) */
function mergeSnapshots(a: SchemaSnapshot, b: SchemaSnapshot): SchemaSnapshot {
  const out: SchemaSnapshot = Object.fromEntries(Object.entries(a).map(([t, cols]) => [t, { ...cols }]));
  for (const [t, cols] of Object.entries(b)) out[t] = { ...(out[t] ?? {}), ...cols };
  return out;
}

export type SyncResult = { ok: true; changed: boolean } | { ok: false; reason: string };

/**
 * 관리자 목록 정의에 맞게 사이트 DB 에 표 · 칸을 만든다 (없는 것만 · 지우지 않는다). 프로젝트가 켜지는 중이면 waitMs 동안 기다린다.
 * 실행한 SQL 은 성공 · 실패 모두 site_db_changes 에 남긴다.
 */
export async function syncSiteSchema(
  projectId: string,
  collections: Collection[],
  opts: { source: "ai" | "admin" | "system"; requestId?: string | null; runId?: string | null; waitMs?: number },
): Promise<SyncResult> {
  if (!siteDbConfigured().ok) return { ok: false, reason: "사이트 데이터 저장소를 만들 설정이 없습니다 (SUPABASE_ACCESS_TOKEN)." };
  const info = await ensureSiteDatabase(projectId, { waitMs: opts.waitMs });
  if (!info.available) return { ok: false, reason: "0011_site_db.sql 이 아직 실행되지 않았습니다." };
  if (info.status !== "ready") {
    return { ok: false, reason: info.status === "failed" ? `데이터 저장소를 만들지 못했습니다: ${info.error ?? "이유 모름"}` : "데이터 저장소를 아직 준비하고 있습니다." };
  }
  const admin = createAdminClient();
  const row = await loadRow(admin, projectId);
  if (!row || row === "missing" || !row.ref) return { ok: false, reason: "데이터 저장소 정보를 찾을 수 없습니다." };

  const plan = planSchemaSync(collections, row.schema ?? {});
  if (!plan.statements.length) return { ok: true, changed: false };
  const sql = toSqlScript(plan.statements);
  const log = async (ok: boolean, error: string | null) => {
    const { error: e } = await admin.from("site_db_changes").insert({
      project_id: projectId,
      site_database_id: row.id,
      source: opts.source,
      request_id: opts.requestId ?? null,
      ai_run_id: opts.runId ?? null,
      statements: sql,
      ok,
      error,
    });
    if (e) console.error("[site-db] change log", e.message);
  };
  try {
    await management.query(row.ref, sql);
  } catch (e) {
    const reason = explainManagementError(e);
    await log(false, reason);
    return { ok: false, reason: `표를 만들지 못했습니다: ${reason}` };
  }
  const fresh = await loadRow(admin, projectId);
  const base = fresh && fresh !== "missing" ? (fresh.schema ?? {}) : (row.schema ?? {});
  await patchRow(admin, row.id, { schema: mergeSnapshots(base, plan.next) });
  await log(true, null);
  return { ok: true, changed: true };
}
