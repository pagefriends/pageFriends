/**
 * 페이지 구역 · 메뉴 · 폼 (디자인 문서 layout · menu · forms). 2026-11-24 — 구역 추가 · 삭제 · 순서, 메뉴 이름 · 순서 · 숨기기,
 * 문의 · 예약 폼 항목을 AI 가 바로 바꾸게 한다. AI 는 정해진 형식으로만 보내고 여기서 다시 검사한다 (lib/ai/engine.ts).
 *
 * 구역
 *   기본 구역: 페이지 종류마다 원래 그리는 것. 홈은 hero · offerings · strengths · about · reviews · cta 로 나뉘고,
 *              다른 페이지는 main(본문) · cta(아래 행동 유도 띠 — 있는 종류만)이다.
 *   새 구역(block): AI 가 더하는 것 — 글 · 지도 · 영상 · SNS · 자주 묻는 질문 · 폼 · 버튼. id 는 "b" + 숫자.
 *   layout[path].order 에 기본 구역 id 와 새 구역 id 를 보일 순서대로 둔다. order 에 없는 기본 구역은 숨긴 것이다.
 * 메뉴: menu.labels 이름 바꾸기 · menu.order 위쪽 메뉴 순서(페이지 주소) · menu.hidden 메뉴에서 숨기기 (페이지는 그대로).
 * 폼: forms[path] 가 있으면 문의 · 예약 페이지의 기본 폼 항목 대신 이것을 그린다.
 * 이 파일은 브라우저 · 서버 어디서나 쓰는 순수 함수만 둔다.
 */

import type { PageKind, PlannedPage } from "@/lib/site-plan";

export const BLOCK_TYPES = ["text", "map", "video", "sns", "faq", "form", "button"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export const BLOCK_LABEL: Record<BlockType, string> = { text: "글", map: "지도", video: "영상", sns: "SNS 링크", faq: "자주 묻는 질문", form: "폼", button: "버튼" };

export const FORM_FIELD_TYPES = ["text", "phone", "email", "date", "time", "number", "longtext", "select", "checkbox"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
export type FormField = { label: string; type: FormFieldType; required: boolean };

export type Block = {
  id: string;
  type: BlockType;
  title: string;
  body: string;
  /** 지도: 주소 · 버튼: 이동할 주소 · 영상: 유튜브 주소 */
  url: string;
  address: string;
  links: { label: string; url: string }[];
  items: { q: string; a: string }[];
  fields: FormField[];
  button: string;
};

export type PageLayout = { order: string[]; blocks: Block[] };
export type MenuOverride = { labels: Record<string, string>; order: string[]; hidden: string[] };

export const LAYOUT_LIMITS = { blocks: 8, title: 40, body: 600, items: 8, links: 6, fields: 12, label: 20, url: 300 } as const;

/** 아래 행동 유도 띠가 있는 페이지 종류 (lib/draft-render.ts PAGE 가 ctaBand 로 끝나는 것) */
const HAS_CTA = new Set<PageKind>(["home", "about", "services", "service", "products", "pricing", "cases"]);
const HOME = ["hero", "offerings", "strengths", "about", "reviews", "cta"] as const;

export const BUILTIN_LABEL: Record<string, string> = {
  hero: "첫 화면",
  offerings: "서비스 소개",
  strengths: "강점",
  about: "회사 소개",
  reviews: "고객 후기",
  cta: "아래 행동 유도 띠",
  main: "본문",
};

/** 페이지 종류의 기본 구역 (위에서 아래 순서) */
export function builtinSections(kind: PageKind): string[] {
  if (kind === "home") return [...HOME];
  return HAS_CTA.has(kind) ? ["main", "cta"] : ["main"];
}

/** 지금 보이는 구역 순서 (layout 이 없으면 기본) */
export function sectionOrder(kind: PageKind, layout: PageLayout | undefined): string[] {
  const builtins = builtinSections(kind);
  if (!layout) return builtins;
  const blockIds = new Set(layout.blocks.map((b) => b.id));
  return layout.order.filter((id) => builtins.includes(id) || blockIds.has(id));
}

const clean = (s: unknown, max: number): string =>
  typeof s === "string"
    ? [...s.replace(/[<>]/g, "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim()].slice(0, max).join("")
    : "";

/** http(s) 주소만 (그 밖은 빈 글자) */
export function safeUrl(s: unknown): string {
  const v = clean(s, LAYOUT_LIMITS.url);
  if (!v) return "";
  try {
    const u = new URL(v);
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password ? u.toString() : "";
  } catch {
    return "";
  }
}

/** 유튜브 주소에서 영상 id (그림에는 자리만 그리지만 주소가 맞는지 검사한다) */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get("v") ?? (u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null);
  } catch {
    return null;
  }
  return null;
}

function cleanFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const out: FormField[] = [];
  for (const f of raw) {
    if (out.length >= LAYOUT_LIMITS.fields) break;
    const o = (f ?? {}) as Record<string, unknown>;
    const label = clean(o.label, LAYOUT_LIMITS.label);
    if (!label) continue;
    const type = (FORM_FIELD_TYPES as readonly unknown[]).includes(o.type) ? (o.type as FormFieldType) : "text";
    out.push({ label, type, required: o.required === true });
  }
  return out;
}

export function sanitizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !/^b\d{1,4}$/.test(o.id)) return null;
  if (!(BLOCK_TYPES as readonly unknown[]).includes(o.type)) return null;
  return {
    id: o.id,
    type: o.type as BlockType,
    title: clean(o.title, LAYOUT_LIMITS.title),
    body: clean(o.body, LAYOUT_LIMITS.body),
    url: safeUrl(o.url),
    address: clean(o.address, 120),
    links: (Array.isArray(o.links) ? o.links : [])
      .map((l) => ({ label: clean((l as Record<string, unknown>)?.label, LAYOUT_LIMITS.label), url: safeUrl((l as Record<string, unknown>)?.url) }))
      .filter((l) => l.label && l.url)
      .slice(0, LAYOUT_LIMITS.links),
    items: (Array.isArray(o.items) ? o.items : [])
      .map((i) => ({ q: clean((i as Record<string, unknown>)?.q, 120), a: clean((i as Record<string, unknown>)?.a, 400) }))
      .filter((i) => i.q)
      .slice(0, LAYOUT_LIMITS.items),
    fields: cleanFields(o.fields),
    button: clean(o.button, LAYOUT_LIMITS.label),
  };
}

/** 저장된 layout 을 안전하게 읽는다 (경로마다 구역 id 는 한 번씩) */
export function sanitizeLayout(raw: unknown): Record<string, PageLayout> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, PageLayout> = {};
  for (const [path, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!path.startsWith("/") || !v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const blocks = (Array.isArray(o.blocks) ? o.blocks : []).map(sanitizeBlock).filter((b): b is Block => b !== null).slice(0, LAYOUT_LIMITS.blocks);
    const ids = new Set(blocks.map((b) => b.id));
    const order = [...new Set((Array.isArray(o.order) ? o.order : []).filter((id): id is string => typeof id === "string" && (ids.has(id) || id in BUILTIN_LABEL)))];
    out[path] = { order, blocks: blocks.filter((b) => order.includes(b.id)) };
  }
  return Object.keys(out).length ? out : undefined;
}

export function sanitizeMenu(raw: unknown): MenuOverride | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const labels: Record<string, string> = {};
  for (const [k, v] of Object.entries((o.labels as Record<string, unknown>) ?? {})) {
    const l = clean(v, LAYOUT_LIMITS.label);
    if (k.startsWith("/") && l) labels[k] = l;
  }
  const paths = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).filter((p): p is string => typeof p === "string" && p.startsWith("/")))].slice(0, 60);
  const m = { labels, order: paths(o.order), hidden: paths(o.hidden) };
  return Object.keys(m.labels).length || m.order.length || m.hidden.length ? m : undefined;
}

export function sanitizeForms(raw: unknown): Record<string, FormField[]> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, FormField[]> = {};
  for (const [path, v] of Object.entries(raw as Record<string, unknown>)) {
    const f = cleanFields(v);
    if (path.startsWith("/") && f.length) out[path] = f;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 메뉴 바꾸기를 반영한 페이지 목록 (이름 · 위쪽 메뉴 순서 · 숨김). 그림의 머리 메뉴가 쓴다 */
export function menuPages(pages: PlannedPage[], menu: MenuOverride | undefined): PlannedPage[] {
  if (!menu) return pages;
  const renamed = pages.map((p) => ({ ...p, label: menu.labels[p.path] ?? p.label }));
  // 그룹 이름 바꾸기: 그룹의 첫 페이지 주소에 붙은 이름을 그룹 이름으로 본다 ("group:/주소")
  const visible = renamed.filter((p) => !menu.hidden.includes(p.path)).map((p) => ({ ...p, group: p.group ? (menu.labels[`group:${groupKey(pages, p.group)}`] ?? p.group) : null }));
  if (!menu.order.length) return visible;
  // 위쪽 메뉴 단위(단독 페이지 또는 같은 그룹 묶음)로 순서를 바꾼다
  const units: PlannedPage[][] = [];
  for (const p of visible) {
    const last = units[units.length - 1];
    if (p.group && last && last[0].group === p.group) last.push(p);
    else units.push([p]);
  }
  const rank = (u: PlannedPage[]) => {
    const i = u.map((p) => menu.order.indexOf(p.path)).find((n) => n >= 0);
    return i === undefined ? 1000 : i;
  };
  return units
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (a.u[0].kind === "home" ? -1 : b.u[0].kind === "home" ? 1 : rank(a.u) - rank(b.u) || a.i - b.i))
    .flatMap((x) => x.u);
}

/** 그룹의 첫 페이지 주소 (그룹 이름을 바꿀 때 열쇠로 쓴다) */
export function groupKey(pages: PlannedPage[], group: string): string {
  return pages.find((p) => p.group === group)?.path ?? group;
}

export function describeBlock(b: Block): string {
  const t = b.title ? ` "${b.title}"` : "";
  return `${BLOCK_LABEL[b.type]} 구역${t}`;
}

export function sectionName(id: string, layout: PageLayout | undefined): string {
  if (id in BUILTIN_LABEL) return BUILTIN_LABEL[id];
  const b = layout?.blocks.find((x) => x.id === id);
  return b ? describeBlock(b) : id;
}

// ---------------------------------------------------------------------------------------------
// AI 가 보낸 바꿀 값 검사 · 반영
// ---------------------------------------------------------------------------------------------

export type SectionChangeInput = {
  op: string;
  page: string;
  id: string;
  type: string;
  after: string;
  title: string;
  body: string;
  url: string;
  address: string;
  links: { label: string; url: string }[];
  items: { q: string; a: string }[];
  fields: { label: string; type: string; required: boolean }[];
  button: string;
};
export type MenuChangeInput = { op: string; path: string; label: string; after: string };
export type FormChangeInput = { page: string; fields: { label: string; type: string; required: boolean }[] };

/** AI 가 보낸 한 줄짜리 바꾸기 (lib/ai/schemas.ts layoutChanges) → 구역 · 메뉴 · 폼 바꾸기 */
export type LayoutChangeLine = { target: string; op: string; page: string; id: string; type: string; after: string; title: string; body: string; url: string; address: string; lines: string[]; button: string };

export function splitLayoutChanges(list: LayoutChangeLine[], defaultPage: string): { sections: SectionChangeInput[]; menu: MenuChangeInput[]; forms: FormChangeInput[] } {
  const parts = (l: string) => l.split("|").map((x) => x.trim());
  const fieldsOf = (lines: string[]) =>
    lines.map(parts).filter((p) => p[0]).map(([label, type, req]) => ({ label, type: type || "text", required: /^(예|필수|y|yes|true)$/i.test(req ?? "") }));
  const sections: SectionChangeInput[] = [];
  const menu: MenuChangeInput[] = [];
  const forms: FormChangeInput[] = [];
  for (const c of list) {
    const page = c.page || defaultPage;
    if (c.target === "menu") menu.push({ op: c.op, path: page, label: c.title, after: c.after });
    else if (c.target === "form") forms.push({ page, fields: fieldsOf(c.lines) });
    else
      sections.push({
        op: c.op,
        page,
        id: c.id,
        type: c.type,
        after: c.after,
        title: c.title,
        body: c.body,
        url: c.url,
        address: c.address,
        links: c.type === "sns" ? c.lines.map(parts).map(([label, url]) => ({ label, url: url ?? "" })) : [],
        items: c.type === "faq" || (c.op === "edit" && c.lines.some((l) => l.includes("|"))) ? c.lines.map(parts).map(([q, a]) => ({ q, a: a ?? "" })) : [],
        fields: c.type === "form" ? fieldsOf(c.lines) : [],
        button: c.button,
      });
  }
  return { sections, menu, forms };
}

export type LayoutState = { layout?: Record<string, PageLayout>; menu?: MenuOverride; forms?: Record<string, FormField[]> };
export type LayoutApplied = { kind: "section" | "menu" | "form"; key: string; path?: string; before: string; after: string };

function nextBlockId(all: Record<string, PageLayout>): string {
  let n = 0;
  for (const l of Object.values(all)) for (const b of l.blocks) n = Math.max(n, Number(b.id.slice(1)) || 0);
  return `b${n + 1}`;
}

/**
 * 구역 · 메뉴 · 폼 바꾸기를 검사해 새 값을 만든다. 없는 페이지 · 구역, 잘못된 종류 · 주소는 버리고(rejected), 실제로 바뀐 것만 applied 에.
 * pages = 사이트의 페이지 (brief.site.pages)
 */
export function applyLayoutChanges(
  state: LayoutState,
  input: { sections: SectionChangeInput[]; menu: MenuChangeInput[]; forms: FormChangeInput[] },
  pages: PlannedPage[],
): { state: LayoutState; applied: LayoutApplied[]; rejected: string[] } {
  const layout: Record<string, PageLayout> = Object.fromEntries(Object.entries(state.layout ?? {}).map(([k, v]) => [k, { order: [...v.order], blocks: v.blocks.map((b) => ({ ...b })) }]));
  const menu: MenuOverride = { labels: { ...(state.menu?.labels ?? {}) }, order: [...(state.menu?.order ?? [])], hidden: [...(state.menu?.hidden ?? [])] };
  const forms: Record<string, FormField[]> = { ...(state.forms ?? {}) };
  const applied: LayoutApplied[] = [];
  const rejected: string[] = [];
  const pageOf = (path: string) => pages.find((p) => p.path === path);

  for (const ch of input.sections) {
    const page = pageOf(ch.page);
    if (!page) {
      rejected.push(`구역: 없는 페이지 ${ch.page}`);
      continue;
    }
    const cur = layout[page.path] ?? { order: builtinSections(page.kind), blocks: [] };
    const order = sectionOrder(page.kind, cur);
    const beforeText = order.map((id) => sectionName(id, cur)).join(" → ");
    const at = (after: string) => (after === "" || after === "top" ? 0 : order.indexOf(after) >= 0 ? order.indexOf(after) + 1 : -1);

    if (ch.op === "add") {
      if (!(BLOCK_TYPES as readonly string[]).includes(ch.type)) {
        rejected.push(`구역 종류 ${ch.type}`);
        continue;
      }
      if (cur.blocks.length >= LAYOUT_LIMITS.blocks) {
        rejected.push(`${page.path}: 새 구역은 ${LAYOUT_LIMITS.blocks}개까지`);
        continue;
      }
      const block = sanitizeBlock({ ...ch, id: nextBlockId(layout), type: ch.type });
      if (!block) continue;
      if (block.type === "video" && !youtubeId(block.url)) {
        rejected.push("영상: 유튜브 주소가 아님 (주소를 받아야 넣을 수 있음)");
        continue;
      }
      if (block.type === "map" && !block.address) {
        rejected.push("지도: 주소가 없음");
        continue;
      }
      // after: 이 구역 다음 · "top" 맨 위 · 빈 글자나 못 찾으면 아래 띠 앞(없으면 맨 끝)
      let pos = ch.after === "" ? -1 : at(ch.after);
      if (pos < 0) pos = order.includes("cta") ? order.indexOf("cta") : order.length;
      const nextOrder = [...order.slice(0, pos), block.id, ...order.slice(pos)];
      layout[page.path] = { order: nextOrder, blocks: [...cur.blocks, block] };
      applied.push({ kind: "section", key: block.id, path: page.path, before: beforeText, after: `${describeBlock(block)} 추가` });
      continue;
    }

    if (!order.includes(ch.id) && !(ch.op === "show" && ch.id in BUILTIN_LABEL && builtinSections(page.kind).includes(ch.id))) {
      rejected.push(`${page.path}: 없는 구역 ${ch.id}`);
      continue;
    }
    if (ch.op === "remove") {
      const nextOrder = order.filter((id) => id !== ch.id);
      layout[page.path] = { order: nextOrder, blocks: cur.blocks.filter((b) => b.id !== ch.id) };
      applied.push({ kind: "section", key: ch.id, path: page.path, before: beforeText, after: `${sectionName(ch.id, cur)} 숨김` });
    } else if (ch.op === "show") {
      const rest = order.filter((id) => id !== ch.id);
      let pos = at(ch.after);
      if (pos < 0) pos = builtinSections(page.kind).indexOf(ch.id);
      layout[page.path] = { order: [...rest.slice(0, pos), ch.id, ...rest.slice(pos)], blocks: cur.blocks };
      applied.push({ kind: "section", key: ch.id, path: page.path, before: beforeText, after: `${sectionName(ch.id, cur)} 다시 보이기` });
    } else if (ch.op === "move") {
      const rest = order.filter((id) => id !== ch.id);
      const pos = ch.after === "" || ch.after === "top" ? 0 : rest.indexOf(ch.after) + 1;
      if (ch.after && ch.after !== "top" && pos === 0) {
        rejected.push(`${page.path}: 옮길 기준 구역 ${ch.after} 없음`);
        continue;
      }
      const nextOrder = [...rest.slice(0, pos), ch.id, ...rest.slice(pos)];
      if (nextOrder.join() === order.join()) continue;
      layout[page.path] = { order: nextOrder, blocks: cur.blocks };
      applied.push({ kind: "section", key: ch.id, path: page.path, before: beforeText, after: nextOrder.map((id) => sectionName(id, cur)).join(" → ") });
    } else if (ch.op === "edit") {
      const b = cur.blocks.find((x) => x.id === ch.id);
      if (!b) {
        rejected.push(`${ch.id}: 기본 구역의 글은 문구 자리로 바꾼다`);
        continue;
      }
      const next = sanitizeBlock({ ...b, ...Object.fromEntries(Object.entries(ch).filter(([k, v]) => k !== "id" && k !== "type" && (Array.isArray(v) ? v.length : v !== ""))) });
      if (!next || JSON.stringify(next) === JSON.stringify(b)) continue;
      layout[page.path] = { order, blocks: cur.blocks.map((x) => (x.id === b.id ? next : x)) };
      applied.push({ kind: "section", key: b.id, path: page.path, before: describeBlock(b), after: `${describeBlock(next)} 내용 바꿈` });
    } else rejected.push(`구역 작업 ${ch.op}`);
  }

  for (const ch of input.menu) {
    const page = pageOf(ch.path);
    if (!page || page.kind === "home") {
      rejected.push(`메뉴: 바꿀 수 없는 페이지 ${ch.path}`);
      continue;
    }
    if (ch.op === "rename") {
      const label = clean(ch.label, LAYOUT_LIMITS.label);
      if (!label) continue;
      const before = menu.labels[page.path] ?? page.label;
      if (before === label) continue;
      menu.labels[page.path] = label;
      applied.push({ kind: "menu", key: page.path, before: `메뉴 ${before}`, after: `메뉴 ${label}` });
    } else if (ch.op === "rename_group") {
      const label = clean(ch.label, LAYOUT_LIMITS.label);
      if (!label || !page.group) continue;
      menu.labels[`group:${groupKey(pages, page.group)}`] = label;
      applied.push({ kind: "menu", key: page.group, before: `메뉴 묶음 ${page.group}`, after: `메뉴 묶음 ${label}` });
    } else if (ch.op === "hide" || ch.op === "show") {
      const hidden = new Set(menu.hidden);
      if (ch.op === "hide") hidden.add(page.path);
      else hidden.delete(page.path);
      if (hidden.size === menu.hidden.length && hidden.has(page.path) === menu.hidden.includes(page.path)) continue;
      menu.hidden = [...hidden];
      applied.push({ kind: "menu", key: page.path, before: `메뉴 ${page.label}`, after: ch.op === "hide" ? "메뉴에서 숨김 (페이지는 그대로)" : "메뉴에 다시 보이기" });
    } else if (ch.op === "move") {
      // 위쪽 메뉴 단위(단독 페이지 또는 같은 묶음)의 첫 페이지 주소로 순서를 정한다
      const view = menuPages(pages, menu).filter((p) => p.kind !== "home");
      const headOf = (path: string): string | null => {
        const p = view.find((q) => q.path === path);
        if (!p) return null;
        return p.group ? (view.find((q) => q.group === p.group)?.path ?? p.path) : p.path;
      };
      const heads = [...new Set(view.map((p) => headOf(p.path) as string))];
      const me = headOf(page.path);
      if (!me) {
        rejected.push(`메뉴: 숨긴 메뉴는 옮길 수 없음 ${page.path}`);
        continue;
      }
      const rest = heads.filter((h) => h !== me);
      let pos = 0;
      if (ch.after && ch.after !== "top") {
        const ah = headOf(ch.after);
        if (!ah || ah === me) {
          rejected.push(`메뉴: 기준 메뉴 ${ch.after} 없음`);
          continue;
        }
        pos = rest.indexOf(ah) + 1;
      }
      const next = [...rest.slice(0, pos), me, ...rest.slice(pos)];
      if (next.join() === heads.join()) continue;
      const name = (h: string) => view.find((q) => q.path === h)?.group ?? view.find((q) => q.path === h)?.label ?? h;
      menu.order = next;
      applied.push({ kind: "menu", key: page.path, before: `메뉴 순서 ${heads.map(name).join(" · ")}`, after: `메뉴 순서 ${next.map(name).join(" · ")}` });
    } else rejected.push(`메뉴 작업 ${ch.op}`);
  }

  for (const ch of input.forms) {
    const page = pageOf(ch.page);
    if (!page) {
      rejected.push(`폼: 없는 페이지 ${ch.page}`);
      continue;
    }
    const fields = cleanFields(ch.fields);
    if (!fields.length) continue;
    const before = forms[page.path];
    if (JSON.stringify(before) === JSON.stringify(fields)) continue;
    forms[page.path] = fields;
    applied.push({ kind: "form", key: page.path, path: page.path, before: before ? before.map((f) => f.label).join(" · ") : "기본 폼", after: fields.map((f) => `${f.label}${f.required ? "*" : ""}`).join(" · ") });
  }

  return {
    state: {
      layout: Object.keys(layout).length ? layout : undefined,
      menu: Object.keys(menu.labels).length || menu.order.length || menu.hidden.length ? menu : undefined,
      forms: Object.keys(forms).length ? forms : undefined,
    },
    applied,
    rejected,
  };
}
