import "server-only";

import { SITE_DB_PAGE_ROWS } from "@/config/site-db";
import { isValidKey, sameColumn, type CellValue, type Collection, type CollectionRow, type SchemaSnapshot } from "@/lib/collections";
import { decryptSecret } from "@/lib/crypto";
import { isMissingSchema } from "@/lib/messages";
import type { SiteDbRow } from "@/lib/site-db/provision";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 사이트 DB 의 관리자 목록 읽기 · 쓰기 (관리자 페이지 · 초안 그림). 사이트 프로젝트의 Data API(PostgREST)를 비밀 키로 부른다 — 서버에서만.
 * 부르는 쪽이 사이트 주인인지(또는 관리자인지) · 플랜을 먼저 확인한다.
 * 표 · 칸은 실제로 만든 것(site_databases.schema)만 쓴다: 디자인 문서는 사이트 주인이 직접 고칠 수도 있어서 그것만 믿지 않는다.
 */

type Creds = { url: string; key: string; schema: SchemaSnapshot };

async function credentials(projectId: string): Promise<Creds | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("site_databases").select("status, api_url, secret_key_enc, schema").eq("project_id", projectId).maybeSingle();
  if (error) {
    if (!isMissingSchema(error)) console.error("[site-db] credentials", error.message);
    return null;
  }
  const row = data as Pick<SiteDbRow, "status" | "api_url" | "secret_key_enc" | "schema"> | null;
  if (!row || row.status !== "ready" || !row.api_url || !row.secret_key_enc) return null;
  return { url: row.api_url, key: decryptSecret(row.secret_key_enc), schema: row.schema ?? {} };
}

/** 새 비밀 키(sb_secret_…)는 apikey 머리글만, 예전 service_role 키(JWT)는 Authorization 도 함께 보낸다 */
function headers(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), ...extra };
}

/** 실제로 만든 표 · 칸만 남긴 정의 (없는 칸은 빠진다) */
function existingOnly(c: Collection, schema: SchemaSnapshot): Collection | null {
  const cols = schema[c.key];
  if (!cols || !isValidKey(c.key)) return null;
  const fields = c.fields.filter((f) => cols[f.key] && sameColumn(cols[f.key], f.type));
  return fields.length ? { ...c, fields } : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rest(creds: Creds, method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, timeoutMs = 8_000): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${creds.url}/rest/v1/${path}`, {
      method,
      headers: headers(creds.key, { "Content-Type": "application/json", Prefer: "return=representation" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${res.status} ${text.slice(0, 300)}` };
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type RowsResult = { ok: true; rows: CollectionRow[]; collection: Collection } | { ok: false; error: string };

/** 목록 한 쪽 (순서 → 최근 순). onlyPublished = 초안 그림처럼 공개된 줄만 */
export async function listRows(projectId: string, c: Collection, opts: { limit?: number; onlyPublished?: boolean; timeoutMs?: number } = {}): Promise<RowsResult> {
  const creds = await credentials(projectId);
  if (!creds) return { ok: false, error: "데이터 저장소가 아직 준비되지 않았어요." };
  const col = existingOnly(c, creds.schema);
  if (!col) return { ok: false, error: "이 목록의 표가 아직 없어요." };
  const select = ["id", "created_at", "updated_at", "published", "sort", ...col.fields.map((f) => f.key)].join(",");
  const limit = Math.min(Math.max(1, opts.limit ?? SITE_DB_PAGE_ROWS), 200);
  const filter = opts.onlyPublished ? "&published=eq.true" : "";
  const res = await rest(creds, "GET", `${col.key}?select=${select}${filter}&order=sort.asc,created_at.desc&limit=${limit}`, undefined, opts.timeoutMs);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, rows: (res.data as CollectionRow[]) ?? [], collection: col };
}

export type WriteResult = { ok: true } | { ok: false; error: string };

/** 새 줄 · 고치기. values 는 coerceRow 를 거친 값 */
export async function saveRow(
  projectId: string,
  c: Collection,
  rowId: string | null,
  values: Record<string, CellValue>,
  meta: { published: boolean; sort: number },
): Promise<WriteResult> {
  const creds = await credentials(projectId);
  if (!creds) return { ok: false, error: "데이터 저장소가 아직 준비되지 않았어요." };
  const col = existingOnly(c, creds.schema);
  if (!col) return { ok: false, error: "이 목록의 표가 아직 없어요." };
  const body: Record<string, CellValue> = { published: meta.published, sort: Math.max(-100000, Math.min(100000, Math.round(meta.sort) || 0)) };
  for (const f of col.fields) if (f.key in values) body[f.key] = values[f.key];
  if (rowId) {
    if (!UUID.test(rowId)) return { ok: false, error: "잘못된 글입니다." };
    const res = await rest(creds, "PATCH", `${col.key}?id=eq.${rowId}`, { ...body, updated_at: new Date().toISOString() });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }
  const res = await rest(creds, "POST", col.key, body);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function deleteRow(projectId: string, c: Collection, rowId: string): Promise<WriteResult> {
  if (!UUID.test(rowId)) return { ok: false, error: "잘못된 글입니다." };
  const creds = await credentials(projectId);
  if (!creds) return { ok: false, error: "데이터 저장소가 아직 준비되지 않았어요." };
  const col = existingOnly(c, creds.schema);
  if (!col) return { ok: false, error: "이 목록의 표가 아직 없어요." };
  const res = await rest(creds, "DELETE", `${col.key}?id=eq.${rowId}`);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/**
 * 초안 그림에 넣을 공개된 줄 (그 페이지의 목록만). 저장소가 준비 전이거나 늦으면 null — 그림은 빈 자리로 그린다.
 * 그림 높이는 줄 수와 상관없이 같다 (lib/draft-render.ts) — 네모 위치가 글을 올릴 때마다 흔들리지 않게.
 */
export async function draftRows(projectId: string, c: Collection, limit: number): Promise<CollectionRow[] | null> {
  try {
    const res = await listRows(projectId, c, { limit, onlyPublished: true, timeoutMs: 2_500 });
    return res.ok ? res.rows : null;
  } catch {
    return null;
  }
}
