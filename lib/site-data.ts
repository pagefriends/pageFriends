import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { SITE_DATA_MAX_ROWS, SITE_DATA_PAGE_ROWS } from "@/config/site-data";
import type { CellValue, Collection, CollectionRow } from "@/lib/collections";
import { isMissingSchema } from "@/lib/messages";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 관리자 목록의 글 읽기 · 쓰기 — 공용 DB 의 site_records 표 (0013_site_records.sql). 모든 사이트가 한 표를 같이 쓰고 project_id 로 나뉜다.
 *
 * 읽기는 부르는 쪽의 클라이언트로 한다: 사이트 주인 · 관리자 화면은 로그인한 사람의 클라이언트를 넘긴다 (RLS 가 사이트 주인 · 관리자만 허락).
 * 쓰기는 서버(service role)만 한다. 부르는 쪽이 사이트 주인인지 · 플랜에 관리자 페이지가 있는지 · 목록이 디자인 문서에 있는지를 먼저 확인한다.
 * service role 은 RLS 를 건너뛰므로 모든 쓰기를 project_id · collection · id 로 묶는다 (다른 사이트의 글을 건드리지 않게).
 * 한 줄의 칸 값은 data(JSON)에 있고, 화면에는 지금 목록 정의에 있는 칸만 꺼내 준다 (목록에서 뺀 칸의 값은 남아 있지만 보이지 않는다).
 */

type Db = SupabaseClient;

type RecordRow = { id: string; created_at: string; updated_at: string; published: boolean; sort: number; data: Record<string, unknown> | null };

const SELECT = "id, created_at, updated_at, published, sort, data";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 글 수를 세는 쿼리. head 요청은 실패해도 오류 내용(코드)이 비어 오므로 한 줄만 읽으며 센다 (표가 없는 것을 알아보게).
 * published = true 면 공개된 글만
 */
function countQuery(db: Db, projectId: string, collection: string, published?: boolean) {
  let q = db.from("site_records").select("id", { count: "exact" }).eq("project_id", projectId).eq("collection", collection);
  if (published) q = q.eq("published", true);
  return q.limit(1);
}

/** 표의 한 행 → 화면의 한 줄 (지금 목록에 있는 칸만 · 자동 칸이 칸 값보다 우선) */
function toRow(c: Collection, r: RecordRow): CollectionRow {
  const data = r.data ?? {};
  const values = Object.fromEntries(c.fields.filter((f) => Object.hasOwn(data, f.key)).map((f) => [f.key, data[f.key]]));
  return { ...values, id: r.id, created_at: r.created_at, updated_at: r.updated_at, published: r.published, sort: r.sort };
}

export type RowsResult = { ok: true; rows: CollectionRow[]; total: number | null } | { ok: false; error: string; missing: boolean };

/**
 * 목록 한 쪽 (순서 → 최근 순). db = 읽는 사람의 클라이언트 (RLS).
 * onlyPublished = 초안 그림처럼 공개된 글만 · withTotal = 전체 글 수도 센다 (관리자 페이지의 쪽 나누기).
 */
export async function listRows(
  db: Db,
  projectId: string,
  c: Collection,
  opts: { limit?: number; offset?: number; onlyPublished?: boolean; withTotal?: boolean } = {},
): Promise<RowsResult> {
  const limit = Math.min(Math.max(1, Math.floor(opts.limit ?? SITE_DATA_PAGE_ROWS)), 200);
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  let q = db
    .from("site_records")
    .select(SELECT, opts.withTotal ? { count: "exact" } : undefined)
    .eq("project_id", projectId)
    .eq("collection", c.key);
  if (opts.onlyPublished) q = q.eq("published", true);
  const { data, error, count } = await q
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    // 글 수보다 뒤쪽을 달라고 하면(지운 뒤 예전 쪽 주소를 연 경우) 빈 쪽으로 보여 준다
    if (error.code === "PGRST103") {
      const { count: total } = await countQuery(db, projectId, c.key);
      return { ok: true, rows: [], total: total ?? null };
    }
    return { ok: false, error: error.message, missing: isMissingSchema(error) };
  }
  return { ok: true, rows: ((data as RecordRow[] | null) ?? []).map((r) => toRow(c, r)), total: opts.withTotal ? (count ?? 0) : null };
}

/**
 * 초안 그림에 넣을 공개된 글 (그 페이지의 목록만). 표가 없거나(0013 전) 읽지 못하면 null — 그림은 빈 자리로 그린다.
 * 그림 높이는 글 수와 상관없이 같다 (lib/draft-render.ts) — 네모 위치가 글을 올릴 때마다 흔들리지 않게.
 */
export async function draftRows(db: Db, projectId: string, c: Collection, limit: number): Promise<CollectionRow[] | null> {
  try {
    const res = await listRows(db, projectId, c, { limit, onlyPublished: true });
    return res.ok ? res.rows : null;
  } catch {
    return null;
  }
}

/** userMessage = 사용자에게 그대로 보여 줄 이유 (없으면 부르는 쪽이 "잠시 뒤 다시" 로 알린다) */
export type WriteResult = { ok: true } | { ok: false; error: string; userMessage?: string };

const clampSort = (n: number) => Math.max(-100000, Math.min(100000, Math.round(n) || 0));

/** 새 글 · 고치기. values 는 coerceRow 를 거친 값. 고칠 때는 목록에서 뺀 칸의 값을 그대로 둔다 */
export async function saveRow(
  projectId: string,
  c: Collection,
  rowId: string | null,
  values: Record<string, CellValue>,
  meta: { published: boolean; sort: number },
): Promise<WriteResult> {
  const admin = createAdminClient();
  const data: Record<string, CellValue> = {};
  for (const f of c.fields) if (Object.hasOwn(values, f.key)) data[f.key] = values[f.key];
  const fields = { published: meta.published, sort: clampSort(meta.sort) };

  if (rowId) {
    if (!UUID.test(rowId)) return { ok: false, error: "bad row id", userMessage: "잘못된 글입니다." };
    const { data: cur, error: readError } = await admin
      .from("site_records")
      .select("data")
      .eq("id", rowId)
      .eq("project_id", projectId)
      .eq("collection", c.key)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (!cur) return { ok: false, error: "row not found", userMessage: "글을 찾을 수 없어요. 이미 지워졌을 수 있어요." };
    const merged = { ...((cur.data as Record<string, unknown> | null) ?? {}), ...data };
    const { error } = await admin
      .from("site_records")
      .update({ ...fields, data: merged, updated_at: new Date().toISOString() })
      .eq("id", rowId)
      .eq("project_id", projectId)
      .eq("collection", c.key);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { count, error: countError } = await countQuery(admin, projectId, c.key);
  if (countError) return { ok: false, error: countError.message };
  if ((count ?? 0) >= SITE_DATA_MAX_ROWS) {
    return { ok: false, error: "row limit", userMessage: `이 목록에는 글을 ${SITE_DATA_MAX_ROWS.toLocaleString("ko-KR")}개까지 올릴 수 있어요. 지난 글을 지운 뒤 올려 주세요.` };
  }
  const { error } = await admin.from("site_records").insert({ ...fields, project_id: projectId, collection: c.key, data });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteRow(projectId: string, c: Collection, rowId: string): Promise<WriteResult> {
  if (!UUID.test(rowId)) return { ok: false, error: "bad row id", userMessage: "잘못된 글입니다." };
  const { error } = await createAdminClient().from("site_records").delete().eq("id", rowId).eq("project_id", projectId).eq("collection", c.key);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type CollectionCounts = { available: boolean; counts: Record<string, { total: number; published: number }> };

/** 목록마다 글 수 (관리자 "제작 정보"). db = 읽는 사람의 클라이언트 (RLS) */
export async function countRows(db: Db, projectId: string, collections: Collection[]): Promise<CollectionCounts> {
  const counts: CollectionCounts["counts"] = {};
  let available = true;
  await Promise.all(
    collections.map(async (c) => {
      const [all, shown] = await Promise.all([countQuery(db, projectId, c.key), countQuery(db, projectId, c.key, true)]);
      if (all.error || shown.error) {
        if (isMissingSchema(all.error) || isMissingSchema(shown.error)) available = false;
        else console.error("[site-data] count", (all.error ?? shown.error)?.message);
        return;
      }
      counts[c.key] = { total: all.count ?? 0, published: shown.count ?? 0 };
    }),
  );
  return { available, counts };
}
