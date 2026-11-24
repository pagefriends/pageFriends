/**
 * AI 수정 요청 중 페이지 더하기 · 빼기와 사진 · 로고 만들기 (2026-11-24).
 * AI 출력은 layoutChanges 한 목록이고 target=page · image 줄을 여기서 나눠 검사한다 (구조화 출력 문법이 커지지 않게 같은 칸을 쓴다).
 *
 *   page  add:    title=메뉴 이름 · type=페이지 종류 · body=넣을 내용 · page=바라는 주소 · id=상위 메뉴(묶음) 이름 · after=앞 페이지 주소
 *         remove: page=지울 페이지 주소 (페이지 행과 요청 기록은 남고 계획 · 메뉴에서만 빠진다)
 *   image make:   id=이미지 자리 id (로고는 logo) · body=어떤 그림인지 · page=자리가 있는 페이지
 */

import type { AppliedChange } from "@/lib/design-doc";
import type { LayoutChangeLine } from "@/lib/page-layout";
import { PAGE_KIND_LABEL, addPlannedPage, removePlannedPage, withLogoSlot, type BusinessInfo, type ImageSlot, type PlannedPage, type SitePlan } from "@/lib/site-plan";

export type ExtraSplit = { pages: LayoutChangeLine[]; images: LayoutChangeLine[]; rest: LayoutChangeLine[] };

export function splitExtra(list: LayoutChangeLine[]): ExtraSplit {
  return {
    pages: list.filter((c) => c.target === "page"),
    images: list.filter((c) => c.target === "image"),
    rest: list.filter((c) => c.target !== "page" && c.target !== "image"),
  };
}

export type PageResult = {
  site: SitePlan;
  applied: AppliedChange[];
  rejected: string[];
  /** AI 가 적은 주소 → 실제로 정한 주소 (같은 출력의 문구 · 구역 줄을 새 페이지로 옮긴다) */
  pathMap: Map<string, string>;
  added: PlannedPage[];
  removed: PlannedPage[];
};

export function applyPageChanges(site: SitePlan, lines: LayoutChangeLine[], info: { business: BusinessInfo; siteName: string }, maxPages: number): PageResult {
  let cur = site;
  const out: PageResult = { site, applied: [], rejected: [], pathMap: new Map(), added: [], removed: [] };
  for (const c of lines) {
    if (c.op === "add") {
      if (cur.pages.length >= maxPages) {
        out.rejected.push(`지금 플랜은 페이지 ${maxPages}개까지라 "${c.title}" 페이지를 더 만들 수 없어요.`);
        continue;
      }
      const r = addPlannedPage(cur, { label: c.title, kind: c.type, note: c.body, path: c.page, group: c.id, after: c.after }, info);
      if ("error" in r) {
        out.rejected.push(r.error);
        continue;
      }
      cur = r.site;
      out.added.push(r.page);
      if (c.page.trim()) out.pathMap.set(c.page.trim(), r.page.path);
      out.applied.push({
        kind: "page",
        key: "add",
        path: r.page.path,
        before: "",
        after: `새 페이지: ${r.page.group ? `${r.page.group} › ` : ""}${r.page.label} (${PAGE_KIND_LABEL[r.page.kind]})`,
      });
    } else if (c.op === "remove") {
      const r = removePlannedPage(cur, c.page.trim());
      if ("error" in r) {
        out.rejected.push(r.error);
        continue;
      }
      cur = r.site;
      out.removed.push(r.page);
      out.applied.push({ kind: "page", key: "remove", path: r.page.path, before: r.page.label, after: `페이지 지움: ${r.page.group ? `${r.page.group} › ` : ""}${r.page.label} (메뉴에서 빠져요)` });
    } else out.rejected.push(`페이지 작업 "${c.op}" 은(는) 할 수 없어요.`);
  }
  out.site = cur;
  return out;
}

export type ImageJob = { slot: ImageSlot; request: string; logo: boolean; page: string };

/** 만들 그림 목록. 실제 사진이어야 하는 자리는 만들지 않는다 */
export function planImages(site: SitePlan, lines: LayoutChangeLine[], defaultPage: string): { site: SitePlan; jobs: ImageJob[]; rejected: string[] } {
  let cur = site;
  const jobs: ImageJob[] = [];
  const rejected: string[] = [];
  for (const c of lines.slice(0, 3)) {
    const id = c.id.trim();
    const logo = id === "logo";
    if (logo) cur = withLogoSlot(cur);
    const page = c.page.trim() || defaultPage;
    const slot = cur.images.find((s) => s.id === id) ?? (id ? undefined : cur.images.find((s) => s.pages.includes(page) && s.source === "ai"));
    if (!slot) {
      rejected.push(`그림을 넣을 영역(${id || "?"})을 찾지 못했어요.`);
      continue;
    }
    if (slot.source === "real") {
      rejected.push(`"${slot.label}" 은(는) 실제 사진이 들어가야 하는 영역이라 AI가 그리지 않아요. 오른쪽 '이미지 영역'에서 사진을 올려 주세요.`);
      continue;
    }
    if (jobs.some((j) => j.slot.id === slot.id)) continue;
    jobs.push({ slot, request: c.body.trim().slice(0, 600), logo, page });
  }
  if (lines.length > 3) rejected.push("그림은 한 번에 3장까지 만들어요.");
  return { site: cur, jobs, rejected };
}

/** 같은 출력의 다른 줄이 AI 가 적은 새 페이지 주소를 쓰면 실제 주소로 바꾼다 */
export function remapPath(path: string, map: Map<string, string>): string {
  return map.get(path.trim()) ?? path;
}
