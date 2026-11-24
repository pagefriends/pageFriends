import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DeviceKind } from "@/config/plans";
import { plannedOf, renderPage } from "@/lib/ai/layout";
import { designOf } from "@/lib/design-doc";
import type { ProjectBrief } from "@/lib/types/db";

/**
 * "사이트에 올리기" 전에 AI 가 하는 점검 (2026-11-24). 사람이 보지 않고 코드가 직접 확인한다.
 *   verify    모든 페이지 · 화면을 지금 디자인으로 다시 그려 깨지는 곳이 없는지
 *   security  사이트에 보일 글 · 목록 글 · 링크에서 스크립트 · 위험한 주소 · 개인정보를 찾는다
 *             심각(critical)이 하나라도 있으면 올리지 않는다. 주의(warning)는 알려 주고 올린다.
 */

export type CheckIssue = { level: "critical" | "warning"; where: string; text: string };
export type CheckResult = { ok: boolean; checked: number; issues: CheckIssue[]; summary: string };

type Project = { id: string; brief: ProjectBrief };
type PageRow = { path: string; name: string; screenshots: Partial<Record<DeviceKind, unknown>> };

/** 모든 페이지 · 화면을 다시 그려 본다 */
export function verifySite(project: Project, pages: PageRow[]): CheckResult {
  const brief = project.brief;
  if (!brief.site || !brief.business) return { ok: true, checked: 0, issues: [], summary: "그려서 확인할 디자인 시안이 없는 사이트예요 (담당자가 확인해요)." };
  const design = designOf(brief);
  const issues: CheckIssue[] = [];
  let checked = 0;
  for (const p of pages) {
    const planned = plannedOf(brief, p.path);
    if (!planned) continue;
    for (const device of Object.keys(p.screenshots ?? {}) as DeviceKind[]) {
      checked++;
      try {
        const res = renderPage(brief, design, planned, device);
        if (!res || res.height < 200) issues.push({ level: "critical", where: `${p.name} · ${device}`, text: "화면을 그리지 못했어요" });
      } catch {
        issues.push({ level: "critical", where: `${p.name} · ${device}`, text: "화면을 그리다 오류가 났어요" });
      }
    }
  }
  const bad = issues.length;
  return { ok: bad === 0, checked, issues, summary: bad ? `화면 ${checked}개 중 ${bad}개에 문제가 있어요.` : `페이지 ${pages.length}개 · 화면 ${checked}개를 모두 확인했어요.` };
}

const SCRIPT = /<\s*(script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|\bon[a-z]+\s*=\s*["']?/i;
const RRN = /\b\d{6}\s*-\s*[1-4]\d{6}\b/; // 주민등록번호
const CARD = /\b(?:\d{4}[- ]){3}\d{4}\b/; // 카드번호 모양
const URL_RE = /\bhttps?:\/\/[^\s"'<>)]+/gi;
const SHORTENERS = /^(bit\.ly|tinyurl\.com|goo\.gl|t\.co|me2\.do|han\.gl|vo\.la|url\.kr|is\.gd|ow\.ly)$/i;

function scanText(where: string, text: string, issues: CheckIssue[]) {
  if (!text) return;
  if (SCRIPT.test(text)) issues.push({ level: "critical", where, text: "스크립트처럼 실행될 수 있는 글이 있어요" });
  if (RRN.test(text)) issues.push({ level: "critical", where, text: "주민등록번호로 보이는 숫자가 있어요" });
  if (CARD.test(text)) issues.push({ level: "critical", where, text: "카드번호로 보이는 숫자가 있어요" });
  for (const m of text.match(URL_RE) ?? []) {
    let u: URL;
    try {
      u = new URL(m);
    } catch {
      continue;
    }
    if (u.protocol === "http:") issues.push({ level: "warning", where, text: `보안 연결(https)이 아닌 링크예요: ${u.host}` });
    if (SHORTENERS.test(u.hostname)) issues.push({ level: "warning", where, text: `어디로 가는지 알 수 없는 짧은 주소예요: ${u.host}` });
    if (u.username || u.password) issues.push({ level: "critical", where, text: "링크에 아이디 · 비밀번호가 들어 있어요" });
  }
}

/** 사이트에 보일 글 · 목록 글 · 연락처 링크를 검사한다. db = 읽는 사람의 클라이언트 (RLS) */
export async function securityScan(db: SupabaseClient, project: Project): Promise<CheckResult> {
  const brief = project.brief;
  const design = designOf(brief);
  const issues: CheckIssue[] = [];
  let checked = 0;
  const scan = (where: string, v: unknown) => {
    if (typeof v !== "string") return;
    checked++;
    scanText(where, v, issues);
  };

  for (const [k, v] of Object.entries(design.copy.site)) scan(`공통 문구 ${k}`, v);
  for (const [path, map] of Object.entries(design.copy.pages)) for (const [k, v] of Object.entries(map)) scan(`${path} 문구 ${k}`, v);
  const b = brief.business;
  if (b) {
    scan("회사 소개", b.tagline);
    for (const [k, v] of Object.entries(b.contact ?? {})) scan(`연락처 ${k}`, v);
    for (const o of b.offerings ?? []) {
      scan(`서비스 ${o.name}`, o.name);
      scan(`서비스 ${o.name}`, o.description);
    }
  }
  const lists = design.collections ?? [];
  if (lists.length) {
    const { data, error } = await db.from("site_records").select("collection, data, published").eq("project_id", project.id).eq("published", true).limit(5000);
    if (!error) {
      for (const r of (data as { collection: string; data: Record<string, unknown> }[] | null) ?? []) {
        const label = lists.find((c) => c.key === r.collection)?.label ?? r.collection;
        for (const [k, v] of Object.entries(r.data ?? {})) scan(`${label} 글 ${k}`, v);
      }
    }
  }

  const critical = issues.filter((i) => i.level === "critical").length;
  const warning = issues.length - critical;
  return {
    ok: critical === 0,
    checked,
    issues: issues.slice(0, 30),
    summary: critical
      ? `위험한 내용 ${critical}건을 찾았어요. 고친 뒤 다시 올려 주세요.`
      : warning
        ? `글 ${checked}개를 검사했어요. 주의할 점 ${warning}건이 있지만 올릴 수 있어요.`
        : `글 ${checked}개를 검사했고 문제가 없어요.`,
  };
}
