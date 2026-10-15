import "server-only";

import { cache } from "react";

import type { DeviceKind } from "@/config/plans";
import { STATUS_EVENT_TEXT } from "@/config/requests";
import { createClient } from "@/lib/supabase/server";
import type { MessageRow, RequestStatus } from "@/lib/types/db";

/**
 * 사용자 ↔ 관리자 대화 읽기 (0006_messages.sql). 쓰기는 서버 액션이 RPC 로만 한다.
 *
 * 0006 을 아직 적용하지 않은 DB 에는 messages 테이블·함수·awaiting_user 컬럼이 없다. 그때는 대화 기능만 끄고
 * (available: false) 나머지 화면은 예전처럼 돌아가야 하므로 "없다" 는 오류를 따로 구분한다.
 *   PGRST205 테이블 없음 · PGRST202 함수 없음 · 42703 컬럼 없음
 */
const MISSING_CODES = new Set(["PGRST205", "PGRST202", "42703", "42P01", "42883"]);

export function isMissingSchema(error: { code?: string | null } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_CODES.has(error.code));
}

/** PostgREST 는 .in() 값을 URL 에 싣는다. id 가 많으면 URL 이 너무 길어지므로 나눠서 조회한다. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const byTime = (a: MessageRow, b: MessageRow) => a.created_at.localeCompare(b.created_at);

/** 한 사이트의 요청별 대화. 최근 1,000개까지 읽어 요청 id 로 묶는다 (각 묶음은 시간순). */
export async function listRequestThreads(projectId: string): Promise<{ available: boolean; byRequest: Map<string, MessageRow[]> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .not("request_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  const byRequest = new Map<string, MessageRow[]>();
  if (error) return { available: !isMissingSchema(error), byRequest };
  for (const m of ((data as MessageRow[]) ?? []).sort(byTime)) {
    const list = byRequest.get(m.request_id!) ?? [];
    list.push(m);
    byRequest.set(m.request_id!, list);
  }
  return { available: true, byRequest };
}

/** 사이트 전체에 대한 메시지 (네모와 상관없는 대화). 최근 limit 개, 시간순. */
export async function listGeneralThread(projectId: string, limit = 200): Promise<{ available: boolean; messages: MessageRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .is("request_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { available: !isMissingSchema(error), messages: [] };
  return { available: true, messages: ((data as MessageRow[]) ?? []).sort(byTime) };
}

/** 요청 1건의 대화 (시간순) */
export async function listRequestThread(requestId: string): Promise<{ available: boolean; messages: MessageRow[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("messages").select("*").eq("request_id", requestId).order("created_at", { ascending: true }).limit(500);
  if (error) return { available: !isMissingSchema(error), messages: [] };
  return { available: true, messages: (data as MessageRow[]) ?? [] };
}

/** 사이트 하나의 알림 수 */
export type ProjectNews = {
  /** 담당자의 새 글·상태 변경이 있는 요청 수 */
  unreadRequests: number;
  /** 안 읽은 사이트 메시지 수 */
  unreadGeneral: number;
  /** 내 답을 기다리는 요청 수 ("확인 필요") */
  awaiting: number;
};

export const NO_NEWS: ProjectNews = { unreadRequests: 0, unreadGeneral: 0, awaiting: 0 };

export type MessageSummary = { available: boolean; byProject: Map<string, ProjectNews>; total: ProjectNews };

/**
 * 로그인한 사용자의 사이트별 알림 수. 상단 종 아이콘·대시보드·편집기가 쓴다.
 * 레이아웃과 페이지가 한 요청 안에서 같이 부르므로 cache 로 한 번만 조회한다.
 */
export const getMessageSummary = cache(async (): Promise<MessageSummary> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_message_summary");
  const byProject = new Map<string, ProjectNews>();
  const total: ProjectNews = { ...NO_NEWS };
  if (error) return { available: !isMissingSchema(error), byProject, total };
  for (const r of (data as { project_id: string; unread_requests: number; unread_general: number; awaiting: number }[] | null) ?? []) {
    const news = { unreadRequests: Number(r.unread_requests), unreadGeneral: Number(r.unread_general), awaiting: Number(r.awaiting) };
    byProject.set(r.project_id, news);
    total.unreadRequests += news.unreadRequests;
    total.unreadGeneral += news.unreadGeneral;
    total.awaiting += news.awaiting;
  }
  return { available: true, byProject, total };
});

/** 종 아이콘에 띄우는 숫자: 확인할 것이 몇 건인가 */
export function newsCount(n: ProjectNews): number {
  return n.unreadRequests + n.unreadGeneral + n.awaiting;
}

/** 대시보드 "확인할 내용" 한 줄 */
export type NewsItem =
  | { type: "awaiting" | "answer"; key: string; projectId: string; requestId: string; seq: number; pageName: string; device: DeviceKind; text: string; at: string }
  | { type: "message"; key: string; projectId: string; text: string; count: number; at: string };

type RequestLite = { id: string; project_id: string; page_id: string; seq: number; device: DeviceKind; status: RequestStatus; awaiting_user?: boolean };

/**
 * 내 사이트들에서 지금 확인할 것: 답을 기다리는 요청 → 새 답변·상태 변경 → 새 메시지 순.
 * 요청 하나, 사이트 메시지 하나당 한 줄로 줄인다 (가장 최근 글을 보여준다).
 */
export async function listNews(projectIds: string[]): Promise<NewsItem[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createClient();
  const [{ data: unreadRows, error }, { data: awaitingRows }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, project_id, request_id, body, status, created_at")
      .eq("author_role", "admin")
      .is("read_at", null)
      .in("project_id", projectIds)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("change_requests").select("id, project_id, page_id, seq, device, status, awaiting_user").eq("awaiting_user", true).in("status", ["pending", "processing"]).in("project_id", projectIds),
  ]);
  if (error) return [];
  const unread = (unreadRows as Pick<MessageRow, "id" | "project_id" | "request_id" | "body" | "status" | "created_at">[] | null) ?? [];
  const awaiting = (awaitingRows as RequestLite[] | null) ?? [];

  // 새 글이 달린 요청의 번호·페이지 이름
  const requests = new Map<string, RequestLite>(awaiting.map((r) => [r.id, r]));
  const missing = [...new Set(unread.map((m) => m.request_id).filter((id): id is string => Boolean(id) && !requests.has(id!)))];
  for (const ids of chunk(missing)) {
    const { data } = await supabase.from("change_requests").select("id, project_id, page_id, seq, device, status, awaiting_user").in("id", ids);
    for (const r of (data as RequestLite[] | null) ?? []) requests.set(r.id, r);
  }
  const pageName = new Map<string, string>();
  for (const ids of chunk([...new Set([...requests.values()].map((r) => r.page_id))])) {
    const { data } = await supabase.from("project_pages").select("id, name").in("id", ids);
    for (const p of (data as { id: string; name: string }[] | null) ?? []) pageName.set(p.id, p.name);
  }

  // unread 는 최신순이므로 요청·사이트마다 처음 만나는 글이 가장 최근 글이다
  const latestByRequest = new Map<string, (typeof unread)[number]>();
  const general = new Map<string, { latest: (typeof unread)[number]; count: number }>();
  for (const m of unread) {
    if (m.request_id) {
      if (!latestByRequest.has(m.request_id)) latestByRequest.set(m.request_id, m);
    } else {
      const g = general.get(m.project_id);
      if (g) g.count += 1;
      else general.set(m.project_id, { latest: m, count: 1 });
    }
  }
  // 이미 읽은 질문도 "확인 필요" 줄에 그대로 보여준다 (무엇을 물었는지 알아야 답한다)
  const asked = awaiting.map((r) => r.id).filter((id) => !latestByRequest.has(id));
  for (const ids of chunk(asked)) {
    const { data } = await supabase.from("messages").select("id, project_id, request_id, body, status, created_at").eq("author_role", "admin").not("body", "is", null).in("request_id", ids).order("created_at", { ascending: false }).limit(500);
    for (const m of (data as typeof unread | null) ?? []) if (m.request_id && !latestByRequest.has(m.request_id)) latestByRequest.set(m.request_id, m);
  }
  const textOf = (m: (typeof unread)[number]) => m.body ?? (m.status ? STATUS_EVENT_TEXT[m.status] : "");

  const items: NewsItem[] = [];
  for (const r of awaiting) {
    const m = latestByRequest.get(r.id);
    items.push({ type: "awaiting", key: `w-${r.id}`, projectId: r.project_id, requestId: r.id, seq: r.seq, pageName: pageName.get(r.page_id) ?? "페이지", device: r.device, text: m ? textOf(m) : "담당자가 답을 기다리고 있습니다.", at: m?.created_at ?? "" });
  }
  const awaitingIds = new Set(awaiting.map((r) => r.id));
  for (const [requestId, m] of latestByRequest) {
    const r = requests.get(requestId);
    if (!r || awaitingIds.has(requestId)) continue;
    items.push({ type: "answer", key: `a-${requestId}`, projectId: r.project_id, requestId, seq: r.seq, pageName: pageName.get(r.page_id) ?? "페이지", device: r.device, text: textOf(m), at: m.created_at });
  }
  for (const [projectId, g] of general) {
    items.push({ type: "message", key: `m-${projectId}`, projectId, text: textOf(g.latest), count: g.count, at: g.latest.created_at });
  }
  return items;
}
