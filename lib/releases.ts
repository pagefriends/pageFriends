import "server-only";

import { isActiveRelease } from "@/config/releases";
import { ownerEmails } from "@/lib/admin";
import { chunk, isMissingSchema } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestRow, ProjectPageRow, ProjectRow, ReleaseRow } from "@/lib/types/db";

/**
 * 웹사이트 적용 읽기 (0007_releases.sql). 쓰기는 서버 액션이 RPC 로만 한다.
 * 읽기는 RLS 로 사이트 주인과 관리자만. 0007 을 아직 적용하지 않은 DB 에서는 available: false 로 기능만 끈다.
 */

/** 사이트 하나의 웹사이트 상태 */
export type ReleaseSummary = {
  /** 끝났지만 아직 웹사이트에 적용하지 않은 수정 수 */
  waiting: number;
  /** 진행 중인 적용 (적용 요청됨 · 점검 중) */
  active: ReleaseRow | null;
  /** 마지막으로 운영에 반영된 적용 — 지금 웹사이트 주소 */
  lastLive: ReleaseRow | null;
};

export const NO_RELEASE: ReleaseSummary = { waiting: 0, active: null, lastLive: null };

/** 여러 사이트의 웹사이트 상태 (대시보드 카드 · 편집기 상단) */
export async function listReleaseSummaries(projectIds: string[]): Promise<{ available: boolean; byProject: Map<string, ReleaseSummary> }> {
  const byProject = new Map<string, ReleaseSummary>();
  if (projectIds.length === 0) return { available: true, byProject };
  const supabase = await createClient();
  const get = (id: string) => {
    let s = byProject.get(id);
    if (!s) byProject.set(id, (s = { ...NO_RELEASE }));
    return s;
  };

  for (const ids of chunk(projectIds)) {
    const [rel, waiting] = await Promise.all([
      supabase.from("releases").select("*").in("project_id", ids).in("status", ["requested", "staging", "live"]).order("seq", { ascending: false }),
      supabase.from("change_requests").select("project_id").in("project_id", ids).eq("status", "done").is("release_id", null).limit(5000),
    ]);
    if (rel.error || waiting.error) {
      if (isMissingSchema(rel.error) || isMissingSchema(waiting.error)) return { available: false, byProject: new Map() };
      throw new Error((rel.error ?? waiting.error)!.message);
    }
    // 최신순이므로 사이트마다 처음 만나는 것이 진행 중인 적용 · 마지막 공개다
    for (const r of (rel.data as ReleaseRow[]) ?? []) {
      const s = get(r.project_id);
      if (isActiveRelease(r.status) && !s.active) s.active = r;
      if (r.status === "live" && !s.lastLive) s.lastLive = r;
    }
    for (const w of (waiting.data as { project_id: string }[]) ?? []) get(w.project_id).waiting += 1;
  }
  return { available: true, byProject };
}

/** 사이트 하나의 적용 기록 전체 (최신순) + 상태 요약 */
export type ProjectReleases = ReleaseSummary & { available: boolean; releases: ReleaseRow[]; byId: Map<string, ReleaseRow> };

export async function listProjectReleases(projectId: string): Promise<ProjectReleases> {
  const supabase = await createClient();
  const [rel, waiting] = await Promise.all([
    supabase.from("releases").select("*").eq("project_id", projectId).order("seq", { ascending: false }).limit(200),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "done").is("release_id", null),
  ]);
  if (rel.error || waiting.error) {
    if (isMissingSchema(rel.error) || isMissingSchema(waiting.error)) return { available: false, releases: [], byId: new Map(), ...NO_RELEASE };
    throw new Error((rel.error ?? waiting.error)!.message);
  }
  const releases = (rel.data as ReleaseRow[]) ?? [];
  return {
    available: true,
    releases,
    byId: new Map(releases.map((r) => [r.id, r])),
    waiting: waiting.count ?? 0,
    active: releases.find((r) => isActiveRelease(r.status)) ?? null,
    lastLive: releases.find((r) => r.status === "live") ?? null,
  };
}

// =============================================================================
// 관리자 (RLS "releases: admin select")
// =============================================================================

export type AdminReleaseTab = "todo" | "live" | "cancelled" | "all";

export type AdminReleaseListItem = ReleaseRow & {
  project: Pick<ProjectRow, "id" | "name" | "user_id" | "status"> | null;
  ownerEmail: string | null;
  /** 실린 수정 수 */
  itemCount: number;
};

const TAB_STATUS: Record<Exclude<AdminReleaseTab, "all">, ReleaseRow["status"][]> = {
  todo: ["requested", "staging"],
  live: ["live"],
  cancelled: ["cancelled"],
};

export async function listAdminReleases(
  tab: AdminReleaseTab,
  projectId?: string,
): Promise<{ available: boolean; items: AdminReleaseListItem[]; counts: Record<Exclude<AdminReleaseTab, "all">, number> }> {
  const supabase = await createClient();
  const counts = { todo: 0, live: 0, cancelled: 0 };
  let q = supabase.from("releases").select("*, project:projects(id, name, user_id, status)").order("requested_at", { ascending: tab === "todo" }).limit(300);
  if (tab !== "all") q = q.in("status", TAB_STATUS[tab]);
  if (projectId) q = q.eq("project_id", projectId);
  const { data, error } = await q;
  if (error) {
    if (isMissingSchema(error)) return { available: false, items: [], counts };
    throw new Error(error.message);
  }
  const rows = (data as unknown as (ReleaseRow & { project: AdminReleaseListItem["project"] })[]) ?? [];

  const tally = async (status: ReleaseRow["status"][]) => {
    let c = supabase.from("releases").select("id", { count: "exact", head: true }).in("status", status);
    if (projectId) c = c.eq("project_id", projectId);
    return (await c).count ?? 0;
  };
  const itemCount = new Map<string, number>();
  const [todo, live, cancelled] = await Promise.all([
    tally(TAB_STATUS.todo),
    tally(TAB_STATUS.live),
    tally(TAB_STATUS.cancelled),
    (async () => {
      for (const ids of chunk(rows.map((r) => r.id))) {
        const { data: items } = await supabase.from("change_requests").select("release_id").in("release_id", ids).limit(5000);
        for (const i of (items as { release_id: string }[] | null) ?? []) itemCount.set(i.release_id, (itemCount.get(i.release_id) ?? 0) + 1);
      }
    })(),
  ]);
  counts.todo = todo;
  counts.live = live;
  counts.cancelled = cancelled;

  const emails = await ownerEmails(supabase, rows.map((r) => r.project?.user_id).filter((id): id is string => Boolean(id)));
  return {
    available: true,
    counts,
    items: rows.map((r) => ({ ...r, ownerEmail: (r.project && emails.get(r.project.user_id)) ?? null, itemCount: itemCount.get(r.id) ?? 0 })),
  };
}

export type AdminReleaseDetail = {
  release: ReleaseRow;
  project: ProjectRow;
  ownerEmail: string | null;
  pages: Pick<ProjectPageRow, "id" | "name" | "path" | "screenshots">[];
  /** 이 적용에 실린 수정 (번호순) */
  items: ChangeRequestRow[];
  /** 끝났지만 아직 어느 적용에도 실리지 않은 수정 수 — 개발 서버에 (다시) 배포하면 같이 실린다 */
  waitingOutside: number;
  /** 이 사이트의 모든 적용 (최신순) — 주소 미리 채우기 · 기록 */
  history: ReleaseRow[];
};

export async function getAdminRelease(id: string): Promise<AdminReleaseDetail | null> {
  const supabase = await createClient();
  const { data: release, error } = await supabase.from("releases").select("*").eq("id", id).maybeSingle();
  if (error || !release) return null;
  const r = release as ReleaseRow;
  const [{ data: project }, { data: pages }, { data: items }, { count }, { data: history }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", r.project_id).maybeSingle(),
    supabase.from("project_pages").select("id, name, path, screenshots").eq("project_id", r.project_id).order("sort_order", { ascending: true }),
    supabase.from("change_requests").select("*").eq("release_id", r.id).order("created_at", { ascending: true }),
    supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("project_id", r.project_id).eq("status", "done").is("release_id", null),
    supabase.from("releases").select("*").eq("project_id", r.project_id).order("seq", { ascending: false }).limit(50),
  ]);
  if (!project) return null;
  const p = project as ProjectRow;
  const emails = await ownerEmails(supabase, [p.user_id]);
  return {
    release: r,
    project: p,
    ownerEmail: emails.get(p.user_id) ?? null,
    pages: (pages as AdminReleaseDetail["pages"] | null) ?? [],
    items: (items as ChangeRequestRow[] | null) ?? [],
    waitingOutside: count ?? 0,
    history: (history as ReleaseRow[] | null) ?? [],
  };
}
