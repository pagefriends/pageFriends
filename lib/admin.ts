import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestRow, ProjectPageRow, ProjectRow, RequestStatus } from "@/lib/types/db";

/**
 * 관리자 화면 데이터 접근. 읽기는 0002_admin.sql 의 "admin select" RLS 정책이 허용하고,
 * 쓰기는 admin_* RPC 만 쓴다 — 관리자가 아니면 DB 가 거부한다.
 */

export type AdminRequestListItem = ChangeRequestRow & {
  project: Pick<ProjectRow, "id" | "name" | "user_id" | "status"> | null;
  page: Pick<ProjectPageRow, "id" | "name" | "path"> | null;
};

export type RequestFilter = { status?: RequestStatus | "open"; kind?: "ai" | "expert"; projectId?: string };

export async function listAdminRequests(filter: RequestFilter, limit = 200): Promise<AdminRequestListItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("change_requests")
    .select("*, project:projects(id, name, user_id, status), page:project_pages(id, name, path)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter.status === "open") q = q.in("status", ["pending", "processing"]);
  else if (filter.status) q = q.eq("status", filter.status);
  if (filter.kind) q = q.eq("kind", filter.kind);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as unknown as AdminRequestListItem[]) ?? [];
}

export type RequestCounts = Record<RequestStatus, number>;

export async function countRequestsByStatus(): Promise<RequestCounts> {
  const supabase = await createClient();
  const counts: RequestCounts = { pending: 0, processing: 0, done: 0, rejected: 0 };
  const { data } = await supabase.from("change_requests").select("status");
  for (const r of (data as { status: RequestStatus }[] | null) ?? []) counts[r.status] += 1;
  return counts;
}

export type AdminRequestDetail = {
  request: ChangeRequestRow;
  project: ProjectRow;
  page: ProjectPageRow;
  ownerEmail: string | null;
  /** 같은 묶음(batch)의 다른 요청 */
  siblings: ChangeRequestRow[];
};

export async function getAdminRequest(id: string): Promise<AdminRequestDetail | null> {
  const supabase = await createClient();
  const { data: request } = await supabase.from("change_requests").select("*").eq("id", id).maybeSingle();
  if (!request) return null;
  const r = request as ChangeRequestRow;
  const [{ data: project }, { data: page }, { data: siblings }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", r.project_id).maybeSingle(),
    supabase.from("project_pages").select("*").eq("id", r.page_id).maybeSingle(),
    supabase.from("change_requests").select("*").eq("batch_id", r.batch_id).neq("id", r.id).order("seq", { ascending: true }),
  ]);
  if (!project || !page) return null;
  const { data: owner } = await supabase.from("profiles").select("email").eq("id", (project as ProjectRow).user_id).maybeSingle();
  return {
    request: r,
    project: project as ProjectRow,
    page: page as ProjectPageRow,
    ownerEmail: (owner?.email as string | undefined) ?? null,
    siblings: (siblings as ChangeRequestRow[]) ?? [],
  };
}
