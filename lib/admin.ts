import "server-only";

import { cache } from "react";

import type { RequestKind } from "@/config/plans";
import { chunk, isMissingSchema, listGeneralThread, listRequestThread } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestRow, MessageRow, ProjectPageRow, ProjectRow, RequestStatus } from "@/lib/types/db";

/**
 * 관리자 화면 데이터 접근. 읽기는 0002_admin.sql · 0006_messages.sql 의 "admin select" RLS 정책이 허용하고,
 * 쓰기는 admin_* RPC 만 쓴다 — 관리자가 아니면 DB 가 거부한다.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const OPEN: RequestStatus[] = ["pending", "processing"];
const REQUEST_SELECT = "*, project:projects(id, name, user_id, status), page:project_pages(id, name, path)";

type RequestWithRefs = ChangeRequestRow & {
  project: Pick<ProjectRow, "id" | "name" | "user_id" | "status"> | null;
  page: Pick<ProjectPageRow, "id" | "name" | "path"> | null;
};

export type AdminRequestListItem = RequestWithRefs & {
  ownerEmail: string | null;
  /** 사용자가 쓴 글 중 관리자가 아직 안 읽은 수 */
  unreadReplies: number;
  /** 대화의 마지막 글 (누가 썼든). 목록 미리보기에 쓴다 */
  lastEntry: Pick<MessageRow, "author_role" | "body" | "status" | "created_at"> | null;
};

/**
 * status
 *   todo      지금 손댈 것: 접수·처리중이고 사용자 답을 기다리지 않는 요청 + 사용자의 새 답글이 달린 요청(끝난 것 포함)
 *   awaiting  사용자에게 질문해 두고 답을 기다리는 요청
 *   그 외      상태 그대로
 */
export type RequestFilter = { status?: RequestStatus | "todo" | "awaiting"; kind?: RequestKind; projectId?: string };

async function ownerEmails(supabase: Supabase, userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (const ids of chunk([...new Set(userIds)])) {
    const { data } = await supabase.from("profiles").select("id, email").in("id", ids);
    for (const p of (data as { id: string; email: string }[] | null) ?? []) emails.set(p.id, p.email);
  }
  return emails;
}

/** messaging 이 false 면 0006 적용 전 DB 다 — 대화·확인 대기 없이 예전처럼 보여준다. */
export async function listAdminRequests(filter: RequestFilter, limit = 200): Promise<{ items: AdminRequestListItem[]; messaging: boolean }> {
  const supabase = await createClient();
  const base = () => {
    let q = supabase.from("change_requests").select(REQUEST_SELECT).order("created_at", { ascending: false }).limit(limit);
    if (filter.kind) q = q.eq("kind", filter.kind);
    if (filter.projectId) q = q.eq("project_id", filter.projectId);
    return q;
  };

  let rows: RequestWithRefs[] = [];
  let messaging = true;

  if (filter.status === "todo") {
    const open = await base().in("status", OPEN).eq("awaiting_user", false);
    if (open.error && isMissingSchema(open.error)) {
      messaging = false;
      const legacy = await base().in("status", OPEN);
      if (legacy.error) throw new Error(legacy.error.message);
      rows = (legacy.data as unknown as RequestWithRefs[]) ?? [];
    } else if (open.error) {
      throw new Error(open.error.message);
    } else {
      rows = (open.data as unknown as RequestWithRefs[]) ?? [];
      // 끝난 요청이라도 사용자가 답글을 달았으면 다시 손댈 것으로 올린다
      const { data: replied, error } = await supabase.from("messages").select("request_id").eq("author_role", "user").is("read_at", null).not("request_id", "is", null).limit(1000);
      if (error) {
        messaging = !isMissingSchema(error);
      } else {
        const have = new Set(rows.map((r) => r.id));
        const missing = [...new Set(((replied as { request_id: string }[] | null) ?? []).map((m) => m.request_id))].filter((id) => !have.has(id));
        for (const ids of chunk(missing)) {
          const { data } = await base().in("id", ids);
          rows.push(...((data as unknown as RequestWithRefs[]) ?? []));
        }
        rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
    }
  } else if (filter.status === "awaiting") {
    const res = await base().in("status", OPEN).eq("awaiting_user", true);
    if (res.error) {
      if (!isMissingSchema(res.error)) throw new Error(res.error.message);
      messaging = false;
    } else {
      rows = (res.data as unknown as RequestWithRefs[]) ?? [];
    }
  } else {
    const res = await (filter.status ? base().eq("status", filter.status) : base());
    if (res.error) throw new Error(res.error.message);
    rows = (res.data as unknown as RequestWithRefs[]) ?? [];
  }

  // 요청별 대화 요약
  const unread = new Map<string, number>();
  const last = new Map<string, AdminRequestListItem["lastEntry"]>();
  if (messaging) {
    for (const ids of chunk(rows.map((r) => r.id))) {
      const { data, error } = await supabase.from("messages").select("request_id, author_role, body, status, created_at, read_at").in("request_id", ids).order("created_at", { ascending: false }).limit(1000);
      if (error) {
        messaging = !isMissingSchema(error);
        break;
      }
      for (const m of (data as Pick<MessageRow, "request_id" | "author_role" | "body" | "status" | "created_at" | "read_at">[] | null) ?? []) {
        if (m.author_role === "user" && !m.read_at) unread.set(m.request_id!, (unread.get(m.request_id!) ?? 0) + 1);
        // 최신순으로 읽으므로 요청마다 처음 만나는 글이 마지막 글이다 (1,000행에서 잘려도 최신 글은 남는다)
        if (!last.has(m.request_id!)) last.set(m.request_id!, m);
      }
    }
  }

  const emails = await ownerEmails(supabase, rows.map((r) => r.project?.user_id).filter((id): id is string => Boolean(id)));
  return {
    messaging,
    items: rows.map((r) => ({ ...r, ownerEmail: (r.project && emails.get(r.project.user_id)) ?? null, unreadReplies: unread.get(r.id) ?? 0, lastEntry: last.get(r.id) ?? null })),
  };
}

export type RequestCounts = Record<RequestStatus, number> & { awaiting: number };

/** 상태별 요청 수 + 사용자 답을 기다리는 수. 행을 읽지 않고 개수만 센다 (1,000행 제한에 걸리지 않게). */
export async function countRequestsByStatus(): Promise<RequestCounts> {
  const supabase = await createClient();
  const count = async (status: RequestStatus) => {
    const { count: n } = await supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("status", status);
    return n ?? 0;
  };
  const awaiting = async () => {
    const { count: n, error } = await supabase.from("change_requests").select("id", { count: "exact", head: true }).in("status", OPEN).eq("awaiting_user", true);
    return error ? 0 : (n ?? 0);
  };
  const [pending, processing, done, rejected, waiting] = await Promise.all([count("pending"), count("processing"), count("done"), count("rejected"), awaiting()]);
  return { pending, processing, done, rejected, awaiting: waiting };
}

/** 상단 배지 숫자 */
export type AdminCounts = {
  /** 지금 손댈 요청 */
  todo: number;
  /** 그중 사용자의 새 답글이 달린 요청 */
  replies: number;
  /** 새 메시지가 온 사이트 */
  messages: number;
};

/** 레이아웃과 목록 페이지가 한 요청 안에서 같이 부르므로 cache 로 한 번만 조회한다. */
export const getAdminCounts = cache(async (): Promise<AdminCounts> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_message_summary");
  const row = (data as { todo: number; unread_requests: number; unread_general: number }[] | null)?.[0];
  if (!error && row) return { todo: Number(row.todo), replies: Number(row.unread_requests), messages: Number(row.unread_general) };
  // 0006 적용 전: 접수·처리중 요청 수만 센다
  const { count } = await supabase.from("change_requests").select("id", { count: "exact", head: true }).in("status", OPEN);
  return { todo: count ?? 0, replies: 0, messages: 0 };
});

export type AdminRequestDetail = {
  request: ChangeRequestRow;
  project: ProjectRow;
  page: ProjectPageRow;
  ownerEmail: string | null;
  /** 같은 묶음(batch)의 다른 요청 */
  siblings: ChangeRequestRow[];
  /** 이 요청의 대화. available 이 false 면 0006 적용 전 */
  thread: { available: boolean; messages: MessageRow[] };
};

export async function getAdminRequest(id: string): Promise<AdminRequestDetail | null> {
  const supabase = await createClient();
  const { data: request } = await supabase.from("change_requests").select("*").eq("id", id).maybeSingle();
  if (!request) return null;
  const r = request as ChangeRequestRow;
  const [{ data: project }, { data: page }, { data: siblings }, thread] = await Promise.all([
    supabase.from("projects").select("*").eq("id", r.project_id).maybeSingle(),
    supabase.from("project_pages").select("*").eq("id", r.page_id).maybeSingle(),
    supabase.from("change_requests").select("*").eq("batch_id", r.batch_id).neq("id", r.id).order("seq", { ascending: true }),
    listRequestThread(r.id),
  ]);
  if (!project || !page) return null;
  const { data: owner } = await supabase.from("profiles").select("email").eq("id", (project as ProjectRow).user_id).maybeSingle();
  return {
    request: r,
    project: project as ProjectRow,
    page: page as ProjectPageRow,
    ownerEmail: (owner?.email as string | undefined) ?? null,
    siblings: (siblings as ChangeRequestRow[]) ?? [],
    thread,
  };
}

/** 사이트 메시지함의 한 줄: 사이트 하나와의 대화 */
export type AdminConversation = {
  project: Pick<ProjectRow, "id" | "name" | "user_id" | "status">;
  ownerEmail: string | null;
  last: MessageRow;
  /** 사용자가 쓴 글 중 아직 안 읽은 수 */
  unread: number;
};

/** 사이트 메시지(네모와 상관없는 대화)가 오간 사이트 목록. 안 읽은 것이 있는 사이트 먼저, 그다음 최근 글 순. */
export async function listAdminConversations(): Promise<{ available: boolean; items: AdminConversation[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("messages").select("*").is("request_id", null).order("created_at", { ascending: false }).limit(1000);
  if (error) return { available: !isMissingSchema(error), items: [] };

  const grouped = new Map<string, { last: MessageRow; unread: number }>();
  for (const m of (data as MessageRow[]) ?? []) {
    const g = grouped.get(m.project_id) ?? { last: m, unread: 0 };
    if (m.author_role === "user" && !m.read_at) g.unread += 1;
    grouped.set(m.project_id, g);
  }

  const projects = new Map<string, AdminConversation["project"]>();
  for (const ids of chunk([...grouped.keys()])) {
    const { data: rows } = await supabase.from("projects").select("id, name, user_id, status").in("id", ids);
    for (const p of (rows as AdminConversation["project"][] | null) ?? []) projects.set(p.id, p);
  }
  const emails = await ownerEmails(supabase, [...projects.values()].map((p) => p.user_id));

  const items: AdminConversation[] = [];
  for (const [projectId, g] of grouped) {
    const project = projects.get(projectId);
    if (project) items.push({ project, ownerEmail: emails.get(project.user_id) ?? null, last: g.last, unread: g.unread });
  }
  items.sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.last.created_at.localeCompare(a.last.created_at));
  return { available: true, items };
}

export type AdminConversationDetail = {
  project: ProjectRow;
  ownerEmail: string | null;
  available: boolean;
  messages: MessageRow[];
  /** 이 사이트의 접수·처리중 요청 수 */
  openRequests: number;
};

export async function getAdminConversation(projectId: string): Promise<AdminConversationDetail | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const p = project as ProjectRow;
  const [{ data: owner }, thread, { count }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", p.user_id).maybeSingle(),
    listGeneralThread(projectId),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", OPEN),
  ]);
  return { project: p, ownerEmail: (owner?.email as string | undefined) ?? null, available: thread.available, messages: thread.messages, openRequests: count ?? 0 };
}

export type AdminProjectDetail = {
  project: ProjectRow;
  ownerEmail: string | null;
  pages: Pick<ProjectPageRow, "id" | "name" | "path" | "sort_order" | "screenshots">[];
  openRequests: number;
  /** 이미지 자리 상태를 맞춰 보려고 쓰는 요청 (최신순) */
  requests: Pick<ChangeRequestRow, "id" | "page_id" | "device" | "region" | "status">[];
};

/** 제작 정보 화면: 위저드 입력(브리프) 전체 + 페이지 목록. 제작 담당자가 사이트를 만들 때 보는 기준이다 */
export async function getAdminProject(projectId: string): Promise<AdminProjectDetail | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;
  const p = project as ProjectRow;
  const [{ data: owner }, { data: pages }, { count }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", p.user_id).maybeSingle(),
    supabase.from("project_pages").select("id, name, path, sort_order, screenshots").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", OPEN),
    supabase.from("change_requests").select("id, page_id, device, region, status").eq("project_id", projectId).order("created_at", { ascending: false }).limit(500),
  ]);
  return {
    project: p,
    ownerEmail: (owner?.email as string | undefined) ?? null,
    pages: (pages as AdminProjectDetail["pages"] | null) ?? [],
    openRequests: count ?? 0,
    requests: (requests as AdminProjectDetail["requests"] | null) ?? [],
  };
}
