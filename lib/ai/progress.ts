import "server-only";

import { AI_STALE_MINUTES } from "@/config/ai";
import { DEVICE_LABEL, type DeviceKind } from "@/config/plans";
import { isImageRequest } from "@/config/requests";
import { queueOrder, reapStaleRuns } from "@/lib/ai/engine";
import { plannedOf, regionContext, renderPage, sectionLabel } from "@/lib/ai/layout";
import { describeChange, designOf, fieldDef, type AppliedChange, type DesignDoc } from "@/lib/design-doc";
import type { DraftResult } from "@/lib/draft-render";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { ProjectBrief, Region } from "@/lib/types/db";

/**
 * 편집기 "AI 작업 중" 화면이 1초마다 읽는 진행 상황 (GET /api/projects/[id]/ai-progress).
 * 한 번의 "요청하기"(batch) 에 담긴 AI 반영 네모와 오류 신고(AI 가 먼저 확인)를 엔진(processBatch)과 같은 순서로,
 * 네모마다 상태 · 단계 · AI 설명 · 바뀐 것을 돌려준다.
 * 요청 상태(change_requests) + 그 요청의 마지막 실행(ai_runs, 처리 중이면 output.live 에 단계)에서 만든다 — 따로 저장하는 표는 없다.
 */

export type LiveState = "queued" | "working" | "done" | "asked" | "handoff";
export type LiveStage = "thinking" | "writing" | "rendering";

export type LiveItem = {
  id: string;
  /** ai = AI 반영 · bug = 오류 신고 (AI 가 먼저 확인) */
  kind: "ai" | "bug";
  /** 처리 순서 (1부터) */
  order: number;
  seq: number;
  pageId: string;
  pageName: string;
  device: DeviceKind;
  /** "홈 · 웹 · 네모 1" */
  where: string;
  message: string;
  region: Region;
  /** 네모가 가리키는 곳 (지금 화면 기준): "첫 화면 큰 제목 · 첫 화면 설명" */
  target: string | null;
  state: LiveState;
  stage: LiveStage | null;
  /** AI 설명 (처리 중에는 쓰는 대로, 끝나면 최종) */
  summary: string | null;
  /** 질문 · 담당자에게 넘긴 이유 */
  note: string | null;
  /** 실제로 바뀐 것 ("제목 크기: 보통 → 조금 크게") */
  changes: string[];
  startedAt: string | null;
  finishedAt: string | null;
  versionAfter: number | null;
};

export type BatchProgress = {
  batchId: string;
  /** 지금 디자인 버전 (편집기 화면이 이보다 낮으면 새로 읽는다) */
  version: number;
  items: LiveItem[];
  /** 같은 묶음의 사람 몫 (전문가 요청) · AI 이미지 생성 요청 수 */
  people: number;
  images: number;
  done: boolean;
  /** 서버 시각 (경과 시간 계산) */
  now: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

type RequestRow = {
  id: string;
  page_id: string;
  device: DeviceKind;
  kind: string;
  seq: number;
  status: string;
  awaiting_user: boolean;
  message: string;
  region: Region;
  resolution_note: string | null;
  created_at: string;
};

type RunRow = {
  request_id: string;
  status: string;
  output: { live?: { stage?: LiveStage; summary?: string }; summary?: string; question?: string } | null;
  applied: { changes?: AppliedChange[] } | null;
  design_version_after: number | null;
  created_at: string;
  finished_at: string | null;
};

/** 사용자 화면에서 뺄 담당자 안내 꼬리 ("담당자가 이어서 처리할게요 (24~72시간 …)") */
const tail = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s*담당자가 이어서 처리할게요[\s\S]*$/, "")
    .replace(/^AI가 확인하고 싶은 게 있어요:\s*/, "")
    .replace(/\n답글을 남겨 주시면[\s\S]*$/, "")
    .trim() || null;

/**
 * 그림의 배치(문구 자리 · 구역 위치)는 저장하지 않고 디자인 문서로 다시 그려 얻는다 (lib/ai/layout.ts).
 * 1초마다 같은 그림을 다시 그리지 않게 디자인 버전별로 잠깐 기억한다.
 */
const layoutMemo = new Map<string, DraftResult | null>();
function layoutOf(projectId: string, brief: ProjectBrief, design: DesignDoc, path: string, device: DeviceKind): DraftResult | null {
  const key = `${projectId}:${design.version}:${path}:${device}`;
  if (!layoutMemo.has(key)) {
    const planned = plannedOf(brief, path);
    layoutMemo.set(key, planned ? renderPage(brief, design, planned, device) : null);
    if (layoutMemo.size > 64) layoutMemo.delete(layoutMemo.keys().next().value as string);
  }
  return layoutMemo.get(key) ?? null;
}

/** 네모가 가리키는 곳: 겹치는 문구 자리 이름(많이 겹치는 순, 2개까지), 없으면 겹치는 구역 이름 */
function targetOf(region: Region, layout: DraftResult | null): string | null {
  if (!layout) return null;
  const ctx = regionContext(layout, region);
  const names = [...new Set(ctx.fields.map((f) => fieldDef(f.key)?.label ?? f.key))].slice(0, 2);
  if (names.length) return names.join(" · ");
  const sections = [...new Set(ctx.sections.map((s) => sectionLabel(s.id)))].slice(0, 2);
  return sections.length ? sections.join(" · ") : null;
}

/**
 * 묶음 진행 상황. supabase = 사용자 세션 (사이트 주인인지 · 요청 · 페이지는 RLS 로 읽는다). 실행 기록(ai_runs)은 관리자만 읽을 수 있어
 * 주인 확인 뒤 service role 로 읽는다. 주인이 아니거나 없는 묶음이면 null.
 */
export async function loadBatchProgress(supabase: Supabase, projectId: string, batchId: string): Promise<BatchProgress | null> {
  const [{ data: project }, { data: reqData }, { data: pageData }] = await Promise.all([
    supabase.from("projects").select("brief").eq("id", projectId).maybeSingle(),
    supabase
      .from("change_requests")
      .select("id, page_id, device, kind, seq, status, awaiting_user, message, region, resolution_note, created_at")
      .eq("project_id", projectId)
      .eq("batch_id", batchId)
      .limit(200),
    supabase.from("project_pages").select("id, name, path, sort_order").eq("project_id", projectId),
  ]);
  if (!project) return null;
  const rows = (reqData as RequestRow[] | null) ?? [];
  if (!rows.length) return null;
  const brief = project.brief as ProjectBrief;
  const design = designOf(brief);

  const pages = new Map(((pageData as { id: string; name: string; path: string; sort_order: number }[] | null) ?? []).map((p) => [p.id, p]));
  // AI 가 맡는 것: AI 반영(이미지 생성 요청 제외) → 오류 신고. 엔진과 같은 순서
  const ai = rows
    .filter((r) => (r.kind === "ai" && !isImageRequest(r.message)) || r.kind === "bug")
    .sort((a, b) => queueOrder(a, b, (id) => pages.get(id)?.sort_order ?? 0));

  const admin = createAdminClient();
  const latest = new Map<string, RunRow>();
  if (ai.length) {
    const { data: runData } = await admin
      .from("ai_runs")
      .select("request_id, status, output, applied, design_version_after, created_at, finished_at")
      .in("request_id", ai.map((r) => r.id))
      .order("created_at", { ascending: false })
      .limit(500);
    for (const run of (runData as RunRow[] | null) ?? []) if (!latest.has(run.request_id)) latest.set(run.request_id, run);
  }

  const now = Date.now();
  let stale = false;
  const items: LiveItem[] = ai.map((r, i) => {
    const run = latest.get(r.id);
    const page = pages.get(r.page_id);
    const base = {
      id: r.id,
      kind: r.kind === "bug" ? ("bug" as const) : ("ai" as const),
      order: i + 1,
      seq: r.seq,
      pageId: r.page_id,
      pageName: page?.name ?? "",
      device: r.device,
      where: `${page?.name ?? "페이지"} · ${DEVICE_LABEL[r.device]} · 네모 ${r.seq}`,
      message: r.message,
      region: r.region,
      target: page ? targetOf(r.region, layoutOf(projectId, brief, design, page.path, r.device)) : null,
      startedAt: run?.created_at ?? null,
      finishedAt: run?.finished_at ?? null,
      versionAfter: run?.design_version_after ?? null,
      changes: [] as string[],
      note: null as string | null,
    };
    if (run?.status === "running") {
      if (now - new Date(run.created_at).getTime() > AI_STALE_MINUTES * 60_000) stale = true;
      const l = run.output?.live;
      return { ...base, state: "working", stage: l?.stage ?? "thinking", summary: l?.summary || null, finishedAt: null };
    }
    if (r.status === "done") {
      const changes = run?.status === "applied" ? (run.applied?.changes ?? []).map(describeChange) : [];
      return { ...base, state: "done", stage: null, summary: run?.output?.summary ?? tail(r.resolution_note), changes };
    }
    if (r.status === "pending" && r.awaiting_user) {
      return { ...base, state: "asked", stage: null, summary: null, note: run?.output?.question?.trim() || tail(r.resolution_note) };
    }
    if (r.status === "processing" || r.status === "rejected") {
      return { ...base, state: "handoff", stage: null, summary: null, note: tail(r.resolution_note) ?? run?.output?.summary ?? null };
    }
    // 접수 · AI 차례인데 처리 중인 실행이 없다 = 순서를 기다리는 중
    return { ...base, state: "queued", stage: null, summary: null, startedAt: null, finishedAt: null, versionAfter: null };
  });

  // 멈춘 처리(서버 재시작 등)는 정리해 두면 다음 확인 때 "담당자에게" 로 보인다
  if (stale) await reapStaleRuns(admin).catch(() => 0);

  return {
    batchId,
    version: design.version,
    items,
    people: rows.filter((r) => r.kind === "expert").length,
    images: rows.filter((r) => r.kind === "ai" && isImageRequest(r.message)).length,
    done: items.every((i) => i.state !== "queued" && i.state !== "working"),
    now: new Date(now).toISOString(),
  };
}
