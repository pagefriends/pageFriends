import type { DeviceKind } from "@/config/plans";
import { copyKeyProblem, fieldDef, type CopyLimits, type DesignDoc } from "@/lib/design-doc";
import { SECTION_LABEL, renderDraft, type DraftResult, type FieldRect, type SectionRect } from "@/lib/draft-render";
import { draftUrl } from "@/lib/projects";
import type { PlannedPage } from "@/lib/site-plan";
import type { ProjectBrief, ProjectPageRow, Region, Screenshot } from "@/lib/types/db";

/**
 * 디자인 문서로 그린 그림의 배치 — 엔진과 하네스가 쓴다.
 *  - 문구 자리 목록 (AI 가 바꿀 수 있는 키 · 지금 글)
 *  - 네모가 가리키는 구역 · 문구 자리
 *  - 디자인이 바뀌었을 때 새 캡처와 옮긴 네모 위치 (그림 높이가 바뀌면 0~1 로 저장한 네모가 엉뚱한 곳을 가리키므로)
 * 그림은 순수 함수(renderDraft)라 저장하지 않고 필요할 때 다시 그린다.
 */

export type LayoutPage = Pick<ProjectPageRow, "id" | "path" | "name" | "screenshots">;

/** brief 로 페이지 하나 그리기 (위저드 개편 뒤 사이트만 — brief.site · business 가 있어야 한다) */
export function renderPage(brief: ProjectBrief, design: DesignDoc, planned: PlannedPage, device: DeviceKind): DraftResult | null {
  if (!brief.site || !brief.business) return null;
  return renderDraft({
    siteName: brief.siteName,
    industry: brief.industry,
    primaryColor: brief.primaryColor,
    business: brief.business,
    plan: brief.site,
    page: planned,
    device,
    year: new Date().getFullYear(),
    design,
  });
}

export function plannedOf(brief: ProjectBrief, path: string): PlannedPage | undefined {
  return brief.site?.pages.find((p) => p.path === path);
}

/** 사실을 지어내지 않게 — 고객이 준 서비스 · 강점 수, 소개 글 여부 */
export function copyLimits(brief: ProjectBrief): CopyLimits {
  const b = brief.business;
  return {
    offerings: b?.offerings.filter((o) => o.name.trim()).length ?? 0,
    strengths: b?.strengths.map((s) => s.trim()).filter(Boolean).length ?? 0,
    hasAbout: Boolean(b?.about.trim()),
  };
}

export type CopySlot = { key: string; label: string; max: number; scope: "site" | "page"; path: string; text: string };

/**
 * AI 가 쓸 수 있는 문구 자리 (사이트 공통은 한 번만). 데스크톱 그림에 실제로 그려진 자리만 — 없는 서비스 · 강점은 나오지 않는다.
 * 고객 소개 글이 없으면 about.body 는 빼고 (지어내지 않게), 사실 자리는 애초에 키가 없다.
 */
export function copySlots(brief: ProjectBrief, design: DesignDoc, paths?: readonly string[]): CopySlot[] {
  const limits = copyLimits(brief);
  const out: CopySlot[] = [];
  const seen = new Set<string>();
  for (const planned of brief.site?.pages ?? []) {
    if (paths && !paths.includes(planned.path)) continue;
    const res = renderPage(brief, design, planned, "desktop");
    for (const f of res?.fields ?? []) {
      const def = fieldDef(f.key);
      if (!def || copyKeyProblem(f.key, limits)) continue;
      const id = def.scope === "site" ? f.key : `${planned.path}|${f.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ key: f.key, label: def.label, max: def.max, scope: def.scope, path: def.scope === "site" ? "" : planned.path, text: f.text });
    }
  }
  return out;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export type RegionContext = {
  /** 네모 (그림 픽셀) */
  rect: { x: number; y: number; w: number; h: number };
  height: number;
  sections: SectionRect[];
  /** 네모와 겹치는 문구 자리 (많이 겹치는 순) */
  fields: FieldRect[];
  /** 겹치는 게 없을 때 가장 가까운 문구 자리 */
  nearby: FieldRect[];
};

/** 네모가 가리키는 구역 · 문구 자리. 요청을 보낸 그 디자인 버전의 그림 기준이어야 한다 (엔진은 반영 전에 부른다) */
export function regionContext(res: DraftResult, region: Region): RegionContext {
  const rect = { x: region.x * res.width, y: region.y * res.height, w: region.w * res.width, h: region.h * res.height };
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const sections = res.sections.filter((s) => overlap(rect.y, rect.y + rect.h, s.y, s.y + s.h) > 0);
  const scored = res.fields
    .map((f) => {
      const area = overlap(rect.x, rect.x + rect.w, f.x, f.x + f.w) * overlap(rect.y, rect.y + rect.h, f.y, f.y + f.h);
      const inside = cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
      return { f, score: area / Math.max(1, f.w * f.h) + (inside ? 1 : 0) };
    })
    .filter((x) => x.score >= 0.2)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);
  const nearby = scored.length
    ? []
    : res.fields
        .map((f) => ({ f, d: Math.hypot(f.x + f.w / 2 - cx, f.y + f.h / 2 - cy) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map((x) => x.f);
  return { rect, height: res.height, sections, fields: scored.slice(0, 6), nearby };
}

export function sectionLabel(id: string): string {
  return SECTION_LABEL[id] ?? id;
}

// ---------------------------------------------------------------------------------------------
// 디자인이 바뀌었을 때: 새 캡처 + 네모 옮기기
// ---------------------------------------------------------------------------------------------

const near = (a: number, b: number) => Math.abs(a - b) < 0.002;

/** 세로 위치 y 를 옛 구역 → 같은 구역(같은 id 의 같은 순번)의 같은 비율 자리로 옮긴다. 가로는 그대로 (화면 폭이 같다) */
function mapY(y: number, from: DraftResult, to: DraftResult): number {
  const idx = from.sections.findIndex((s) => y >= s.y && y <= s.y + s.h);
  if (idx >= 0) {
    const sec = from.sections[idx];
    const nth = from.sections.slice(0, idx).filter((s) => s.id === sec.id).length;
    const target = to.sections.filter((s) => s.id === sec.id)[nth];
    if (target) return target.y + ((y - sec.y) / Math.max(1, sec.h)) * target.h;
  }
  return (y / Math.max(1, from.height)) * to.height;
}

/**
 * 네모 하나를 옛 그림에서 새 그림으로 옮긴다.
 * 이미지 자리에 딱 맞춘 네모(위저드의 AI 이미지 요청 · "AI로 만들기")는 같은 자리의 새 위치로 정확히 옮긴다 — 편집기가 자리와 요청을 이어 보는 기준이다.
 */
export function remapRegion(region: Region, from: DraftResult, to: DraftResult): Region {
  const W = from.width;
  for (let i = 0; i < from.slots.length; i++) {
    const s = from.slots[i];
    if (near(region.x, s.x / W) && near(region.y, s.y / from.height) && near(region.w, s.w / W) && near(region.h, s.h / from.height)) {
      const nth = from.slots.slice(0, i).filter((x) => x.id === s.id).length;
      const t = to.slots.filter((x) => x.id === s.id)[nth];
      if (t) return { x: t.x / to.width, y: t.y / to.height, w: t.w / to.width, h: t.h / to.height };
    }
  }
  const top = mapY(region.y * from.height, from, to);
  const bottom = mapY((region.y + region.h) * from.height, from, to);
  const y = Math.min(1, Math.max(0, top / to.height));
  const h = Math.min(1 - y, Math.max(0.002, (bottom - top) / to.height));
  return { x: region.x, y, w: region.w, h };
}

export type Rerender = {
  pages: { id: string; screenshots: Partial<Record<DeviceKind, Screenshot>> }[];
  regions: { id: string; region: Region }[];
};

/**
 * 디자인을 바꿨을 때 모든 페이지 · 화면을 다시 그린다 → 새 캡처(주소의 v · 높이 · 이미지 자리) + 그 화면의 모든 네모 위치.
 * 저장은 ai_apply_design 이 한 트랜잭션으로 한다.
 */
export function rerender(
  brief: ProjectBrief,
  from: DesignDoc,
  to: DesignDoc,
  pages: LayoutPage[],
  requests: { id: string; page_id: string; device: DeviceKind; region: Region }[],
): Rerender {
  const out: Rerender = { pages: [], regions: [] };
  for (const page of pages) {
    const planned = plannedOf(brief, page.path);
    if (!planned) continue;
    const shots: Partial<Record<DeviceKind, Screenshot>> = { ...page.screenshots };
    let changed = false;
    for (const device of Object.keys(page.screenshots) as DeviceKind[]) {
      const old = page.screenshots[device];
      if (!old?.draft) continue;
      const a = renderPage(brief, from, planned, device);
      const b = renderPage(brief, to, planned, device);
      if (!a || !b) continue;
      shots[device] = { url: draftUrl(page.id, device, to.version), width: b.width, height: b.height, draft: true, slots: b.slots };
      changed = true;
      for (const r of requests) {
        if (r.page_id !== page.id || r.device !== device) continue;
        out.regions.push({ id: r.id, region: remapRegion(r.region, a, b) });
      }
    }
    if (changed) out.pages.push({ id: page.id, screenshots: shots });
  }
  return out;
}
