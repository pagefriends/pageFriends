import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AI_BUILDS_PER_USER_PER_DAY,
  AI_DAILY_BUDGET_USD_DEFAULT,
  AI_EFFORT,
  AI_MAX_QUESTIONS,
  AI_MAX_TOKENS,
  AI_MODEL,
  AI_QUEUE_MINUTES,
  AI_STALE_MINUTES,
  PROMPT_VERSION,
} from "@/config/ai";
import { normalizeStyles, styleLabels } from "@/config/design-styles";
import { BUG_HOURS, DEVICE_LABEL, EXPERT_HOURS, getPlan, type DeviceKind, type Plan, type PlanCode } from "@/config/plans";
import { isImageRequest } from "@/config/requests";
import { SITE_DB_AI_WAIT_MS } from "@/config/site-db";
import { templateDesign } from "@/config/template-designs";
import { aiConfigured, callStructured, type CallResult } from "@/lib/ai/claude";
import { bugPrompt, buildPrompt, editPrompt, tagNames, type BatchPeer, type EditRequest, type HarnessSite, type RecentChange } from "@/lib/ai/harness";
import { copyLimits, copySlots, plannedOf, renderPage, rerender, type LayoutPage } from "@/lib/ai/layout";
import { BugOutput, BuildOutput, EditOutput } from "@/lib/ai/schemas";
import { applyCollectionChanges, type SchemaSnapshot } from "@/lib/collections";
import {
  THEME_KEYS,
  applyChanges,
  describeChange,
  designOf,
  sanitizeTheme,
  type AppliedChange,
  type CopyChange,
  type CopyMap,
  type DesignDoc,
  type ThemeChange,
} from "@/lib/design-doc";
import { getServerEnv } from "@/lib/env";
import { isMissingSchema } from "@/lib/messages";
import { getSiteDatabase, syncSiteSchema } from "@/lib/site-db/provision";
import { effectiveSubscription } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectBrief, Region, RequestOptions, SubscriptionRow } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

/**
 * AI 엔진 1단계 — 지시서(lib/ai/harness) → Claude(lib/ai/claude) → 검사(lib/design-doc) → 반영 · 기록.
 *
 * 첫 제작   위저드에서 "AI로 바로 만들기" → 응답 뒤 백그라운드(after)로 startSiteBuild. 토큰은 차감하지 않는다(플랜 기본 제공).
 *           사용자마다 하루 AI_BUILDS_PER_USER_PER_DAY 번까지 (사이트를 지웠다 다시 만들어 무료 제작을 반복하지 않게).
 * 수정 요청 "요청하기" 뒤 백그라운드로 processBatch → 네모마다 processAiRequest.
 *           apply 반영 완료(토큰 차감) · ask 사용자에게 질문(차감 없음) · expert 담당자에게 넘김(차감 없음).
 *           요청 상태: 접수(pending) = AI 차례 (질문해 두고 답을 기다릴 때도 접수 + awaiting_user),
 *           AI 가 맡지 못하면 이유를 남기고 확인 완료(processing) = "담당자 확인 중" 으로 넘긴다 (config/requests.ts).
 *
 * 쓰기는 모두 service role 로 하고, 디자인 · 캡처 · 네모 위치는 ai_apply_design, 요청 마무리는 ai_finish_request 가 한 트랜잭션으로 한다 (0008).
 * 키가 없거나(aiConfigured) 0008 이 없거나 하루 비용 상한을 넘으면 AI 를 부르지 않고 지금처럼 담당자가 처리한다.
 * 실행마다 ai_runs 에 남긴다 — 나중에 자체 모델을 학습시킬 데이터다.
 */

type Admin = SupabaseClient;

let schemaOk = false;
/** 0008 이 적용됐는지 (ai_runs 가 있는지). 한 번 확인되면 기억한다 */
async function schemaReady(admin: Admin): Promise<boolean> {
  if (schemaOk) return true;
  const { error } = await admin.from("ai_runs").select("id").limit(1);
  if (error) {
    if (!isMissingSchema(error)) console.error("[ai] ai_runs check", error.message);
    return false;
  }
  schemaOk = true;
  return true;
}

function dailyBudgetUsd(): number {
  const v = Number(process.env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : AI_DAILY_BUDGET_USD_DEFAULT;
}

const dayAgo = () => new Date(Date.now() - 86_400_000).toISOString();

async function spentTodayUsd(admin: Admin): Promise<number> {
  const { data } = await admin.from("ai_runs").select("cost_usd").gte("created_at", dayAgo()).limit(10_000);
  return ((data as { cost_usd: number | string }[] | null) ?? []).reduce((n, r) => n + Number(r.cost_usd || 0), 0);
}

async function ownerPlan(admin: Admin, userId: string): Promise<Plan | null> {
  const { data } = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const sub = (data as SubscriptionRow | null) ?? null;
  return effectiveSubscription(sub).usable ? getPlan(sub?.plan_code as PlanCode | undefined) : null;
}

type Site = {
  projectId: string;
  userId: string;
  status: string;
  brief: ProjectBrief;
  pages: LayoutPage[];
  template: { slug: string; name: string } | null;
};

async function loadSite(admin: Admin, projectId: string): Promise<Site | null> {
  const { data: p } = await admin.from("projects").select("id, user_id, status, brief, template_id").eq("id", projectId).maybeSingle();
  if (!p) return null;
  const { data: pages } = await admin.from("project_pages").select("id, path, name, screenshots").eq("project_id", projectId).order("sort_order", { ascending: true });
  // 시작 템플릿은 지금도 구매한 상태여야 쓴다 (brief · template_id 는 사이트 주인이 직접 고칠 수 있다)
  let template: Site["template"] = null;
  if (p.template_id) {
    const { data: t } = await admin
      .from("template_purchases")
      .select("template:templates(slug, name)")
      .eq("user_id", p.user_id)
      .eq("template_id", p.template_id)
      .maybeSingle();
    const tt = (t as unknown as { template: { slug: string; name: string } | null } | null)?.template;
    if (tt) template = { slug: tt.slug, name: tt.name };
  }
  return { projectId: p.id, userId: p.user_id, status: p.status, brief: p.brief as ProjectBrief, pages: (pages as LayoutPage[]) ?? [], template };
}

async function insertRun(admin: Admin, row: Record<string, unknown>): Promise<string | null> {
  let { data, error } = await admin.from("ai_runs").insert({ prompt_version: PROMPT_VERSION, model: AI_MODEL, ...row }).select("id").single();
  // 0010 전 DB 에는 task 'bug'(오류 확인)가 없다 → 수정(edit)으로 남기고 입력에 표시해 둔다
  if (error?.code === "23514" && row.task === "bug") {
    const input = { ...((row.input as Record<string, unknown>) ?? {}), bugReport: true };
    ({ data, error } = await admin.from("ai_runs").insert({ prompt_version: PROMPT_VERSION, model: AI_MODEL, ...row, task: "edit", input }).select("id").single());
  }
  if (error || !data) {
    console.error("[ai] ai_runs insert", error?.message);
    return null;
  }
  return data.id as string;
}

async function finishRun(admin: Admin, id: string | null, patch: Record<string, unknown>): Promise<void> {
  if (!id) return;
  const { error } = await admin
    .from("ai_runs")
    .update({ finished_at: new Date().toISOString(), ...patch })
    .eq("id", id);
  if (error) console.error("[ai] ai_runs update", error.message);
}

/** Claude 결과 → 실행 기록 칸 */
function callFields<T>(res: CallResult<T>): Record<string, unknown> {
  return {
    model: res.model ?? AI_MODEL,
    usage: res.usage,
    cost_usd: Math.round(res.costUsd * 1_000_000) / 1_000_000,
    duration_ms: res.durationMs,
  };
}

/** 첫 제작 대기 표시를 끈다 (AI 를 부르지 못했거나 실패했을 때 편집기 안내가 계속 뜨지 않게) */
async function clearPending(admin: Admin, projectId: string): Promise<void> {
  const { data } = await admin.from("projects").select("brief").eq("id", projectId).maybeSingle();
  const brief = data?.brief as ProjectBrief | undefined;
  if (!brief?.design?.aiPending) return;
  await admin
    .from("projects")
    .update({ brief: { ...brief, design: { ...brief.design, aiPending: false } } })
    .eq("id", projectId);
}

async function postSiteMessage(admin: Admin, projectId: string, body: string): Promise<void> {
  const { error } = await admin.from("messages").insert({ project_id: projectId, author_role: "admin", body: body.slice(0, 2000), via: "ai" });
  if (error) console.error("[ai] site message", error.message);
}

async function siteRequests(admin: Admin, projectId: string): Promise<{ id: string; page_id: string; device: DeviceKind; region: Region }[]> {
  const { data } = await admin.from("change_requests").select("id, page_id, device, region").eq("project_id", projectId).limit(2000);
  return (data as { id: string; page_id: string; device: DeviceKind; region: Region }[] | null) ?? [];
}

/** 새 디자인 저장 (캡처 다시 그리기 + 네모 옮기기 + 디자인 문서를 한 트랜잭션). 그 사이 다른 수정이 먼저 반영됐으면 conflict */
async function saveDesign(admin: Admin, site: Site, from: DesignDoc, to: DesignDoc): Promise<"ok" | "conflict" | "error"> {
  const re = rerender(site.brief, from, to, site.pages, await siteRequests(admin, site.projectId));
  const { error } = await admin.rpc("ai_apply_design", {
    p_project_id: site.projectId,
    p_expected_version: from.version,
    p_design: to,
    p_pages: re.pages,
    p_regions: re.regions,
  });
  if (!error) return "ok";
  if (error.message.includes("VERSION_CONFLICT")) return "conflict";
  console.error("[ai] ai_apply_design", error.message);
  return "error";
}

function harnessSite(site: Site, design: DesignDoc, cms?: boolean): HarnessSite {
  return { brief: site.brief, design, template: site.template, cms };
}

/** 화면에 보이는 문구 ("페이지|키" → 글, 사이트 공통 문구는 페이지 칸이 비어 있다). paths 가 없으면 모든 페이지를 그린다 */
function shownCopy(brief: ProjectBrief, design: DesignDoc, paths?: readonly string[]): Map<string, string> {
  return new Map(copySlots(brief, design, paths).map((s) => [`${s.path}|${s.key}`, s.text]));
}

const shownText = (shown: Map<string, string>, path: string | undefined, key: string) => shown.get(`${path ?? ""}|${key}`) ?? shown.get(`|${key}`);

/**
 * 실제로 화면이 바뀐 것만 남긴다. 문구를 처음 바꾸면 before 가 비어 있으므로(기본 문구) 화면에 보이던 글로 채우고,
 * 보이던 글과 같은 값으로 "바꾼" 문구는 뺀다 — 사용자 안내와 학습 데이터에 실제 전 · 후만 남게.
 * hintPath 가 없으면 모든 페이지를 그려 찾는다 (첫 제작).
 */
function visibleChanges(brief: ProjectBrief, design: DesignDoc, changes: AppliedChange[], hintPath?: string): AppliedChange[] {
  const missing = changes.filter((c) => c.kind === "copy" && !c.before);
  const paths = hintPath === undefined ? undefined : [...new Set([hintPath, ...missing.flatMap((c) => (c.path ? [c.path] : []))])];
  const shown = missing.length ? shownCopy(brief, design, paths) : new Map<string, string>();
  return changes
    .map((c) => (c.kind === "copy" && !c.before ? { ...c, before: shownText(shown, c.path, c.key) ?? "" } : c))
    .filter((c) => c.kind !== "copy" || c.before.trim() !== c.after.trim());
}

/** 고객 자료로 만든 기본 문구와 같은 덮어쓰기는 지운다 (기본 문구로 두어야 고객 자료가 바뀔 때 함께 바뀐다) */
function withoutDefaults(copy: DesignDoc["copy"], defaults: Map<string, string>): DesignDoc["copy"] {
  const keep = (path: string, map: CopyMap): CopyMap => Object.fromEntries(Object.entries(map).filter(([k, v]) => shownText(defaults, path, k)?.trim() !== v.trim()));
  const pages = Object.entries(copy.pages)
    .map(([p, m]) => [p, keep(p, m)] as const)
    .filter(([, m]) => Object.keys(m).length > 0);
  return { site: keep("", copy.site), pages: Object.fromEntries(pages) };
}

const HUMAN_LATER = `담당자가 이어서 처리할게요 (${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간 안에 답변).`;

/** AI 가 맡지 못한 요청을 담당자에게 넘긴다: 이유를 대화에 남기고 "담당자 확인 중"(processing)으로 */
async function handToPerson(admin: Admin, requestId: string, body: string): Promise<void> {
  const { error } = await admin.rpc("ai_finish_request", { p_request_id: requestId, p_status: "processing", p_body: body, p_awaiting_user: false, p_tokens: 0, p_monthly_ai_tokens: null });
  if (error) console.error("[ai] hand to person", error.message);
}

/**
 * 멈춘 AI 처리 정리. 엔진이 돌 때마다, 관리자 화면을 열 때마다 부른다.
 * - AI_STALE_MINUTES 가 지나도 running 인 실행은 실패로 닫고, 그 요청은 담당자에게 넘긴다 (서버 재시작 · 시간 초과 대비).
 * - 요청하고 AI_QUEUE_MINUTES 가 지나도 AI 가 한 번도 손대지 않은 접수도 담당자에게 넘긴다
 *   (키가 없던 때 들어온 요청 · 처리가 시작되지 못한 요청). 키가 없으면 원래 담당자가 처리하므로 건드리지 않는다.
 */
export async function reapStaleRuns(admin: Admin = createAdminClient()): Promise<number> {
  if (!(await schemaReady(admin))) return 0;
  const cutoff = new Date(Date.now() - AI_STALE_MINUTES * 60_000).toISOString();
  const { data } = await admin.from("ai_runs").select("id, project_id, request_id, task").eq("status", "running").lt("created_at", cutoff).limit(50);
  const runs = (data as { id: string; project_id: string; request_id: string | null; task: string }[] | null) ?? [];
  for (const run of runs) {
    await finishRun(admin, run.id, { status: "error", error: `시간 초과 (${AI_STALE_MINUTES}분)` });
    if (run.task === "build") await clearPending(admin, run.project_id);
    if (run.request_id) {
      const { data: req } = await admin.from("change_requests").select("status, awaiting_user").eq("id", run.request_id).maybeSingle();
      if (req?.status === "pending" && !req.awaiting_user) await handToPerson(admin, run.request_id, `AI 처리가 늦어져 ${HUMAN_LATER}`);
    }
  }

  let queued = 0;
  if (aiConfigured()) {
    const old = new Date(Date.now() - AI_QUEUE_MINUTES * 60_000).toISOString();
    const { data: reqs } = await admin
      .from("change_requests")
      .select("id, kind, message")
      .in("kind", ["ai", "bug"])
      .eq("status", "pending")
      .eq("awaiting_user", false)
      .lt("created_at", old)
      .limit(50);
    const waiting = ((reqs as { id: string; kind: string; message: string }[] | null) ?? []).filter((r) => r.kind === "bug" || !isImageRequest(r.message));
    if (waiting.length) {
      // AI 가 질문한 적이 있는 요청(답을 받고 다시 처리할 차례)은 그대로 둔다
      const { data: touched } = await admin.from("ai_runs").select("request_id").in("request_id", waiting.map((r) => r.id));
      const seen = new Set(((touched as { request_id: string }[] | null) ?? []).map((t) => t.request_id));
      for (const r of waiting.filter((w) => !seen.has(w.id))) {
        await handToPerson(admin, r.id, r.kind === "bug" ? `AI가 바로 확인하지 못했어요. 담당자가 ${BUG_HOURS}시간 안에 확인하고 고쳐 드릴게요.` : `AI가 바로 처리하지 못했어요. ${HUMAN_LATER}`);
        queued += 1;
      }
    }
  }
  return runs.length + queued;
}

/** AI 를 부를 수 있는 상태인지 (관리자 화면 안내) */
export async function aiReadiness(): Promise<{ key: boolean; schema: boolean; spentUsd: number; budgetUsd: number }> {
  const key = aiConfigured();
  let schema = false;
  let spentUsd = 0;
  try {
    const admin = createAdminClient();
    schema = await schemaReady(admin);
    if (schema) spentUsd = await spentTodayUsd(admin);
  } catch {
    schema = false;
  }
  return { key, schema, spentUsd, budgetUsd: dailyBudgetUsd() };
}

// ---------------------------------------------------------------------------------------------
// 첫 제작
// ---------------------------------------------------------------------------------------------

/**
 * 위저드 "AI로 바로 만들기" 뒤에 부른다 (after). 규칙으로 만든 디자인을 AI 가 다듬는다: 테마 + 문구 + 태그 적용 설명.
 * force = 관리자가 "AI로 다시 만들기" 를 눌렀을 때 (하루 한도는 보지 않는다).
 */
export async function startSiteBuild(projectId: string, opts: { force?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, message: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 없습니다." };
  }
  let runId: string | null = null;
  try {
    if (!aiConfigured()) {
      await clearPending(admin, projectId);
      return { ok: false, message: "AI 키(ANTHROPIC_API_KEY)가 없어 AI 를 부르지 않았습니다." };
    }
    if (!(await schemaReady(admin))) {
      await clearPending(admin, projectId);
      return { ok: false, message: "0008_ai.sql 을 먼저 실행해 주세요." };
    }
    await reapStaleRuns(admin);
    const site = await loadSite(admin, projectId);
    if (!site?.brief.site || !site.brief.business) {
      await clearPending(admin, projectId);
      return { ok: false, message: "위저드로 만든 사이트만 AI 가 만들 수 있습니다." };
    }
    const from = designOf(site.brief);
    const skip = async (why: string) => {
      await insertRun(admin, { project_id: projectId, user_id: site.userId, task: "build", status: "skipped", error: why, input: {}, design_version_before: from.version, finished_at: new Date().toISOString() });
      await clearPending(admin, projectId);
      return { ok: false, message: why };
    };
    const plan = await ownerPlan(admin, site.userId);
    if (!plan) return skip("플랜이 없어 AI 첫 제작을 건너뛰었습니다.");
    if (!opts.force) {
      const { count } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("user_id", site.userId).eq("task", "build").neq("status", "skipped").gte("created_at", dayAgo());
      if ((count ?? 0) >= AI_BUILDS_PER_USER_PER_DAY) return skip(`AI 첫 제작은 하루 ${AI_BUILDS_PER_USER_PER_DAY}번까지예요.`);
    }
    if ((await spentTodayUsd(admin)) >= dailyBudgetUsd()) return skip("오늘 AI 비용 상한에 도달했습니다 (AI_DAILY_BUDGET_USD).");

    const prompt = buildPrompt(harnessSite(site, from));
    const tags = normalizeStyles(site.brief.styleTags?.length ? site.brief.styleTags : site.brief.tone);
    runId = await insertRun(admin, {
      project_id: projectId,
      user_id: site.userId,
      task: "build",
      effort: AI_EFFORT.build,
      design_version_before: from.version,
      input: {
        styleTags: tags,
        template: site.template?.slug ?? null,
        benchmarks: (site.brief.benchmarks ?? []).map((b) => ({ url: b.url, permission: b.permission, aspects: b.aspects })),
        skills: prompt.skills.map((s) => s.id),
        user: prompt.user,
      },
    });

    const res = await callStructured({ system: prompt.system, user: prompt.user, schema: BuildOutput, effort: AI_EFFORT.build, maxTokens: AI_MAX_TOKENS.build });
    if (!res.ok) {
      await finishRun(admin, runId, { status: res.reason === "refused" ? "refused" : "error", error: res.error, ...callFields(res) });
      await clearPending(admin, projectId);
      return { ok: false, message: res.error };
    }

    const out = res.data;
    const theme = sanitizeTheme({ ...out.theme, primary: site.brief.primaryColor }, from.theme);
    const base: DesignDoc = { ...from, theme, copy: { site: {}, pages: {} } };
    const pagePaths = site.brief.site.pages.map((p) => p.path);
    const { doc, applied, rejected } = applyChanges(
      base,
      {
        copy: [
          ...out.siteCopy.map((c) => ({ scope: "site" as const, key: c.key, value: c.value })),
          ...out.pageCopy.map((c) => ({ scope: "page" as const, path: c.path, key: c.key, value: c.value })),
        ],
      },
      pagePaths,
      copyLimits(site.brief),
    );
    const to: DesignDoc = {
      ...doc,
      copy: withoutDefaults(doc.copy, shownCopy(site.brief, base)),
      version: from.version + 1,
      source: "ai",
      styleTags: tags,
      appliedTags: out.appliedTags
        .filter((t): t is { tag: (typeof tags)[number]; how: string } => (tags as string[]).includes(t.tag))
        .map((t) => ({ tag: t.tag, how: t.how.replace(/[<>]/g, "").trim().slice(0, 160) }))
        .slice(0, 4),
      notes: out.notes.replace(/[<>]/g, "").trim().slice(0, 800),
      aiPending: false,
      updatedAt: new Date().toISOString(),
    };
    const themeChanges: AppliedChange[] = (Object.keys(theme) as (keyof typeof theme)[])
      .filter((k) => String(theme[k]) !== String(from.theme[k]))
      .map((k) => ({ kind: "theme", key: k, before: String(from.theme[k]), after: String(theme[k]) }));

    const saved = await saveDesign(admin, site, from, to);
    if (saved !== "ok") {
      await finishRun(admin, runId, { status: "error", error: saved === "conflict" ? "그 사이 디자인이 바뀌어 반영하지 않았습니다" : "디자인 저장 실패", output: out, ...callFields(res) });
      await clearPending(admin, projectId);
      return { ok: false, message: "디자인을 저장하지 못했습니다." };
    }
    await finishRun(admin, runId, {
      status: "applied",
      output: out,
      applied: { changes: [...themeChanges, ...visibleChanges(site.brief, from, applied)], rejected },
      design_version_after: to.version,
      tokens_billed: 0,
      ...callFields(res),
    });
    const tagLine = tags.length ? `고르신 디자인 유형(${tagNames(tags)})에 맞춰` : "업종에 맞춰";
    await postSiteMessage(admin, projectId, `AI가 ${tagLine} 첫 디자인을 만들었어요. ${to.notes ?? ""}\n편집기에서 바로 확인하고, 고칠 곳은 빨간 네모로 요청해 주세요.`.trim());
    return { ok: true, message: "AI 가 첫 디자인을 만들었습니다." };
  } catch (e) {
    console.error("[ai] build", e);
    await finishRun(admin, runId, { status: "error", error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
    await clearPending(admin, projectId).catch(() => undefined);
    return { ok: false, message: "AI 처리 중 오류가 났습니다." };
  }
}

// ---------------------------------------------------------------------------------------------
// 수정 요청
// ---------------------------------------------------------------------------------------------

type RequestRow = {
  id: string;
  project_id: string;
  page_id: string;
  device: DeviceKind;
  kind: string;
  status: string;
  region: Region;
  message: string;
  awaiting_user: boolean;
  tokens_used: number;
  options: RequestOptions | null;
};

const DEVICE_RANK: Record<DeviceKind, number> = { mobile: 0, tablet: 1, desktop: 2 };

export type QueueItem = { id: string; kind: "ai" | "bug"; page_id: string; device: DeviceKind; seq: number; message: string; pageName: string; path: string };

/**
 * 한 묶음에서 AI 가 차례로 맡는 네모: AI 반영(이미지 생성 요청 제외) 먼저, 그다음 오류 신고(AI 가 먼저 확인).
 * 각각 편집기 패널과 같은 순서 — 페이지 순서 → 화면 → 네모 번호. 진행 화면(lib/ai/progress.ts)도 이 순서를 쓴다.
 */
export async function batchQueue(admin: Admin, batchId: string): Promise<QueueItem[]> {
  const { data } = await admin.from("change_requests").select("id, project_id, kind, page_id, device, seq, message").eq("batch_id", batchId).in("kind", ["ai", "bug"]).limit(200);
  const rows = ((data as (Omit<QueueItem, "pageName" | "path"> & { project_id: string })[] | null) ?? []).filter((r) => r.kind === "bug" || !isImageRequest(r.message));
  if (!rows.length) return [];
  const { data: pages } = await admin.from("project_pages").select("id, name, path, sort_order").eq("project_id", rows[0].project_id);
  const pageById = new Map(((pages as { id: string; name: string; path: string; sort_order: number }[] | null) ?? []).map((p) => [p.id, p]));
  return [...rows]
    .sort((a, b) => queueOrder(a, b, (id) => pageById.get(id)?.sort_order ?? 0))
    .map((r) => ({ id: r.id, kind: r.kind, page_id: r.page_id, device: r.device, seq: r.seq, message: r.message, pageName: pageById.get(r.page_id)?.name ?? "", path: pageById.get(r.page_id)?.path ?? "" }));
}

/** 묶음 안 순서: AI 반영 → 오류 신고, 그 안에서 페이지 순서 → 화면 → 네모 번호 */
export function queueOrder(
  a: { kind: string; page_id: string; device: DeviceKind; seq: number },
  b: { kind: string; page_id: string; device: DeviceKind; seq: number },
  pageRank: (pageId: string) => number,
): number {
  return (a.kind === "bug" ? 1 : 0) - (b.kind === "bug" ? 1 : 0) || pageRank(a.page_id) - pageRank(b.page_id) || DEVICE_RANK[a.device] - DEVICE_RANK[b.device] || a.seq - b.seq;
}

/**
 * "요청하기" 뒤에 부른다 (after). 그 묶음의 AI 반영 네모를 하나씩 순서대로 처리한다 — 같은 사이트의 디자인을 차례로 바꾸므로,
 * 앞 네모가 반영된 새 화면 위에서 다음 네모를 처리한다. 네모마다 함께 보낸 다른 요청(먼저 반영된 것 · 다음 차례)을 AI 에게 알려 준다.
 * 그다음 오류 신고를 하나씩 AI 가 먼저 확인한다 (processBugReport).
 * 진행 상황은 ai_runs 에 남아 편집기의 "AI 작업 중" 화면이 1초마다 읽는다 (lib/ai/progress.ts).
 */
export async function processBatch(batchId: string): Promise<void> {
  if (!aiConfigured()) return;
  try {
    const admin = createAdminClient();
    if (!(await schemaReady(admin))) return;
    const queue = await batchQueue(admin, batchId);
    const edits = queue.filter((q) => q.kind === "ai");
    const done = new Map<string, { state: BatchPeer["state"]; summary?: string }>();
    for (const [i, r] of edits.entries()) {
      const others: BatchPeer[] = edits
        .filter((o) => o.id !== r.id)
        .map((o) => {
          const d = done.get(o.id);
          return {
            order: edits.indexOf(o) + 1,
            where: `${o.pageName} (${o.path}) · ${DEVICE_LABEL[o.device]} 화면 · 네모 ${o.seq}`,
            message: o.message,
            state: d ? d.state : "waiting",
            summary: d?.summary,
          };
        });
      const res = await processAiRequest(r.id, { batch: { index: i + 1, total: edits.length, others } });
      done.set(r.id, { state: res.outcome === "applied" ? "done" : "other", summary: res.summary });
    }
    for (const r of queue.filter((q) => q.kind === "bug")) await processBugReport(r.id);
  } catch (e) {
    console.error("[ai] batch", e);
  }
}

/**
 * 되돌리기: 고른 AI 변경(최근 것부터)의 값을 그 전 값으로. 그 뒤에 다른 요청이 같은 곳을 또 바꿨으면(지금 값이 그 변경의 결과가 아니면)
 * 건드리지 않는다. 결과는 applyChanges 에 넘길 바꿀 값 목록 — 검사 · 기록은 수정 요청과 같은 길로 간다.
 */
function revertChanges(doc: DesignDoc, runs: { applied: { changes?: AppliedChange[] } | null }[]): { theme: ThemeChange[]; copy: CopyChange[] } {
  const theme: Record<string, unknown> = { ...doc.theme };
  const site: CopyMap = { ...doc.copy.site };
  const pages: Record<string, CopyMap> = Object.fromEntries(Object.entries(doc.copy.pages).map(([k, v]) => [k, { ...v }]));
  for (const run of runs) {
    for (const c of run.applied?.changes ?? []) {
      if (c.kind === "theme") {
        if (String(theme[c.key]) === c.after) theme[c.key] = c.before;
      } else if (c.kind !== "copy") {
        // 관리자 목록은 되돌리지 않는다 (사이트 주인이 이미 글을 올렸을 수 있다 — 담당자가 본다)
        continue;
      } else if (c.path) {
        if (pages[c.path]?.[c.key] === c.after && c.before) pages[c.path] = { ...pages[c.path], [c.key]: c.before };
      } else if (site[c.key] === c.after && c.before) {
        site[c.key] = c.before;
      }
    }
  }
  return {
    theme: THEME_KEYS.filter((k) => String(theme[k]) !== String(doc.theme[k])).map((k) => ({ key: k, value: String(theme[k]) })),
    copy: [
      ...Object.entries(site)
        .filter(([k, v]) => doc.copy.site[k] !== v)
        .map(([key, value]) => ({ scope: "site" as const, path: null, key, value })),
      ...Object.entries(pages).flatMap(([path, map]) =>
        Object.entries(map)
          .filter(([k, v]) => doc.copy.pages[path]?.[k] !== v)
          .map(([key, value]) => ({ scope: "page" as const, path, key, value })),
      ),
    ],
  };
}

type RecentRun = { id: string; created_at: string; input: { message?: string; page?: string; device?: DeviceKind } | null; applied: { changes?: AppliedChange[] } | null };

/**
 * 오류 신고 하나를 AI 가 먼저 확인한다. 고객에게 비용이 들지 않는다 (우리 쪽 실수를 고치는 일).
 *  revert 최근 AI 변경 때문이면 그 변경을 되돌린다 · fix 테마 · 문구로 고칠 수 있으면 고친다 → "고침 완료"
 *  person 그 밖 · 확신이 없으면 담당자(관리자)에게 넘긴다 → "담당자 확인 중", BUG_HOURS(24시간) 안에 고친다
 * 되돌린 AI 변경의 실행 기록에는 평가 "잘못함" 을 붙인다 (학습 데이터의 오답 표시). 담당자가 이미 평가했으면 그대로 둔다.
 */
export async function processBugReport(requestId: string): Promise<ProcessResult> {
  if (!aiConfigured()) return { ok: false, message: "AI 키(ANTHROPIC_API_KEY)가 없습니다." };
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, message: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 없습니다." };
  }
  if (!(await schemaReady(admin))) return { ok: false, message: "0008_ai.sql 을 먼저 실행해 주세요." };
  await reapStaleRuns(admin);

  const { data } = await admin.from("change_requests").select("id, project_id, page_id, device, kind, status, region, message, awaiting_user").eq("id", requestId).maybeSingle();
  const req = data as Pick<RequestRow, "id" | "project_id" | "page_id" | "device" | "kind" | "status" | "region" | "message" | "awaiting_user"> | null;
  if (!req || req.kind !== "bug") return { ok: false, message: "오류 신고만 확인합니다." };
  if (req.status !== "pending" || req.awaiting_user) return { ok: false, message: "AI 가 확인할 차례가 아닙니다." };
  const { count: running } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("status", "running");
  if ((running ?? 0) > 0) return { ok: false, message: "이미 AI 가 확인하고 있습니다." };

  /** 담당자(관리자)에게 넘긴다: 이유를 대화에 남기고 "담당자 확인 중" — 관리자 화면에 24시간 기한으로 보인다 */
  const escalate = async (forUser: string): Promise<ProcessResult> => {
    const promise = `담당자가 ${BUG_HOURS}시간 안에 확인하고 고쳐 드릴게요.`;
    await handToPerson(admin, requestId, forUser.includes(`${BUG_HOURS}시간`) ? forUser : `${forUser} ${promise}`);
    return { ok: true, message: "담당자에게 넘겼습니다.", outcome: "handoff", summary: forUser };
  };

  const site = await loadSite(admin, req.project_id);
  const page = site?.pages.find((p) => p.id === req.page_id);
  const planned = site && page ? plannedOf(site.brief, page.path) : undefined;
  if (!site || !page || !planned || !page.screenshots[req.device]?.draft) return escalate("이 화면은 AI가 바로 확인할 수 없는 형식이에요.");
  if ((await spentTodayUsd(admin)) >= dailyBudgetUsd()) return escalate("지금은 AI가 바로 확인하지 못했어요.");

  // 최근 AI 변경 (수정 요청 반영 · 앞선 오류 확인으로 고친 것). 최근 것이 1번
  const { data: runData } = await admin
    .from("ai_runs")
    .select("id, created_at, input, applied")
    .eq("project_id", site.projectId)
    .in("task", ["edit", "bug"])
    .eq("status", "applied")
    .order("created_at", { ascending: false })
    .limit(8);
  const runs = ((runData as RecentRun[] | null) ?? []).filter((r) => (r.applied?.changes ?? []).length > 0);
  const recent: RecentChange[] = runs.map((r, i) => ({
    no: i + 1,
    at: formatDateTime(r.created_at),
    where: `${r.input?.page ?? ""} · ${r.input?.device ? DEVICE_LABEL[r.input.device] : ""}`,
    message: r.input?.message ?? "",
    changes: (r.applied?.changes ?? []).map(describeChange),
  }));

  const from = designOf(site.brief);
  const layout = renderPage(site.brief, from, planned, req.device);
  if (!layout) return escalate("AI가 화면을 그리지 못했어요.");
  const prompt = bugPrompt(harnessSite(site, from), { message: req.message, device: req.device, region: req.region, pagePath: page.path }, layout, recent);
  const runId = await insertRun(admin, {
    project_id: site.projectId,
    user_id: site.userId,
    request_id: requestId,
    task: "bug",
    effort: AI_EFFORT.edit,
    design_version_before: from.version,
    output: { live: { stage: "thinking" } },
    input: {
      message: req.message,
      page: page.path,
      device: req.device,
      region: req.region,
      sections: prompt.region.sections.map((s) => s.id),
      fields: prompt.region.fields.map((f) => ({ key: f.key, text: f.text })),
      recentRuns: runs.map((r) => r.id),
      skills: prompt.skills.map((s) => s.id),
      user: prompt.user,
    },
  });

  let liveWrites: Promise<void> = Promise.resolve();
  const live = (l: LiveStage) => {
    liveWrites = liveWrites.then(() => setLive(admin, runId, l));
  };

  try {
    const res = await callStructured({
      system: prompt.system,
      user: prompt.user,
      schema: BugOutput,
      effort: AI_EFFORT.edit,
      maxTokens: AI_MAX_TOKENS.edit,
      onProgress: (p) => live({ stage: "writing", decision: p.decision, summary: p.summary }),
    });
    await liveWrites;
    if (!res.ok) {
      await finishRun(admin, runId, { status: res.reason === "refused" ? "refused" : "error", error: res.error, ...callFields(res) });
      return escalate("AI가 이 오류를 확인하지 못했어요.");
    }
    const out = res.data;
    const summary = out.summary.replace(/[<>]/g, "").trim().slice(0, 600);
    const handOff = async (forUser: string, patch: Record<string, unknown> = {}) => {
      await finishRun(admin, runId, { status: "handoff", output: out, tokens_billed: 0, ...callFields(res), ...patch });
      return escalate(forUser);
    };
    if (out.decision === "person") return handOff(summary || "AI가 확인해 보니 담당자가 직접 봐야 하는 오류예요.");

    // 되돌릴 변경(최근 것부터) + 고칠 값. 그 사이 다른 수정이 먼저 반영됐으면(버전 충돌) 최신 디자인에서 한 번 더
    const picked = out.decision === "revert" ? [...new Set(out.revertRuns)].filter((n) => n >= 1 && n <= runs.length).sort((a, b) => a - b).map((n) => runs[n - 1]) : [];
    let current = site;
    let before = from;
    for (let attempt = 0; attempt < 2; attempt++) {
      const pagePaths = current.brief.site?.pages.map((p) => p.path) ?? [];
      const back = revertChanges(before, picked);
      const { doc, applied, rejected } = applyChanges(
        before,
        {
          theme: [...back.theme, ...out.themeChanges.map((c) => ({ key: c.key, value: c.value }))],
          copy: [...back.copy, ...out.copyChanges.map((c) => ({ scope: c.scope, path: c.scope === "page" ? c.path || page.path : null, key: c.key, value: c.value }))],
        },
        pagePaths,
        copyLimits(current.brief),
      );
      const changes = visibleChanges(current.brief, before, applied, page.path);
      if (!changes.length) return handOff(`${summary ? `${summary} ` : ""}AI가 고칠 값을 찾지 못했어요.`, { applied: { changes: [], rejected } });
      const to: DesignDoc = { ...doc, version: before.version + 1, source: "ai", aiPending: false, updatedAt: new Date().toISOString() };
      await setLive(admin, runId, { stage: "rendering", decision: out.decision, summary });
      const saved = await saveDesign(admin, current, before, to);
      if (saved === "conflict" && attempt === 0) {
        const fresh = await loadSite(admin, site.projectId);
        if (!fresh) break;
        current = fresh;
        before = designOf(fresh.brief);
        continue;
      }
      if (saved !== "ok") break;
      const { error } = await admin.rpc("ai_finish_request", {
        p_request_id: requestId,
        p_status: "done",
        p_body: `AI가 확인하고 고쳤어요. ${summary}\n· ${changes.map(describeChange).join("\n· ")}`.slice(0, 2000),
        p_awaiting_user: false,
        p_tokens: 0,
        p_monthly_ai_tokens: null,
      });
      if (error) console.error("[ai] bug finish", error.message);
      await finishRun(admin, runId, {
        status: "applied",
        output: out,
        applied: { changes, rejected, reverted: picked.map((r) => r.id) },
        design_version_after: to.version,
        tokens_billed: 0,
        ...callFields(res),
      });
      if (picked.length) {
        await admin
          .from("ai_runs")
          .update({ review: "bad", review_note: "오류 신고로 되돌림" })
          .in("id", picked.map((r) => r.id))
          .is("review", null);
      }
      return { ok: true, message: "AI 가 오류를 고쳤습니다.", outcome: "applied", summary };
    }
    return handOff("AI가 고친 내용을 저장하지 못했어요.", { status: "error", error: "디자인 저장 실패" });
  } catch (e) {
    console.error("[ai] bug", e);
    await liveWrites.catch(() => undefined);
    await finishRun(admin, runId, { status: "error", error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
    return escalate("AI가 확인하는 중에 문제가 생겼어요.");
  }
}

/**
 * 처리 중 진행 단계 (편집기 "AI 작업 중" 화면). 처리 중인 실행의 output 칸에 { live } 로 적어 두고, 끝나면 진짜 출력으로 덮어쓴다.
 * thinking AI 가 고칠 방법을 정하는 중 · writing 답을 쓰는 중(앞쪽 decision · summary 가 오면 같이) · rendering 새 화면을 그리는 중
 */
type LiveStage = { stage: "thinking" | "writing" | "rendering" | "database"; decision?: string; summary?: string };

async function setLive(admin: Admin, runId: string | null, live: LiveStage): Promise<void> {
  if (!runId) return;
  const summary = live.summary?.replace(/[<>]/g, "").trim().slice(0, 600);
  // 이미 끝난 실행(진짜 출력)은 덮어쓰지 않는다
  const { error } = await admin.from("ai_runs").update({ output: { live: { ...live, summary } } }).eq("id", runId).eq("status", "running");
  if (error) console.error("[ai] live", error.message);
}

/**
 * 네모 하나 처리. AI 차례(접수 · 사용자 답을 기다리지 않음)인 요청만 처리한다.
 * 키 · 0008 이 없거나 이미지 생성 요청이면 부르지 않고(원래 담당자 몫), 구성 초안이 아닌 예전 사이트 · 플랜 없음 · 하루 비용 상한이면
 * 이유를 남기고 담당자에게 넘긴다. 질문을 이미 AI_MAX_QUESTIONS 번 했으면 더 묻지 않고 넘긴다.
 * force = 관리자의 "AI로 다시 처리" (끝난 요청 · 담당자에게 넘긴 요청도 다시 처리할 수 있고, 처리하지 못해도 상태는 그대로 둔다).
 */
export type ProcessResult = { ok: boolean; message: string; outcome?: "applied" | "asked" | "handoff" | "error"; summary?: string };

export async function processAiRequest(requestId: string, opts: { force?: boolean; batch?: EditRequest["batch"] } = {}): Promise<ProcessResult> {
  if (!aiConfigured()) return { ok: false, message: "AI 키(ANTHROPIC_API_KEY)가 없습니다." };
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, message: "서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 없습니다." };
  }
  if (!(await schemaReady(admin))) return { ok: false, message: "0008_ai.sql 을 먼저 실행해 주세요." };
  await reapStaleRuns(admin);

  const { data } = await admin
    .from("change_requests")
    .select("id, project_id, page_id, device, kind, status, region, message, awaiting_user, tokens_used, options")
    .eq("id", requestId)
    .maybeSingle();
  const req = data as RequestRow | null;
  if (!req) return { ok: false, message: "요청을 찾을 수 없습니다." };
  if (req.kind !== "ai") return { ok: false, message: "AI 반영 요청만 AI 가 처리합니다." };
  if (isImageRequest(req.message)) return { ok: false, message: "이미지 생성 요청은 담당자가 처리합니다." };
  if (!opts.force && (req.status !== "pending" || req.awaiting_user)) return { ok: false, message: "AI 차례가 아닙니다 (담당자가 맡았거나 사용자 답을 기다리는 중)." };

  const { count: running } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("status", "running");
  if ((running ?? 0) > 0) return { ok: false, message: "이미 AI 가 처리하고 있습니다." };

  /** AI 가 맡을 수 없으면 사용자에게 이유를 남기고 담당자에게 넘긴다 (관리자의 다시 처리는 상태를 바꾸지 않고 이유만 돌려준다) */
  const leave = async (forUser: string, forAdmin: string): Promise<ProcessResult> => {
    if (!opts.force) await handToPerson(admin, requestId, `${forUser} ${HUMAN_LATER}`);
    return { ok: false, message: forAdmin, outcome: "handoff", summary: forUser };
  };

  const site = await loadSite(admin, req.project_id);
  const page = site?.pages.find((p) => p.id === req.page_id);
  const planned = site && page ? plannedOf(site.brief, page.path) : undefined;
  if (!site || !page || !planned || !page.screenshots[req.device]?.draft) return leave("이 사이트는 AI가 바로 고칠 수 없는 형식이에요.", "구성 초안으로 만든 사이트만 AI 가 고칠 수 있습니다.");

  const plan = await ownerPlan(admin, site.userId);
  if (!plan) return leave("지금 플랜으로는 AI가 처리할 수 없어요.", "사이트 주인의 플랜이 없습니다.");
  if ((await spentTodayUsd(admin)) >= dailyBudgetUsd()) return leave("지금은 AI 요청이 많아 바로 처리하지 못했어요.", "오늘 AI 비용 상한에 도달했습니다 (AI_DAILY_BUDGET_USD).");

  const { count: asked } = await admin.from("ai_runs").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("status", "asked");
  const tooManyQuestions = (asked ?? 0) >= AI_MAX_QUESTIONS;

  // 네모별 옵션: 디자인 유형 · 참고 템플릿 (템플릿은 지금도 구매한 것만)
  const styles = normalizeStyles(req.options?.styles ?? []);
  let refTemplate: { design: NonNullable<ReturnType<typeof templateDesign>>; name: string } | null = null;
  if (req.options?.templateId) {
    const { data: t } = await admin
      .from("template_purchases")
      .select("template:templates(slug, name)")
      .eq("user_id", site.userId)
      .eq("template_id", req.options.templateId)
      .maybeSingle();
    const tt = (t as unknown as { template: { slug: string; name: string } | null } | null)?.template;
    const d = tt ? templateDesign(tt.slug) : null;
    if (tt && d) refTemplate = { design: d, name: tt.name };
  }

  // 이 요청의 앞선 대화 (AI 질문 → 고객 답)
  const { data: msgs } = await admin.from("messages").select("author_role, body, via").eq("request_id", requestId).not("body", "is", null).order("created_at", { ascending: true }).limit(20);
  const conversation = ((msgs as { author_role: string; body: string; via: string | null }[] | null) ?? [])
    .filter((m) => m.author_role === "user" || m.via === "ai")
    .slice(-6)
    .map((m) => ({ role: m.author_role === "user" ? ("user" as const) : ("ai" as const), body: m.body }));

  const from = designOf(site.brief);
  const layout = renderPage(site.brief, from, planned, req.device);
  if (!layout) return { ok: false, message: "그림을 그리지 못했습니다." };
  const prompt = editPrompt(
    harnessSite(site, from, plan.cms),
    { message: req.message, device: req.device, region: req.region, pagePath: page.path, styles, template: refTemplate, conversation, batch: opts.batch },
    layout,
  );
  const runId = await insertRun(admin, {
    project_id: site.projectId,
    user_id: site.userId,
    request_id: requestId,
    task: "edit",
    effort: AI_EFFORT.edit,
    design_version_before: from.version,
    // 처리하는 동안은 진행 단계 (끝나면 진짜 출력으로 바뀐다)
    output: { live: { stage: "thinking" } },
    input: {
      message: req.message,
      page: page.path,
      device: req.device,
      region: req.region,
      sections: prompt.region.sections.map((s) => s.id),
      fields: prompt.region.fields.map((f) => ({ key: f.key, text: f.text })),
      styles,
      template: refTemplate?.design.slug ?? null,
      siteStyles: normalizeStyles(site.brief.styleTags?.length ? site.brief.styleTags : site.brief.tone),
      batch: opts.batch ? { index: opts.batch.index, total: opts.batch.total } : null,
      skills: prompt.skills.map((s) => s.id),
      user: prompt.user,
    },
  });

  const handOff = async (body: string, patch: Record<string, unknown>) => {
    await handToPerson(admin, requestId, body);
    await finishRun(admin, runId, { status: "handoff", ...patch });
  };

  // 답을 받는 도중의 진행 단계는 순서대로 기록한다 (스트림 이벤트는 기다려 주지 않으므로 이어 붙인다)
  let liveWrites: Promise<void> = Promise.resolve();
  const live = (l: LiveStage) => {
    liveWrites = liveWrites.then(() => setLive(admin, runId, l));
  };

  try {
    const res = await callStructured({
      system: prompt.system,
      user: prompt.user,
      schema: EditOutput,
      effort: AI_EFFORT.edit,
      maxTokens: AI_MAX_TOKENS.edit,
      onProgress: (p) => live({ stage: "writing", decision: p.decision, summary: p.summary }),
    });
    await liveWrites;
    if (!res.ok) {
      await handToPerson(admin, requestId, `AI가 이 요청을 처리하지 못했어요. ${HUMAN_LATER}`);
      await finishRun(admin, runId, { status: res.reason === "refused" ? "refused" : "error", error: res.error, ...callFields(res) });
      return { ok: false, message: res.error, outcome: "error" };
    }
    const out = res.data;
    const summary = out.summary.replace(/[<>]/g, "").trim().slice(0, 600);

    // 질문: 접수(AI 차례) 그대로 두고 사용자 답을 기다린다 — 답글이 오면 resumeAfterAnswer 가 이어서 처리한다
    if (out.decision === "ask" && !tooManyQuestions && out.question.trim()) {
      await admin.rpc("ai_finish_request", {
        p_request_id: requestId,
        p_status: "pending",
        p_body: `AI가 확인하고 싶은 게 있어요: ${out.question.replace(/[<>]/g, "").trim().slice(0, 600)}\n답글을 남겨 주시면 이어서 반영할게요.`,
        p_awaiting_user: true,
        p_tokens: 0,
        p_monthly_ai_tokens: null,
      });
      await finishRun(admin, runId, { status: "asked", output: out, ...callFields(res) });
      return { ok: true, message: "AI 가 사용자에게 질문했습니다.", outcome: "asked", summary: out.question.trim().slice(0, 300) };
    }
    if (out.decision !== "apply") {
      await handOff(`${summary || "AI 가 바로 고칠 수 없는 요청이에요."} ${HUMAN_LATER}`, { output: out, ...callFields(res) });
      return { ok: true, message: "담당자에게 넘겼습니다.", outcome: "handoff", summary };
    }

    // 관리자 목록: 플랜이 관리자 페이지를 쓸 수 없으면 만들지 않고 알린다 (AI 가 지시서를 어기고 목록을 보냈을 때의 안전장치)
    const wantsData = out.collectionChanges.length > 0;
    if (wantsData && !plan.cms) {
      if (tooManyQuestions) {
        await handOff(`관리자 페이지(목록을 직접 올리고 고치기)는 비즈니스 플랜부터 쓸 수 있어요. ${HUMAN_LATER}`, { output: out, ...callFields(res) });
        return { ok: true, message: "플랜에 관리자 페이지가 없어 담당자에게 넘겼습니다.", outcome: "handoff" };
      }
      await admin.rpc("ai_finish_request", {
        p_request_id: requestId,
        p_status: "pending",
        p_body: "목록을 관리자 페이지에서 직접 올리고 고치는 기능은 비즈니스 플랜부터 쓸 수 있어요. 플랜을 올린 뒤 답글을 남겨 주시면 이어서 만들어 드릴게요.",
        p_awaiting_user: true,
        p_tokens: 0,
        p_monthly_ai_tokens: null,
      });
      await finishRun(admin, runId, { status: "asked", output: out, ...callFields(res) });
      return { ok: true, message: "플랜에 관리자 페이지가 없어 사용자에게 알렸습니다.", outcome: "asked" };
    }
    // 이미 사이트 DB 에 있는 표 · 칸 (칸 종류는 바꿀 수 없다)
    let known: SchemaSnapshot = {};
    if (wantsData) {
      try {
        known = (await getSiteDatabase(site.projectId, admin)).schema;
      } catch (e) {
        console.error("[ai] site db", e);
      }
    }

    // 반영: 그 사이 다른 수정이 먼저 반영됐으면(버전 충돌) 최신 디자인에 같은 변경을 다시 얹는다 (한 번)
    let current = site;
    let before = from;
    for (let attempt = 0; attempt < 2; attempt++) {
      const pagePaths = current.brief.site?.pages.map((p) => p.path) ?? [];
      const { doc, applied, rejected } = applyChanges(
        before,
        {
          theme: out.themeChanges.map((c) => ({ key: c.key, value: c.value })),
          copy: out.copyChanges.map((c) => ({ scope: c.scope, path: c.scope === "page" ? c.path || page.path : null, key: c.key, value: c.value })),
        },
        pagePaths,
        copyLimits(current.brief),
      );
      const data = wantsData ? applyCollectionChanges(doc.collections ?? [], out.collectionChanges, pagePaths, known) : null;
      const changes: AppliedChange[] = [
        ...visibleChanges(current.brief, before, applied, page.path),
        ...(data?.applied ?? []).map((d) => ({ kind: "data" as const, key: d.key, before: d.before, after: d.after })),
      ];
      const allRejected = [...rejected, ...(data?.rejected ?? [])];
      if (!changes.length) {
        await handOff(`${summary ? `${summary} ` : ""}AI 가 바꿀 수 있는 값을 찾지 못했어요. ${HUMAN_LATER}`, { output: out, applied: { changes: [], rejected: allRejected }, ...callFields(res) });
        return { ok: true, message: "바꿀 값이 없어 담당자에게 넘겼습니다.", outcome: "handoff", summary };
      }
      const to: DesignDoc = {
        ...doc,
        ...(data ? { collections: data.collections } : {}),
        version: before.version + 1,
        source: "ai",
        aiPending: false,
        updatedAt: new Date().toISOString(),
      };
      // 관리자 목록이 바뀌면 사이트 데이터 저장소에 표 · 칸부터 만든다 (실패하면 디자인도 바꾸지 않고 담당자에게)
      if (data?.applied.length) {
        await setLive(admin, runId, { stage: "database", decision: out.decision, summary });
        const synced = await syncSiteSchema(site.projectId, to.collections ?? [], { source: "ai", requestId, runId, waitMs: SITE_DB_AI_WAIT_MS });
        if (!synced.ok) {
          await handOff(`${summary ? `${summary} ` : ""}관리자 페이지를 만드는 중에 문제가 생겼어요. ${HUMAN_LATER}`, {
            status: "error",
            error: synced.reason,
            output: out,
            applied: { changes, rejected: allRejected },
            ...callFields(res),
          });
          return { ok: false, message: synced.reason, outcome: "error" };
        }
      }
      await setLive(admin, runId, { stage: "rendering", decision: out.decision, summary });
      const saved = await saveDesign(admin, current, before, to);
      if (saved === "conflict" && attempt === 0) {
        const fresh = await loadSite(admin, site.projectId);
        if (!fresh) break;
        current = fresh;
        before = designOf(fresh.brief);
        continue;
      }
      if (saved !== "ok") break;
      const tokens = (req.tokens_used ?? 0) + res.billed;
      const changed = changes.map(describeChange).join("\n· ");
      // 관리자 목록을 만들었거나 바꿨으면 글을 올릴 곳을 알려 준다 (대화의 주소는 링크로 보인다)
      const adminLink = data?.applied.some((d) => d.after) ? `\n관리자 페이지에서 글을 올릴 수 있어요: ${getServerEnv().APP_URL}/projects/${site.projectId}/admin` : "";
      const { error } = await admin.rpc("ai_finish_request", {
        p_request_id: requestId,
        p_status: "done",
        p_body: `AI가 반영했어요. ${summary}\n· ${changed}${adminLink}`.slice(0, 2000),
        p_awaiting_user: false,
        p_tokens: tokens,
        p_monthly_ai_tokens: plan.monthlyAiTokens,
      });
      if (error) console.error("[ai] finish", error.message);
      await finishRun(admin, runId, {
        status: "applied",
        output: out,
        applied: { changes, rejected: allRejected },
        design_version_after: to.version,
        tokens_billed: res.billed,
        ...callFields(res),
      });
      return { ok: true, message: "AI 가 반영했습니다.", outcome: "applied", summary: [summary, ...changes.map(describeChange)].filter(Boolean).join(" / ").slice(0, 400) };
    }
    await handOff(`AI 가 고친 내용을 저장하지 못했어요. ${HUMAN_LATER}`, { status: "error", error: "디자인 저장 실패", output: out, ...callFields(res) });
    return { ok: false, message: "디자인을 저장하지 못했습니다.", outcome: "error" };
  } catch (e) {
    console.error("[ai] edit", e);
    await liveWrites.catch(() => undefined);
    await handOff(`AI 처리 중 문제가 생겼어요. ${HUMAN_LATER}`, { status: "error", error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
    return { ok: false, message: "AI 처리 중 오류가 났습니다.", outcome: "error" };
  }
}

/** 사용자가 AI 질문에 답했을 때 다시 처리할지 (편집기 · 요청 내역의 답글 뒤에 부른다) */
export async function resumeAfterAnswer(requestId: string): Promise<void> {
  if (!aiConfigured()) return;
  try {
    const admin = createAdminClient();
    if (!(await schemaReady(admin))) return;
    const { data } = await admin.from("ai_runs").select("status").eq("request_id", requestId).order("created_at", { ascending: false }).limit(1);
    if ((data as { status: string }[] | null)?.[0]?.status !== "asked") return;
    await processAiRequest(requestId);
  } catch (e) {
    console.error("[ai] resume", e);
  }
}

/** 사이트에 붙은 디자인 유형 이름 (안내 문구) */
export function siteStyleNames(brief: ProjectBrief): string[] {
  return styleLabels(normalizeStyles(brief.styleTags?.length ? brief.styleTags : brief.tone));
}
