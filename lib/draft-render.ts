import type { DeviceKind } from "@/config/plans";
import { SITE_DB_DRAFT_ROWS } from "@/config/site-db";
import { formatCell, type Collection, type CollectionRow } from "@/lib/collections";
import { copyOf, paletteOf, rulesDesign, type DesignDoc, type Palette, type Theme } from "@/lib/design-doc";
import {
  RATIO_SHAPE,
  RATIO_SIZE,
  ctaLabel,
  headerMenu,
  industryOf,
  josa,
  type BusinessInfo,
  type HeaderMenu,
  type ImageSlot,
  type PageKind,
  type PlannedPage,
  type SitePlan,
} from "@/lib/site-plan";

/**
 * 구성 초안 그림 (SVG).
 *
 * 실제 웹사이트(2단계 HTML 렌더러)가 붙기 전까지 편집기에 보여 줄 "내 사이트" 다. 위저드에서 받은 회사 이름 · 한 줄 소개 ·
 * 서비스 · 헤더 메뉴(하위 페이지) · 연락처로 페이지마다 그린다.
 * 디자인 문서(lib/design-doc.ts)의 테마(색 · 글꼴 · 제목 굵기 · 모서리 · 여백 · 버튼 · 첫 화면 배치 · 카드 · 밝기)와
 * 문구(copy)를 따른다 — 디자인 유형 태그와 AI 수정이 그림에 바로 보인다.
 * 이미지 자리는 비어 있는 점선 상자로 그리고 안에 "어떤 이미지가 필요한지" 를 적는다. AI 로 만들기로 고른 자리는
 * 파란 점선과 "AI 이미지 생성 예정" 으로 구분한다.
 *
 * 함께 돌려주는 위치 (캡처 픽셀 기준):
 *   slots    이미지 자리 — 편집기 "이미지 자리" 목록 · 사진 겹쳐 보기
 *   fields   문구 자리(copy 키) — 네모가 어떤 글을 가리키는지 AI 가 찾는다
 *   sections 구역(첫 화면 · 서비스 카드 · 푸터 …)
 *
 * 관리자 목록(디자인 문서 collections)이 붙은 페이지는 그 목록을 그린다. 관리자 페이지에서 올린 글(rows)을 받으면 그 글을,
 * 없으면 빈 자리를 그린다 — 줄 수와 상관없이 높이가 같아서 글을 올려도 저장된 캡처 크기 · 네모 위치가 그대로다.
 *
 * 같은 입력이면 같은 그림이 나와야 한다 (프로젝트를 만들 때 크기·자리 위치를 저장하고, 그림은 요청 때마다 다시 그린다).
 * 그래서 Date 같은 바깥 값은 받지 않고 year 를 인자로 받는다.
 * 그림 안 글꼴은 보는 컴퓨터에 깔린 글꼴로 보인다 (<img> 로 띄운 SVG 는 웹 글꼴을 못 불러온다).
 */

export const DRAFT_WIDTH: Record<DeviceKind, number> = { mobile: 390, tablet: 820, desktop: 1440 };

/** 캡처 안의 이미지 자리 위치 (캡처 픽셀 기준). 한 자리가 여러 장이면 같은 id 가 여러 번 나온다 */
export type SlotRect = { id: string; x: number; y: number; w: number; h: number };
/** 문구 자리 위치. key 는 디자인 문서의 copy 키 (lib/design-doc.ts COPY_FIELDS) */
export type FieldRect = { key: string; x: number; y: number; w: number; h: number; text: string };
/** 구역 위치. id 는 SECTION_LABEL 의 키 */
export type SectionRect = { id: string; x: number; y: number; w: number; h: number };

export const SECTION_LABEL: Record<string, string> = {
  header: "헤더 (로고 · 메뉴 · 버튼)",
  hero: "첫 화면",
  offerings: "서비스 카드",
  strengths: "강점",
  about: "소개",
  reviews: "후기",
  cta: "아래 행동 유도 띠",
  title: "페이지 제목 띠",
  subnav: "하위 메뉴 탭",
  main: "본문",
  list: "관리자 목록",
  footer: "푸터",
};

export type DraftInput = {
  siteName: string;
  industry: string;
  primaryColor: string;
  business: BusinessInfo;
  plan: SitePlan;
  page: PlannedPage;
  device: DeviceKind;
  year: number;
  /** 디자인 문서. 없으면 메인 색만 쓴 기본 모습 (예전 초안과 같은 크기) */
  design?: DesignDoc;
  /** 관리자 목록에 올라온 공개 글 (목록 키 → 줄). 없으면 빈 자리로 그린다 (높이는 같다) */
  rows?: Record<string, CollectionRow[]>;
};

export type DraftResult = { width: number; height: number; svg: string; slots: SlotRect[]; fields: FieldRect[]; sections: SectionRect[] };

// <img> 로 띄운 SVG 는 보는 컴퓨터에 깔린 글꼴만 쓴다. 둥근 고딕 · 디스플레이 한글 글꼴은 기본으로 깔린 곳이 거의 없어
// 고딕으로 그리고(굵기 · 모서리로 느낌을 낸다), 명조는 윈도우(바탕) · 맥(AppleMyungjo)에 있는 글꼴로 그린다.
const SANS = "Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const FONT_STACK = {
  sans: SANS,
  serif: "'Noto Serif KR', 'Nanum Myeongjo', AppleMyungjo, Batang, serif",
  rounded: SANS,
  display: SANS,
} as const;

/** 페이지프렌즈의 안내 표시(사이트 디자인이 아님) — 테마와 상관없이 하늘색 */
const NOTE = { text: "#0369a1", bg: "#f0f9ff", line: "#7dd3fc", white: "#ffffff" };

type Colors = {
  ink: string;
  body: string;
  muted: string;
  faint: string;
  line: string;
  /** 입력칸 · 보조 버튼 테두리 */
  stroke: string;
  soft: string;
  soft2: string;
  bar: string;
  /** 페이지 바탕 */
  bg: string;
  /** 카드 바탕 */
  card: string;
  dark: string;
  onDark: string;
  onDarkMuted: string;
  onDarkSoft: string;
  darkLine: string;
};

function colorsOf(p: Palette): Colors {
  return {
    ink: p.text,
    body: p.body,
    muted: p.muted,
    faint: p.faint,
    line: p.line,
    stroke: p.stroke,
    soft: p.soft,
    soft2: p.soft2,
    bar: p.bar,
    bg: p.bg,
    card: p.card,
    dark: p.dark,
    onDark: p.onDark,
    onDarkMuted: p.onDarkMuted,
    onDarkSoft: p.onDarkSoft,
    darkLine: p.darkLine,
  };
}

// 그리는 동안만 쓰는 테마 값. renderDraft 는 동기 함수라 그리는 도중에 다른 요청이 끼어들지 않는다
let C: Colors = colorsOf(paletteOf(rulesDesign({ styleTags: [], primaryColor: "#2563eb" }).theme));
let FONT_BODY: string = FONT_STACK.sans;
let FONT_HEAD: string = FONT_STACK.sans;
/** 제목 굵기 */
let HW = 800;
let RAD = { card: 12, image: 10, input: 8, logo: 9 };
let BTN: Theme["buttonStyle"] = "pill";

type Sizes = { h1: number; h2: number; h3: number; body: number; small: number; sec: number; pad: number; gap: number };
const SIZES: Record<DeviceKind, Sizes> = {
  desktop: { h1: 50, h2: 34, h3: 21, body: 18, small: 14, sec: 96, pad: 120, gap: 28 },
  tablet: { h1: 40, h2: 28, h3: 19, body: 17, small: 14, sec: 72, pad: 48, gap: 20 },
  mobile: { h1: 30, h2: 24, h3: 17, body: 15, small: 13, sec: 56, pad: 20, gap: 14 },
};

const DENSITY = { compact: { sec: 0.78, gap: 0.86 }, normal: { sec: 1, gap: 1 }, airy: { sec: 1.32, gap: 1.18 } } as const;
const RADIUS = {
  none: { card: 0, image: 0, input: 0, logo: 0 },
  sm: { card: 4, image: 4, input: 4, logo: 4 },
  md: { card: 8, image: 8, input: 6, logo: 7 },
  lg: { card: 12, image: 10, input: 8, logo: 9 },
  xl: { card: 22, image: 18, input: 12, logo: 12 },
} as const;

type Ctx = {
  in: DraftInput;
  doc: DesignDoc;
  t: Theme;
  p: Palette;
  W: number;
  dev: DeviceKind;
  mob: boolean;
  desk: boolean;
  s: Sizes;
  pad: number;
  cw: number;
  primary: string;
  onPrimary: string;
  /** 바탕 위에 글자로 쓸 메인 색 (대비 보정) */
  primaryText: string;
  tint: string;
  tint2: string;
  cta: string;
  menu: HeaderMenu[];
  offerMenu: string;
  images: Map<string, ImageSlot>;
  out: string[];
  slots: SlotRect[];
  fields: FieldRect[];
  sections: SectionRect[];
  /** 아직 그리지 않은 관리자 목록 — 아래 행동 유도 띠가 있는 페이지면 띠 바로 앞에 그린다 */
  pendingList: Collection | null;
};

// ---------------------------------------------------------------------------------------------
// 기본 도구: 글자 폭 · 줄바꿈 · 도형
// ---------------------------------------------------------------------------------------------

const r = (n: number) => Math.round(n * 10) / 10;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 대략적인 글자 폭(em). 글꼴을 실제로 잴 수 없으므로 약간 넉넉하게 잡아 넘치지 않게 한다 */
function charWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  // 한글은 글꼴·크기에 따라 0.9~1em 이다. 작은 글자는 힌팅으로 넓어지므로 1em 로 잡는다
  if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3130 && c <= 0x318f)) return 1;
  if ((c >= 0x2e80 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef)) return 1;
  if (ch === " ") return 0.3;
  if (ch === "—" || ch === "…") return 1;
  if (/[0-9]/.test(ch)) return 0.6;
  if (/[A-Z]/.test(ch)) return 0.7;
  if (/[a-z]/.test(ch)) return 0.56;
  if (/[.,·:;!'"|()[\]\-/]/.test(ch)) return 0.4;
  return 0.65;
}

function measure(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch);
  return w * size * (bold ? 1.05 : 1);
}

function wrap(s: string, size: number, maxW: number, maxLines: number, bold = false): string[] {
  if (maxLines <= 0) return [];
  const words = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (measure(next, size, bold) <= maxW) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = "";
    if (measure(word, size, bold) <= maxW) {
      cur = word;
      continue;
    }
    // 한 단어가 너무 길면 글자 단위로 자른다
    let piece = "";
    for (const ch of word) {
      if (piece && measure(piece + ch, size, bold) > maxW) {
        lines.push(piece);
        piece = ch;
      } else piece += ch;
    }
    cur = piece;
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`, size, bold) > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

const fit = (s: string, size: number, maxW: number, bold = false) => wrap(s, size, maxW, 1, bold)[0] ?? "";

/** h: 제목 글꼴로 쓴다 */
type TextOpt = { size: number; weight?: number; fill?: string; anchor?: "start" | "middle" | "end"; h?: boolean };

/** 글 한 줄. cy 는 줄의 세로 가운데 */
function text(x: number, cy: number, s: string, o: TextOpt): string {
  const weight = o.weight ? ` font-weight="${o.weight}"` : "";
  const anchor = o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
  const family = o.h && FONT_HEAD !== FONT_BODY ? ` font-family="${FONT_HEAD}"` : "";
  return `<text x="${r(x)}" y="${r(cy + o.size * 0.36)}" font-size="${o.size}"${weight}${family} fill="${o.fill ?? C.ink}"${anchor}>${esc(s)}</text>`;
}

/** 여러 줄 (top 기준). 높이 = 줄 수 × lh */
function para(x: number, top: number, lines: string[], o: TextOpt & { lh: number }): string {
  return lines.map((l, i) => text(x, top + i * o.lh + o.lh / 2, l, o)).join("");
}

/** 문구 자리 위치를 남긴다. 가운데 정렬이면 x 가 가운데 */
function field(ctx: Ctx, key: string | undefined, x: number, top: number, lines: string[], o: { size: number; lh: number; bold?: boolean; anchor?: TextOpt["anchor"] }): void {
  if (!key || lines.length === 0) return;
  const w = Math.max(...lines.map((l) => measure(l, o.size, o.bold)));
  const left = o.anchor === "middle" ? x - w / 2 : o.anchor === "end" ? x - w : x;
  ctx.fields.push({ key, x: r(left - 4), y: r(top - 2), w: r(w + 8), h: r(lines.length * o.lh + 4), text: lines.join(" ") });
}

function box(x: number, y: number, w: number, h: number, fill: string, o?: { rx?: number; stroke?: string; sw?: number; dash?: string }): string {
  const rx = o?.rx ? ` rx="${o.rx}"` : "";
  const stroke = o?.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : "";
  const dash = o?.dash ? ` stroke-dasharray="${o.dash}"` : "";
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(0, w))}" height="${r(Math.max(0, h))}"${rx} fill="${fill}"${stroke}${dash}/>`;
}

/** 카드: 테마의 카드 모양(선 · 그림자 · 색면)과 모서리를 따른다 */
function card(ctx: Ctx, x: number, y: number, w: number, h: number): string {
  if (ctx.t.cardStyle === "shadow") return box(x, y, w, h, C.card, { rx: RAD.card }).replace("/>", ` filter="url(#pf-shadow)"/>`);
  if (ctx.t.cardStyle === "flat") return box(x, y, w, h, C.soft2, { rx: RAD.card });
  return box(x, y, w, h, C.card, { rx: RAD.card, stroke: C.line });
}

function hline(x1: number, x2: number, y: number, color = C.line): string {
  return `<line x1="${r(x1)}" y1="${r(y)}" x2="${r(x2)}" y2="${r(y)}" stroke="${color}"/>`;
}

/** 회색 막대 — 아직 받지 못한 글이 들어갈 자리 */
function bars(x: number, y: number, w: number, n: number, gap = 22, h = 10): { svg: string; h: number } {
  let svg = "";
  for (let i = 0; i < n; i++) {
    const k = i === n - 1 && n > 1 ? 0.58 : i % 3 === 1 ? 0.9 : 1;
    svg += box(x, y + i * gap, w * k, h, C.bar, { rx: 3 });
  }
  return { svg, h: n > 0 ? (n - 1) * gap + h : 0 };
}

/** 버튼 모서리: 테마의 버튼 모양 */
function buttonRadius(h: number): number {
  if (BTN === "pill") return h / 2;
  if (BTN === "square") return RAD.card === 0 ? 0 : 3;
  if (BTN === "outline") return RAD.card === 0 ? 0 : Math.min(h / 2, RAD.card);
  return Math.min(10, h / 4);
}

function button(x: number, y: number, label: string, o: { size: number; h: number; fill: string; color: string; stroke?: string; center?: boolean }): { svg: string; w: number } {
  const w = measure(label, o.size, true) + o.h * 1.1;
  const bx = o.center ? x - w / 2 : x;
  const svg =
    box(bx, y, w, o.h, o.fill, { rx: buttonRadius(o.h), stroke: o.stroke, sw: o.stroke ? 1.5 : undefined }) +
    text(bx + w / 2, y + o.h / 2, label, { size: o.size, weight: 700, fill: o.color, anchor: "middle" });
  return { svg, w };
}

/** 메인 버튼: 테두리 버튼 모양이면 바탕색에 메인 색 테두리 */
function primaryButton(ctx: Ctx, x: number, y: number, label: string, o: { size: number; h: number; center?: boolean; onTint?: boolean }): { svg: string; w: number } {
  if (BTN === "outline") return button(x, y, label, { ...o, fill: "none", color: ctx.primaryText, stroke: ctx.primaryText });
  return button(x, y, label, { ...o, fill: ctx.primary, color: ctx.onPrimary });
}

/** 보조 버튼: 바탕색 + 연한 테두리 */
function secondaryButton(x: number, y: number, label: string, o: { size: number; h: number; center?: boolean }): { svg: string; w: number } {
  return button(x, y, label, { ...o, fill: C.bg, color: C.ink, stroke: C.stroke });
}

function chevron(x: number, cy: number, color: string): string {
  return `<polyline points="${r(x)},${r(cy - 2)} ${r(x + 4)},${r(cy + 2)} ${r(x + 8)},${r(cy - 2)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** 초안 안내문 — 아직 받지 못한 내용이 들어갈 자리. 사이트 디자인이 아니라 페이지프렌즈의 안내라 하늘색 점선으로 구분한다 */
function note(ctx: Ctx, x: number, y: number, w: number, msg: string): number {
  const size = ctx.desk ? 16 : ctx.s.small;
  const lh = size + 8;
  const lines = wrap(msg, size, w - 52, 3);
  const h = lines.length * lh + 22;
  ctx.out.push(
    box(x, y, w, h, NOTE.bg, { rx: 8, stroke: NOTE.line, dash: "6 5" }) +
      `<circle cx="${r(x + 20)}" cy="${r(y + 11 + lh / 2)}" r="8" fill="${NOTE.text}"/>` +
      text(x + 20, y + 11 + lh / 2, "i", { size: 11, weight: 800, fill: NOTE.white, anchor: "middle" }) +
      para(x + 38, y + 11, lines, { size, lh, fill: NOTE.text }),
  );
  return y + h;
}

function pictureIcon(cx: number, cy: number, s: number, color: string): string {
  const w = s;
  const h = s * 0.8;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const pts = [
    [0.1, 0.84],
    [0.38, 0.48],
    [0.6, 0.72],
    [0.74, 0.58],
    [0.9, 0.8],
  ]
    .map(([a, b]) => `${r(x + w * a)},${r(y + h * b)}`)
    .join(" ");
  return (
    `<g fill="none" stroke="${color}" stroke-width="${s > 26 ? 2.4 : 1.8}" stroke-linejoin="round" stroke-linecap="round">` +
    `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(s * 0.12)}"/>` +
    `<circle cx="${r(x + w * 0.7)}" cy="${r(y + h * 0.3)}" r="${r(s * 0.08)}"/>` +
    `<polyline points="${pts}"/></g>`
  );
}

function sparkleIcon(cx: number, cy: number, s: number, color: string): string {
  const star = (x: number, y: number, k: number) =>
    `M${r(x)},${r(y - k)} Q${r(x)},${r(y)} ${r(x + k)},${r(y)} Q${r(x)},${r(y)} ${r(x)},${r(y + k)} Q${r(x)},${r(y)} ${r(x - k)},${r(y)} Q${r(x)},${r(y)} ${r(x)},${r(y - k)}Z`;
  return `<path d="${star(cx - s * 0.12, cy + s * 0.08, s * 0.42)} ${star(cx + s * 0.3, cy - s * 0.28, s * 0.2)}" fill="${color}"/>`;
}

/** 문구 찾기: 디자인 문서의 이 페이지 문구 → 사이트 공통 → 기본 문구 */
function cp(ctx: Ctx, key: string, fallback: string): string {
  return copyOf(ctx.doc, ctx.in.page.path, key) ?? fallback;
}

// ---------------------------------------------------------------------------------------------
// 이미지 자리
// ---------------------------------------------------------------------------------------------

/**
 * 빈 이미지 자리. 회색 점선 = 비어 있는 자리(이미지 필요 · 실제 사진 필요), 파란 점선 = AI 로 만들 자리.
 * 첫 장에만 설명(어떤 이미지가 필요한지)과 권장 크기를 적는다 — 여러 장짜리 자리에서 같은 글이 반복되지 않게.
 */
function image(ctx: Ctx, x: number, y: number, w: number, h: number, id: string, idx = 0, rx = RAD.image): void {
  const slot = ctx.images.get(id);
  ctx.slots.push({ id, x: r(x), y: r(y), w: r(w), h: r(h) });
  if (!slot) {
    ctx.out.push(box(x, y, w, h, C.soft2, { rx }));
    return;
  }
  const ai = slot.generate;
  const real = !ai && slot.source === "real";
  let svg = box(x, y, w, h, ai ? "#eff6ff" : C.soft2, { rx, stroke: ai ? "#60a5fa" : C.faint, sw: 2, dash: "10 7" });

  // 편집기는 데스크톱 캡처를 화면 폭에 맞춰 줄여 보여 주므로(보통 60% 안팎) 큰 자리일수록 글자를 키운다
  const tiny = w < 150 || h < 120;
  const small = !tiny && (w < 280 || h < 190);
  const large = !small && !tiny && w >= 460 && h >= 300;
  const chip = ai ? "AI 이미지 생성 예정" : real ? "실제 사진 필요" : "이미지 필요";
  const iconS = tiny ? 18 : small ? 26 : large ? 48 : 38;
  const chipSize = tiny ? 10 : small ? 12 : large ? 15 : 13;
  const chipH = chipSize + 12;
  const labelSize = tiny ? 11 : small ? 13 : large ? 21 : 17;
  const labelLh = labelSize + 6;
  const needSize = small ? 12 : large ? 16 : 14;
  const needLh = needSize + 7;
  const inner = w - (tiny ? 14 : large ? 64 : 36);
  const label = slot.count > 1 ? `${slot.label} ${idx + 1}/${slot.count}` : slot.label;
  let labelLines = wrap(label, labelSize, inner, tiny ? 1 : 2, true);
  const first = idx === 0;

  let fixed = iconS + 10 + chipH;
  if (h - 20 > fixed + 8 + labelLines.length * labelLh) fixed += 8 + labelLines.length * labelLh;
  else labelLines = [];
  const sizeLine = first && !tiny && !small ? `권장 ${RATIO_SIZE[slot.ratio]} · ${RATIO_SHAPE[slot.ratio]}` : null;
  const sizeH = sizeLine ? (large ? 30 : 24) : 0;
  const avail = h - 30 - fixed - sizeH - 6;
  const maxNeed = first && !tiny ? Math.max(0, Math.min(small ? 2 : 4, Math.floor(avail / needLh))) : 0;
  const needLines = wrap(slot.need, needSize, inner, maxNeed);
  const total = fixed + (needLines.length ? 6 + needLines.length * needLh : 0) + (sizeLine && avail > 0 ? sizeH : 0);

  const cx = x + w / 2;
  let cy = y + Math.max(10, (h - total) / 2);
  svg += ai ? sparkleIcon(cx, cy + iconS / 2, iconS, "#3b82f6") : pictureIcon(cx, cy + iconS / 2, iconS, C.faint);
  cy += iconS + 10;
  const chipW = measure(chip, chipSize, true) + chipSize * 1.6;
  svg += box(cx - chipW / 2, cy, chipW, chipH, ai ? "#2563eb" : real ? C.dark : C.stroke, { rx: chipH / 2 });
  svg += text(cx, cy + chipH / 2, chip, { size: chipSize, weight: 700, fill: ai ? "#ffffff" : real ? C.onDark : C.ink, anchor: "middle" });
  cy += chipH;
  if (labelLines.length) {
    cy += 8;
    svg += para(cx, cy, labelLines, { size: labelSize, lh: labelLh, weight: 700, fill: C.body, anchor: "middle" });
    cy += labelLines.length * labelLh;
  }
  if (needLines.length) {
    cy += 6;
    svg += para(cx, cy, needLines, { size: needSize, lh: needLh, fill: C.muted, anchor: "middle" });
    cy += needLines.length * needLh;
  }
  if (sizeLine && avail > 0) svg += text(cx, cy + sizeH / 2 + 4, sizeLine, { size: large ? 14 : 12, fill: C.faint, anchor: "middle" });
  ctx.out.push(svg);
}

// ---------------------------------------------------------------------------------------------
// 공통 블록
// ---------------------------------------------------------------------------------------------

/** 배경이 있는 구역. 내용 높이를 먼저 알아야 배경을 그릴 수 있으므로 그린 뒤 배경을 앞에 끼워 넣는다 */
function section(ctx: Ctx, y: number, bg: string, body: (top: number) => number, id = "main"): number {
  const mark = ctx.out.length;
  const end = body(y + ctx.s.sec) + ctx.s.sec;
  ctx.out.splice(mark, 0, box(0, y, ctx.W, end - y, bg));
  ctx.sections.push({ id, x: 0, y: r(y), w: ctx.W, h: r(end - y) });
  return end;
}

function heading(
  ctx: Ctx,
  x: number,
  y: number,
  title: string,
  sub: string | null,
  o?: { center?: boolean; maxW?: number; color?: string; subColor?: string; keys?: { title?: string; sub?: string } },
): number {
  const { s } = ctx;
  const maxW = o?.maxW ?? ctx.cw;
  const cx = o?.center ? x + maxW / 2 : x;
  const anchor = o?.center ? "middle" : "start";
  const tl = wrap(title, s.h2, maxW, 2, true);
  ctx.out.push(para(cx, y, tl, { size: s.h2, lh: s.h2 + 10, weight: HW, fill: o?.color ?? C.ink, anchor, h: true }));
  field(ctx, o?.keys?.title, cx, y, tl, { size: s.h2, lh: s.h2 + 10, bold: true, anchor });
  y += tl.length * (s.h2 + 10);
  if (sub) {
    const sl = wrap(sub, s.body, maxW, 2);
    y += 8;
    ctx.out.push(para(cx, y, sl, { size: s.body, lh: s.body + 10, fill: o?.subColor ?? C.muted, anchor }));
    field(ctx, o?.keys?.sub, cx, y, sl, { size: s.body, lh: s.body + 10, anchor });
    y += sl.length * (s.body + 10);
  }
  return y + (ctx.mob ? 24 : 40);
}

function colWidth(ctx: Ctx, cols: number, gap = ctx.s.gap): number {
  return (ctx.cw - gap * (cols - 1)) / cols;
}

function header(ctx: Ctx, y: number): number {
  const { W, pad } = ctx;
  const h = ctx.desk ? 84 : 64;
  let svg = box(0, y, W, h, C.bg) + hline(0, W, y + h - 0.5);
  const logo = ctx.desk ? 36 : 30;
  const ly = y + (h - logo) / 2;
  const initial = [...ctx.in.siteName.trim()][0] ?? "P";
  svg += box(pad, ly, logo, logo, ctx.primary, { rx: RAD.logo }) + text(pad + logo / 2, ly + logo / 2, initial, { size: Math.round(logo * 0.46), weight: 800, fill: ctx.onPrimary, anchor: "middle", h: true });
  const nameSize = ctx.desk ? 20 : 17;
  const nameX = pad + logo + 10;
  const cy = y + h / 2;

  if (ctx.desk) {
    const ctaW = measure(ctx.cta, 15, true) + 42 * 1.1;
    const ctaX = W - pad - ctaW;
    svg += primaryButton(ctx, ctaX, y + (h - 42) / 2, ctx.cta, { size: 15, h: 42 }).svg;
    ctx.fields.push({ key: "site.cta", x: r(ctaX), y: r(y + (h - 42) / 2), w: r(ctaW), h: 42, text: ctx.cta });
    const name = fit(ctx.in.siteName, nameSize, 250, true);
    svg += text(nameX, cy, name, { size: nameSize, weight: 800, h: true });

    // 메뉴: 이름과 버튼 사이 가운데. 넘치면 간격 → 글자 크기 → 뒤쪽 메뉴("더보기") 순으로 줄인다
    const left = nameX + measure(name, nameSize, true) + 48;
    const right = ctaX - 36;
    let size = 16;
    let gap = 40;
    const itemW = (m: HeaderMenu) => measure(m.label, size, true) + (m.children.length ? 14 : 0);
    const sum = (list: HeaderMenu[], more: boolean) => list.reduce((n, m) => n + itemW(m), 0) + gap * Math.max(0, list.length - 1 + (more ? 1 : 0)) + (more ? measure("더보기", size, true) : 0);
    while (sum(ctx.menu, false) > right - left && (gap > 24 || size > 14)) {
      if (gap > 24) gap -= 4;
      else size -= 1;
    }
    let shown = ctx.menu;
    let more = false;
    while (shown.length > 1 && sum(shown, more) > right - left) {
      shown = shown.slice(0, -1);
      more = true;
    }
    let x = left + Math.max(0, (right - left - sum(shown, more)) / 2);
    for (const m of shown) {
      const active = m.path === ctx.in.page.path || m.children.some((c) => c.path === ctx.in.page.path);
      const lw = measure(m.label, size, true);
      svg += text(x, cy, m.label, { size, weight: active ? 700 : 500, fill: active ? ctx.primaryText : C.body });
      if (m.children.length) svg += chevron(x + lw + 5, cy, active ? ctx.primaryText : C.faint);
      if (active) svg += box(x, y + h - 3, itemW(m), 3, ctx.primaryText);
      x += itemW(m) + gap;
    }
    if (more) svg += text(x, cy, "더보기", { size, weight: 500, fill: C.muted });
  } else {
    const name = fit(ctx.in.siteName, nameSize, W - nameX - pad - 44, true);
    svg += text(nameX, cy, name, { size: nameSize, weight: 800, h: true });
    const hx = W - pad - 22;
    for (let i = 0; i < 3; i++) svg += box(hx, cy - 8 + i * 7, 22, 2.5, C.ink, { rx: 1 });
  }
  ctx.out.push(svg);
  ctx.sections.push({ id: "header", x: 0, y: r(y), w: W, h });
  return y + h;
}

const SUBTITLE: Partial<Record<PageKind, (ctx: Ctx) => string>> = {
  about: (c) => `${josa(c.in.siteName, "을/를")} 소개합니다`,
  greeting: () => "찾아 주셔서 감사합니다",
  history: (c) => `${josa(c.in.siteName, "이/가")} 걸어온 길`,
  location: () => "찾아오시는 길을 안내해 드려요",
  services: (c) => `${josa(c.in.siteName, "이/가")} 준비한 ${c.offerMenu}`,
  products: (c) => `${josa(c.in.siteName, "이/가")} 준비한 ${c.offerMenu}`,
  portfolio: () => "사진으로 둘러보세요",
  reviews: () => "고객님들이 남겨 주신 이야기",
  team: () => "함께하는 사람들을 소개합니다",
  notice: () => "새로운 소식을 알려 드려요",
  faq: () => "자주 묻는 질문을 모았어요",
  contact: () => "궁금한 점을 남겨 주시면 빠르게 답변드려요",
  reservation: () => "원하는 날짜와 시간을 골라 예약하세요",
  pricing: () => "요금을 한눈에 비교해 보세요",
  cases: () => "함께한 고객의 이야기",
  blog: () => "알아 두면 좋은 이야기",
  careers: () => "함께 성장할 동료를 찾습니다",
};

function subtitle(ctx: Ctx): string {
  const p = ctx.in.page;
  if (p.kind === "service") {
    const o = p.offering !== null ? ctx.in.business.offerings[p.offering] : null;
    const desc = p.offering !== null ? copyOf(ctx.doc, p.path, `offering.${p.offering}.description`) : undefined;
    return desc || o?.description.trim() || `${p.label} 안내`;
  }
  if (p.kind === "generic") return p.note.split(/[.\n]/)[0]?.trim().slice(0, 60) || `${p.label} 안내`;
  return SUBTITLE[p.kind]?.(ctx) ?? `${p.label} 안내`;
}

function titleBand(ctx: Ctx, y: number): number {
  const { s, pad } = ctx;
  const p = ctx.in.page;
  const crumbs = ["홈", ...(p.group ? [p.group] : []), p.label].join("  ›  ");
  const top = ctx.mob ? 32 : 56;
  const titleLines = wrap(p.label, s.h1, ctx.cw, 2, true);
  const subLines = wrap(cp(ctx, "page.subtitle", subtitle(ctx)), s.body, Math.min(ctx.cw, 720), 2);
  const h = top + 18 + 16 + titleLines.length * (s.h1 + 10) + 10 + subLines.length * (s.body + 10) + (ctx.mob ? 32 : 56);
  let svg = box(0, y, ctx.W, h, ctx.tint);
  svg += text(pad, y + top + 9, fit(crumbs, 13, ctx.cw), { size: 13, fill: C.muted });
  let cy = y + top + 18 + 16;
  svg += para(pad, cy, titleLines, { size: s.h1, lh: s.h1 + 10, weight: HW, h: true });
  cy += titleLines.length * (s.h1 + 10) + 10;
  svg += para(pad, cy, subLines, { size: s.body, lh: s.body + 10, fill: C.muted });
  field(ctx, "page.subtitle", pad, cy, subLines, { size: s.body, lh: s.body + 10 });
  ctx.out.push(svg);
  ctx.sections.push({ id: "title", x: 0, y: r(y), w: ctx.W, h: r(h) });
  return y + h;
}

/** 하위 페이지 탭 (같은 묶음의 다른 페이지) */
function subNav(ctx: Ctx, y: number): number {
  const p = ctx.in.page;
  const group = ctx.menu.find((m) => m.children.some((c) => c.path === p.path));
  if (!group || group.children.length < 2) return y;
  const h = ctx.mob ? 52 : 60;
  const size = ctx.mob ? 14 : 16;
  let svg = box(0, y, ctx.W, h, C.bg) + hline(0, ctx.W, y + h - 0.5);
  const gap = ctx.mob ? 22 : 40;
  const widths = group.children.map((c) => measure(c.label, size, true));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  let x = ctx.mob || total > ctx.cw ? ctx.pad : ctx.pad + (ctx.cw - total) / 2;
  group.children.forEach((c, i) => {
    if (x > ctx.W - ctx.pad) return;
    const active = c.path === p.path;
    svg += text(x, y + h / 2, c.label, { size, weight: active ? 700 : 500, fill: active ? ctx.primaryText : C.muted });
    if (active) svg += box(x, y + h - 3, widths[i], 3, ctx.primaryText);
    x += widths[i] + gap;
  });
  ctx.out.push(svg);
  ctx.sections.push({ id: "subnav", x: 0, y: r(y), w: ctx.W, h });
  return y + h;
}

function contactRows(ctx: Ctx): [string, string][] {
  const c = ctx.in.business.contact;
  return (
    [
      ["전화", c.phone],
      ["이메일", c.email],
      ["주소", c.address],
      ["운영 시간", c.hours],
    ] as [string, string][]
  ).filter(([, v]) => v.trim());
}

function footer(ctx: Ctx, y: number): number {
  const { W, pad, s } = ctx;
  const mark = ctx.out.length;
  const top = y + (ctx.mob ? 44 : 64);
  const leftW = ctx.desk ? 400 : ctx.cw;
  let ly = top;
  const nameLines = wrap(ctx.in.siteName, 20, leftW, 2, true);
  ctx.out.push(para(pad, ly, nameLines, { size: 20, lh: 28, weight: 800, fill: C.onDark, h: true }));
  ly += nameLines.length * 28 + 8;
  const tag = cp(ctx, "footer.tagline", ctx.in.business.tagline.trim());
  if (tag) {
    const tl = wrap(tag, s.small, leftW, 2);
    ctx.out.push(para(pad, ly, tl, { size: s.small, lh: s.small + 8, fill: C.onDarkMuted }));
    field(ctx, "footer.tagline", pad, ly, tl, { size: s.small, lh: s.small + 8 });
    ly += tl.length * (s.small + 8);
  }
  ly += 18;
  const rows = contactRows(ctx);
  if (rows.length) {
    for (const [k, v] of rows) {
      const line = fit(`${k}  ${v}`, s.small, leftW);
      ctx.out.push(text(pad, ly + 10, line, { size: s.small, fill: C.onDarkSoft }));
      ly += 24;
    }
  } else {
    ctx.out.push(text(pad, ly + 10, fit("연락처(전화·이메일·주소)를 알려 주시면 여기에 들어가요", s.small, leftW), { size: s.small, fill: NOTE.line }));
    ly += 24;
  }

  // 데스크톱: 오른쪽에 사이트맵 (헤더 메뉴와 하위 페이지)
  let ry = top;
  if (ctx.desk && ctx.menu.length) {
    const cols = Math.min(5, ctx.menu.length);
    const x0 = pad + leftW + 80;
    const cw = (W - pad - x0) / cols;
    ctx.menu.slice(0, cols).forEach((m, i) => {
      const x = x0 + i * cw;
      ctx.out.push(text(x, top + 10, fit(m.label, 15, cw - 16, true), { size: 15, weight: 700, fill: C.onDark }));
      m.children.slice(0, 6).forEach((c, j) => ctx.out.push(text(x, top + 44 + j * 28, fit(c.label, 14, cw - 16), { size: 14, fill: C.onDarkMuted })));
      ry = Math.max(ry, top + 44 + Math.max(0, Math.min(6, m.children.length)) * 28);
    });
  }
  const bottom = Math.max(ly, ry) + 28;
  ctx.out.push(hline(pad, W - pad, bottom, C.darkLine));
  ctx.out.push(text(pad, bottom + 30, fit(`© ${ctx.in.year} ${ctx.in.siteName}. All rights reserved.`, 13, ctx.cw), { size: 13, fill: C.muted }));
  const end = bottom + 60;
  ctx.out.splice(mark, 0, box(0, y, W, end - y, C.dark));
  ctx.sections.push({ id: "footer", x: 0, y: r(y), w: W, h: r(end - y) });
  return end;
}

function ctaBand(ctx: Ctx, y: number): number {
  if (ctx.pendingList) {
    const list = ctx.pendingList;
    ctx.pendingList = null;
    y = collectionList(ctx, y, list, true);
  }
  const purposes = ctx.in.business.purposes;
  const title = cp(
    ctx,
    "cta.title",
    purposes.includes("reservation")
      ? "지금 바로 예약하세요"
      : purposes.includes("inquiry")
        ? "궁금한 점이 있으신가요?"
        : purposes.includes("sales")
          ? "지금 바로 만나 보세요"
          : `${josa(ctx.in.siteName, "와/과")} 함께하세요`,
  );
  const phone = ctx.in.business.contact.phone.trim();
  const sub = cp(ctx, "cta.subtitle", phone ? `전화 ${phone} 로도 편하게 연락 주세요` : "편하게 연락 주세요. 빠르게 답변드릴게요");
  return section(
    ctx,
    y,
    ctx.primary,
    (top) => {
      const yy = heading(ctx, ctx.pad, top, title, sub, {
        center: true,
        color: ctx.onPrimary,
        subColor: ctx.onPrimary === "#ffffff" ? "#e2e8f0" : "#334155",
        keys: { title: "cta.title", sub: "cta.subtitle" },
      });
      const h = ctx.mob ? 46 : 52;
      const by = yy - (ctx.mob ? 8 : 16);
      // 메인 색 띠 위의 버튼은 어떤 테마에서도 흰 바탕 + 짙은 글자 (띠와 확실히 구분되게)
      const b = button(ctx.W / 2, by, ctx.cta, { size: ctx.mob ? 15 : 16, h, fill: "#ffffff", color: "#0f172a", center: true });
      ctx.out.push(b.svg);
      ctx.fields.push({ key: "site.cta", x: r(ctx.W / 2 - b.w / 2), y: r(by), w: r(b.w), h, text: ctx.cta });
      return by + h;
    },
    "cta",
  );
}

// ---------------------------------------------------------------------------------------------
// 구역들
// ---------------------------------------------------------------------------------------------

/**
 * 첫 화면. 배치는 테마의 heroLayout:
 *   split  글 왼쪽 · 사진 오른쪽 (모바일은 위아래)
 *   center 가운데 정렬 제목 + 아래 사진
 *   wide   제목 아래 화면 폭을 가득 채우는 사진
 */
function hero(ctx: Ctx, y: number): number {
  const { s, pad, cw } = ctx;
  const b = ctx.in.business;
  const ind = industryOf(b.category);
  const title = cp(ctx, "hero.title", b.tagline.trim() || `${ctx.in.siteName}에 오신 것을 환영합니다`);
  const offerNames = b.offerings.map((o) => o.name.trim()).filter(Boolean);
  const sub = cp(ctx, "hero.subtitle", offerNames.length ? `${ctx.in.siteName} · ${offerNames.slice(0, 4).join(" · ")}` : ctx.in.siteName);
  const eyebrow = cp(ctx, "hero.eyebrow", ctx.in.industry.trim() || ind.label);
  const second = cp(ctx, "hero.secondary", `${ctx.offerMenu} 보기`);
  const layout = ctx.t.heroLayout;
  const center = layout === "center";
  const titleLh = Math.round(s.h1 * 1.22);

  /** 머리글 · 제목 · 설명 · 버튼. x 는 center 면 가운데 */
  const writeText = (x: number, ty: number, textW: number): number => {
    const anchor = center ? "middle" : "start";
    const ey = fit(eyebrow, 15, textW, true);
    ctx.out.push(text(x, ty + 10, ey, { size: 15, weight: 700, fill: ctx.primaryText, anchor }));
    field(ctx, "hero.eyebrow", x, ty, [ey], { size: 15, lh: 20, bold: true, anchor });
    ty += 34;
    const tl = wrap(title, s.h1, textW, 3, true);
    ctx.out.push(para(x, ty, tl, { size: s.h1, lh: titleLh, weight: HW, anchor, h: true }));
    field(ctx, "hero.title", x, ty, tl, { size: s.h1, lh: titleLh, bold: true, anchor });
    ty += tl.length * titleLh + 16;
    const sl = wrap(sub, s.body + 1, textW, 2);
    ctx.out.push(para(x, ty, sl, { size: s.body + 1, lh: s.body + 12, fill: C.muted, anchor }));
    field(ctx, "hero.subtitle", x, ty, sl, { size: s.body + 1, lh: s.body + 12, anchor });
    ty += sl.length * (s.body + 12) + 28;
    const bh = ctx.mob ? 46 : 52;
    const bs = ctx.mob ? 15 : 16;
    const b1w = measure(ctx.cta, bs, true) + bh * 1.1;
    const b2w = measure(second, bs, true) + bh * 1.1;
    const both = b1w + 12 + b2w <= textW;
    const startX = center ? x - (both ? b1w + 12 + b2w : b1w) / 2 : x;
    ctx.out.push(primaryButton(ctx, startX, ty, ctx.cta, { size: bs, h: bh }).svg);
    ctx.fields.push({ key: "site.cta", x: r(startX), y: r(ty), w: r(b1w), h: bh, text: ctx.cta });
    if (both) {
      ctx.out.push(secondaryButton(startX + b1w + 12, ty, second, { size: bs, h: bh }).svg);
      ctx.fields.push({ key: "hero.secondary", x: r(startX + b1w + 12), y: r(ty), w: r(b2w), h: bh, text: second });
    }
    return ty + bh;
  };

  if (layout === "wide") {
    // 글은 띠 안에, 사진은 띠 아래에 화면 폭 가득 (여백 없이)
    const end = section(ctx, y, ctx.tint, (top) => writeText(pad, top + (ctx.desk ? 10 : 0), Math.min(cw, 900)), "hero");
    const ih = ctx.desk ? 600 : ctx.mob ? 280 : 440;
    image(ctx, 0, end, ctx.W, ih, "hero", 0, 0);
    const heroSection = ctx.sections.find((sec) => sec.id === "hero" && sec.y === r(y));
    if (heroSection) heroSection.h = r(end + ih - y);
    return end + ih;
  }

  return section(
    ctx,
    y,
    ctx.tint,
    (top) => {
      if (center) {
        const maxW = Math.min(cw, 860);
        const ty = writeText(ctx.W / 2, top + (ctx.desk ? 10 : 0), maxW);
        const imgW = ctx.desk ? Math.min(cw, 1080) : cw;
        const imgH = Math.round(imgW * (ctx.desk ? 0.46 : 0.62));
        image(ctx, (ctx.W - imgW) / 2, ty + (ctx.mob ? 36 : 56), imgW, imgH, "hero");
        return ty + (ctx.mob ? 36 : 56) + imgH;
      }
      const imgW = ctx.desk ? 560 : cw;
      const imgH = ctx.desk ? 420 : Math.round(cw * 0.6);
      const textW = ctx.desk ? cw - imgW - 64 : cw;
      const ty = writeText(pad, top + (ctx.desk ? 30 : 0), textW);
      if (ctx.desk) {
        image(ctx, pad + cw - imgW, top, imgW, imgH, "hero");
        return Math.max(ty + 30, top + imgH);
      }
      image(ctx, pad, ty + 36, imgW, imgH, "hero");
      return ty + 36 + imgH;
    },
    "hero",
  );
}

/** 서비스·상품 카드 격자 (홈 · 상품 목록) */
function offeringGrid(
  ctx: Ctx,
  y: number,
  o: { bg: string; title: string | null; sub: string | null; max: number; mobileCols: number; aspect: number; keys?: { title?: string; sub?: string } },
): number {
  const offerings = ctx.in.business.offerings.slice(0, o.max);
  const n = offerings.length;
  if (!n) return y;
  return section(
    ctx,
    y,
    o.bg,
    (top) => {
      let yy = o.title ? heading(ctx, ctx.pad, top, o.title, o.sub, { keys: o.keys }) : top;
      const cols = ctx.mob ? o.mobileCols : ctx.desk ? (n === 4 ? 4 : n >= 3 ? 3 : 2) : 2;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const imgH = Math.round(w * o.aspect);
      const tiny = w < 200;
      const nameSize = tiny ? 15 : ctx.s.h3;
      const descSize = tiny ? 13 : ctx.s.small + 1;
      const descLines = tiny ? 2 : 3;
      const cardH = imgH + 20 + nameSize + 10 + descLines * (descSize + 7) + 20;
      offerings.forEach((off, i) => {
        // 마지막 줄이 덜 차면 가운데로 모은다 (서비스가 1개뿐일 때 한쪽에 치우치지 않게)
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols);
        const cx = ctx.pad + ((cols - inRow) * (w + gap)) / 2 + (i % cols) * (w + gap);
        const cy = yy + row * (cardH + gap);
        ctx.out.push(card(ctx, cx, cy, w, cardH));
        image(ctx, cx, cy, w, imgH, `offering:${i}`);
        const pad = tiny ? 12 : 20;
        ctx.out.push(text(cx + pad, cy + imgH + 20 + nameSize / 2, fit(off.name, nameSize, w - pad * 2, true), { size: nameSize, weight: 700, h: true }));
        const key = `offering.${i}.description`;
        const desc = cp(ctx, key, off.description.trim());
        if (desc) {
          const dl = wrap(desc, descSize, w - pad * 2, descLines);
          ctx.out.push(para(cx + pad, cy + imgH + 20 + nameSize + 10, dl, { size: descSize, lh: descSize + 7, fill: C.muted }));
          field(ctx, key, cx + pad, cy + imgH + 20 + nameSize + 10, dl, { size: descSize, lh: descSize + 7 });
        } else {
          ctx.out.push(bars(cx + pad, cy + imgH + 20 + nameSize + 16, w - pad * 2, 2, 18, 8).svg);
          ctx.fields.push({ key, x: r(cx + pad), y: r(cy + imgH + 20 + nameSize + 12), w: r(w - pad * 2), h: 34, text: "" });
        }
      });
      yy += Math.ceil(n / cols) * (cardH + gap) - gap;
      return yy;
    },
    "offerings",
  );
}

function strengths(ctx: Ctx, y: number): number {
  const list = ctx.in.business.strengths.map((t) => t.trim()).filter(Boolean).slice(0, 4);
  return section(
    ctx,
    y,
    C.soft,
    (top) => {
      let yy = heading(ctx, ctx.pad, top, cp(ctx, "strengths.title", `${josa(ctx.in.siteName, "을/를")} 선택하는 이유`), null, { keys: { title: "strengths.title" } });
      const n = list.length || 3;
      const cols = ctx.mob ? 1 : ctx.desk ? Math.min(n, 4) : 2;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const size = ctx.mob ? 16 : 19;
      const itemH = 56 + 16 + 3 * (size + 8);
      for (let i = 0; i < n; i++) {
        const x = ctx.pad + (i % cols) * (w + gap);
        const iy = yy + Math.floor(i / cols) * (itemH + gap);
        ctx.out.push(card(ctx, x, iy, w, itemH));
        ctx.out.push(`<circle cx="${r(x + 44)}" cy="${r(iy + 44)}" r="20" fill="${ctx.tint2}"/>`);
        ctx.out.push(text(x + 44, iy + 44, String(i + 1).padStart(2, "0"), { size: 14, weight: 800, fill: ctx.primaryText, anchor: "middle" }));
        if (list[i]) {
          // 고객이 적은 강점만 다듬은 문구로 바꾼다 (없는 강점을 지어내지 않는다)
          const key = `strength.${i}`;
          const lines = wrap(cp(ctx, key, list[i]), size, w - 48, 3, true);
          ctx.out.push(para(x + 24, iy + 76, lines, { size, lh: size + 8, weight: 700 }));
          field(ctx, key, x + 24, iy + 76, lines, { size, lh: size + 8, bold: true });
        } else ctx.out.push(bars(x + 24, iy + 82, w - 48, 2, 22, 11).svg);
      }
      yy += Math.ceil(n / cols) * (itemH + gap) - gap;
      if (!list.length) yy = note(ctx, ctx.pad, yy + 24, ctx.cw, "고객이 우리를 고르는 이유(강점)를 알려 주시면 이 자리를 채워 드려요");
      return yy;
    },
    "strengths",
  );
}

function aboutTeaser(ctx: Ctx, y: number): number {
  const about = cp(ctx, "about.body", ctx.in.business.about.trim());
  return section(
    ctx,
    y,
    C.bg,
    (top) => {
      const maxW = Math.min(ctx.cw, 760);
      const x = ctx.pad + (ctx.cw - maxW) / 2;
      let yy = heading(ctx, x, top, cp(ctx, "about.title", `${ctx.in.siteName} 이야기`), null, { center: true, maxW, keys: { title: "about.title" } });
      if (about) {
        const ls = wrap(about, ctx.s.body, maxW, 5);
        ctx.out.push(para(x + maxW / 2, yy, ls, { size: ctx.s.body, lh: ctx.s.body + 12, fill: C.body, anchor: "middle" }));
        field(ctx, "about.body", x + maxW / 2, yy, ls, { size: ctx.s.body, lh: ctx.s.body + 12, anchor: "middle" });
        yy += ls.length * (ctx.s.body + 12);
      } else {
        const bw = maxW * 0.8;
        ctx.out.push(bars(x + (maxW - bw) / 2, yy, bw, 3, 24, 11).svg);
        ctx.fields.push({ key: "about.body", x: r(x + (maxW - bw) / 2), y: r(yy - 4), w: r(bw), h: 67, text: "" });
        yy += 2 * 24 + 11;
      }
      yy += 32;
      const label = cp(ctx, "about.button", "더 알아보기");
      const b = secondaryButton(ctx.W / 2, yy, label, { size: 15, h: 46, center: true });
      ctx.out.push(b.svg);
      ctx.fields.push({ key: "about.button", x: r(ctx.W / 2 - b.w / 2), y: r(yy), w: r(b.w), h: 46, text: label });
      return yy + 46;
    },
    "about",
  );
}

function reviewCards(ctx: Ctx, y: number, count: number, withHeading: boolean): number {
  return section(
    ctx,
    y,
    C.soft,
    (top) => {
      let yy = withHeading ? heading(ctx, ctx.pad, top, cp(ctx, "reviews.title", "고객 후기"), null, { keys: { title: "reviews.title" } }) : top;
      const cols = ctx.mob ? 1 : ctx.desk ? 3 : 2;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const h = 200;
      for (let i = 0; i < count; i++) {
        const x = ctx.pad + (i % cols) * (w + gap);
        const cy = yy + Math.floor(i / cols) * (h + gap);
        ctx.out.push(card(ctx, x, cy, w, h));
        ctx.out.push(text(x + 24, cy + 36, "★★★★★", { size: 16, fill: ctx.primaryText }));
        ctx.out.push(bars(x + 24, cy + 66, w - 48, 3, 22, 10).svg);
        ctx.out.push(`<circle cx="${r(x + 40)}" cy="${r(cy + h - 40)}" r="16" fill="${C.soft2}"/>`);
        ctx.out.push(box(x + 66, cy + h - 46, 80, 12, C.bar, { rx: 3 }));
      }
      yy += Math.ceil(count / cols) * (h + gap) - gap;
      return note(ctx, ctx.pad, yy + 24, ctx.cw, "실제 고객 후기를 보내 주시면 이 자리에 넣어 드려요");
    },
    "reviews",
  );
}

/** 글 + 이미지 두 칸 (데스크톱은 나란히, 그 외는 위아래) */
function textImage(ctx: Ctx, top: number, slotId: string, o: { imageLeft?: boolean; imgW?: number; aspect: number; writeText: (x: number, y: number, w: number) => number }): number {
  const imgW = ctx.desk ? (o.imgW ?? 520) : ctx.cw;
  const imgH = Math.round(imgW * o.aspect);
  if (ctx.desk) {
    const textW = ctx.cw - imgW - 72;
    const ix = o.imageLeft ? ctx.pad : ctx.pad + ctx.cw - imgW;
    const tx = o.imageLeft ? ctx.pad + imgW + 72 : ctx.pad;
    image(ctx, ix, top, imgW, imgH, slotId);
    const end = o.writeText(tx, top + 8, textW);
    return Math.max(end, top + imgH);
  }
  const end = o.writeText(ctx.pad, top, ctx.cw);
  image(ctx, ctx.pad, end + 28, imgW, imgH, slotId);
  return end + 28 + imgH;
}

function infoRows(ctx: Ctx, x: number, y: number, w: number, rows: [string, string | null][]): number {
  const { s } = ctx;
  for (const [k, v] of rows) {
    ctx.out.push(text(x, y + 10, k, { size: s.small, weight: 700, fill: C.muted }));
    if (v) {
      const ls = wrap(v, s.body, w, 2);
      ctx.out.push(para(x, y + 24, ls, { size: s.body, lh: s.body + 8, fill: C.ink }));
      y += 24 + ls.length * (s.body + 8) + 18;
    } else {
      ctx.out.push(text(x, y + 36, "알려 주시면 채워 드려요", { size: s.small, fill: C.faint }));
      y += 66;
    }
  }
  return y;
}

function formField(ctx: Ctx, x: number, y: number, w: number, label: string, placeholder: string, h = 50): number {
  ctx.out.push(text(x, y + 9, label, { size: 14, weight: 700, fill: C.body }));
  ctx.out.push(box(x, y + 24, w, h, C.card, { rx: RAD.input, stroke: C.stroke }));
  ctx.out.push(text(x + 16, y + 24 + (h > 60 ? 24 : h / 2), fit(placeholder, 14, w - 32), { size: 14, fill: C.faint }));
  return y + 24 + h + 20;
}

/** 폼 아래 넓은 메인 버튼 */
function formButton(ctx: Ctx, x: number, y: number, w: number, label: string, key: string): void {
  const outline = BTN === "outline";
  ctx.out.push(
    box(x, y, w, 54, outline ? "none" : ctx.primary, { rx: buttonRadius(54), stroke: outline ? ctx.primaryText : undefined, sw: outline ? 1.5 : undefined }) +
      text(x + w / 2, y + 27, label, { size: 16, weight: 700, fill: outline ? ctx.primaryText : ctx.onPrimary, anchor: "middle" }),
  );
  ctx.fields.push({ key, x: r(x), y: r(y), w: r(w), h: 54, text: label });
}

// ---------------------------------------------------------------------------------------------
// 관리자 목록
// ---------------------------------------------------------------------------------------------

/** 목록 페이지 종류: 원래 그리던 빈 목록 대신 관리자 목록을 그린다. 나머지 종류는 본문 아래에 목록을 붙인다 */
const LIST_REPLACES = new Set<PageKind>(["notice", "blog", "faq"]);

/** 칸 값을 한 줄로 (긴 글은 첫 줄만) */
function cell(c: Collection, row: CollectionRow, idx: number): string {
  const f = c.fields[idx];
  return f ? formatCell(f.type, row[f.key]).split("\n")[0] : "";
}

/** 게시판형: 제목 줄 + 늘 같은 수의 줄 (글이 없으면 회색 막대) */
function listBoard(ctx: Ctx, top: number, c: Collection, rows: CollectionRow[] | null): number {
  const rowH = ctx.mob ? 60 : 64;
  const extra = c.fields.slice(1).findIndex((f) => f.type !== "longtext" && f.type !== "image");
  const metaIdx = extra >= 0 ? extra + 1 : -1;
  ctx.out.push(box(ctx.pad, top, ctx.cw, 52, C.soft2, { rx: Math.min(8, RAD.card) }));
  const titleX = ctx.mob ? ctx.cw * 0.04 : ctx.cw * 0.16;
  ctx.out.push(text(ctx.pad + titleX, top + 26, fit(c.fields[0].label, 14, ctx.cw * 0.5, true), { size: 14, weight: 700, fill: C.muted }));
  if (!ctx.mob) {
    ctx.out.push(text(ctx.pad + ctx.cw * 0.04, top + 26, "번호", { size: 14, weight: 700, fill: C.muted }));
    ctx.out.push(text(ctx.pad + ctx.cw * 0.8, top + 26, metaIdx > 0 ? fit(c.fields[metaIdx].label, 14, ctx.cw * 0.18, true) : "올린 날", { size: 14, weight: 700, fill: C.muted }));
  }
  let yy = top + 52;
  for (let i = 0; i < SITE_DB_DRAFT_ROWS.list; i++) {
    const row = rows?.[i];
    if (row) {
      const title = cell(c, row, 0);
      const meta = metaIdx > 0 ? cell(c, row, metaIdx) : formatCell("date", row.created_at);
      if (ctx.mob) {
        ctx.out.push(text(ctx.pad + 10, yy + 22, fit(title, 15, ctx.cw - 20, true), { size: 15, weight: 600, fill: C.ink }));
        ctx.out.push(text(ctx.pad + 10, yy + 44, fit(meta, 12, ctx.cw - 20), { size: 12, fill: C.muted }));
      } else {
        ctx.out.push(text(ctx.pad + ctx.cw * 0.04, yy + 32, String(i + 1), { size: 14, fill: C.muted }));
        ctx.out.push(text(ctx.pad + titleX, yy + 32, fit(title, 16, ctx.cw * 0.6, true), { size: 16, weight: 600, fill: C.ink }));
        ctx.out.push(text(ctx.pad + ctx.cw * 0.8, yy + 32, fit(meta, 14, ctx.cw * 0.18), { size: 14, fill: C.muted }));
      }
    } else if (ctx.mob) {
      ctx.out.push(box(ctx.pad + 10, yy + 16, ctx.cw * (i % 2 ? 0.7 : 0.85), 12, C.bar, { rx: 3 }) + box(ctx.pad + 10, yy + 38, 70, 9, C.bar, { rx: 3 }));
    } else {
      ctx.out.push(box(ctx.pad + ctx.cw * 0.04, yy + 26, 20, 11, C.bar, { rx: 3 }));
      ctx.out.push(box(ctx.pad + titleX, yy + 26, ctx.cw * (i % 2 ? 0.42 : 0.55), 12, C.bar, { rx: 3 }));
      ctx.out.push(box(ctx.pad + ctx.cw * 0.8, yy + 26, 90, 11, C.bar, { rx: 3 }));
    }
    yy += rowH;
    ctx.out.push(hline(ctx.pad, ctx.pad + ctx.cw, yy));
  }
  return yy;
}

/** 카드형: 사진 자리 + 제목 + 한 줄 (사진은 그림에 넣지 않고 자리만 보여 준다) */
function listCards(ctx: Ctx, top: number, c: Collection, rows: CollectionRow[] | null): number {
  const n = SITE_DB_DRAFT_ROWS.cards;
  const cols = ctx.mob ? 1 : ctx.desk ? 3 : 2;
  const gap = ctx.s.gap;
  const w = colWidth(ctx, cols, gap);
  const ih = Math.round(w * 0.62);
  const h = ih + 104;
  const subIdx = c.fields.findIndex((f, i) => i > 0 && f.type !== "image" && f.type !== "boolean");
  for (let i = 0; i < n; i++) {
    const x = ctx.pad + (i % cols) * (w + gap);
    const cy = top + Math.floor(i / cols) * (h + gap);
    const row = rows?.[i];
    ctx.out.push(card(ctx, x, cy, w, h));
    ctx.out.push(box(x, cy, w, ih, C.soft2, { rx: RAD.card }) + pictureIcon(x + w / 2, cy + ih / 2, ctx.mob ? 30 : 38, C.faint));
    if (row) {
      ctx.out.push(text(x + 20, cy + ih + 32, fit(cell(c, row, 0), 17, w - 40, true), { size: 17, weight: 700, fill: C.ink, h: true }));
      if (subIdx > 0) ctx.out.push(text(x + 20, cy + ih + 62, fit(cell(c, row, subIdx), 14, w - 40), { size: 14, fill: C.muted }));
    } else {
      ctx.out.push(box(x + 20, cy + ih + 24, w * 0.55, 15, C.bar, { rx: 3 }) + box(x + 20, cy + ih + 56, w * 0.75, 10, C.bar, { rx: 3 }));
    }
  }
  return top + Math.ceil(n / cols) * (h + gap) - gap;
}

/** 관리자 목록 구역. withHeading = 다른 본문 아래에 붙일 때 (목록 페이지면 페이지 제목 띠가 이미 이름을 보여 준다) */
function collectionList(ctx: Ctx, y: number, c: Collection, withHeading: boolean): number {
  const rows = ctx.in.rows?.[c.key] ?? null;
  return section(
    ctx,
    y,
    C.bg,
    (top) => {
      const start = withHeading ? heading(ctx, ctx.pad, top, c.label, null) : top;
      const end = c.layout === "cards" ? listCards(ctx, start, c, rows) : listBoard(ctx, start, c, rows);
      return note(ctx, ctx.pad, end + 24, ctx.cw, "관리자 페이지에서 올린 글이 이 목록에 보여요");
    },
    "list",
  );
}

// ---------------------------------------------------------------------------------------------
// 페이지 종류별 구성
// ---------------------------------------------------------------------------------------------

type Compose = (ctx: Ctx, y: number) => number;

const PAGE: Record<PageKind, Compose> = {
  home: (ctx, y) => {
    y = hero(ctx, y);
    y = offeringGrid(ctx, y, {
      bg: C.bg,
      title: cp(ctx, "offerings.title", ctx.offerMenu),
      sub: cp(ctx, "offerings.subtitle", `${josa(ctx.in.siteName, "이/가")} 준비한 ${ctx.offerMenu}`),
      max: 6,
      mobileCols: 1,
      aspect: ctx.mob ? 0.62 : 0.72,
      keys: { title: "offerings.title", sub: "offerings.subtitle" },
    });
    y = strengths(ctx, y);
    y = aboutTeaser(ctx, y);
    y = reviewCards(ctx, y, 3, true);
    return ctaBand(ctx, y);
  },

  about: (ctx, y) => {
    const b = ctx.in.business;
    y = section(ctx, y, C.bg, (top) =>
      textImage(ctx, top, "about", {
        aspect: 0.75,
        writeText: (x, ty, w) => {
          const tl = wrap(cp(ctx, "about.title", b.tagline.trim() || `${ctx.in.siteName} 이야기`), ctx.s.h2, w, 3, true);
          ctx.out.push(para(x, ty, tl, { size: ctx.s.h2, lh: ctx.s.h2 + 12, weight: HW, h: true }));
          field(ctx, "about.title", x, ty, tl, { size: ctx.s.h2, lh: ctx.s.h2 + 12, bold: true });
          ty += tl.length * (ctx.s.h2 + 12) + 20;
          const body = cp(ctx, "about.body", b.about.trim());
          if (body) {
            const ls = wrap(body, ctx.s.body, w, 9);
            ctx.out.push(para(x, ty, ls, { size: ctx.s.body, lh: ctx.s.body + 12, fill: C.body }));
            field(ctx, "about.body", x, ty, ls, { size: ctx.s.body, lh: ctx.s.body + 12 });
            return ty + ls.length * (ctx.s.body + 12);
          }
          const bb = bars(x, ty + 6, w, 5, 26, 11);
          ctx.out.push(bb.svg);
          ctx.fields.push({ key: "about.body", x: r(x), y: r(ty + 2), w: r(w), h: r(bb.h + 8), text: "" });
          return note(ctx, x, ty + bb.h + 30, w, "회사 소개 글을 보내 주시면 이 자리에 넣어 드려요");
        },
      }),
    );
    y = strengths(ctx, y);
    return ctaBand(ctx, y);
  },

  greeting: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const write = (x: number, ty: number, w: number) => {
        ctx.out.push(text(x, ty + ctx.s.h2 / 2, "안녕하십니까,", { size: ctx.s.h2, weight: HW, h: true }));
        ty += ctx.s.h2 + 18;
        const l2 = wrap(`${josa(ctx.in.siteName, "을/를")} 찾아 주셔서 진심으로 감사드립니다.`, ctx.s.h3, w, 2, true);
        ctx.out.push(para(x, ty, l2, { size: ctx.s.h3, lh: ctx.s.h3 + 10, weight: 600, fill: C.body }));
        ty += l2.length * (ctx.s.h3 + 10) + 24;
        const bb = bars(x, ty, w, 7, 26, 11);
        ctx.out.push(bb.svg);
        ty += bb.h + 28;
        ctx.out.push(text(x, ty + 10, "대표", { size: ctx.s.small, weight: 700, fill: C.muted }));
        ctx.out.push(box(x + 40, ty + 4, 90, 13, C.bar, { rx: 3 }));
        return note(ctx, x, ty + 40, w, "대표 인사말과 이름을 보내 주시면 이 자리에 넣어 드려요");
      };
      if (ctx.desk) {
        image(ctx, ctx.pad, top, 380, 475, "greeting");
        return Math.max(write(ctx.pad + 380 + 80, top + 10, ctx.cw - 380 - 80), top + 475);
      }
      const w = Math.min(ctx.cw, 300);
      image(ctx, ctx.pad + (ctx.cw - w) / 2, top, w, Math.round(w * 1.25), "greeting");
      return write(ctx.pad, top + Math.round(w * 1.25) + 36, ctx.cw);
    }),

  history: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const lineX = ctx.pad + (ctx.mob ? 70 : 140);
      const step = ctx.mob ? 78 : 92;
      ctx.out.push(`<line x1="${lineX}" y1="${top}" x2="${lineX}" y2="${top + step * 5 - 30}" stroke="${C.line}" stroke-width="2"/>`);
      for (let i = 0; i < 5; i++) {
        const iy = top + i * step;
        ctx.out.push(box(ctx.pad, iy + 4, ctx.mob ? 48 : 88, 14, i === 0 ? ctx.tint2 : C.bar, { rx: 3 }));
        ctx.out.push(`<circle cx="${lineX}" cy="${iy + 11}" r="7" fill="${i === 0 ? ctx.primary : C.bg}" stroke="${ctx.primary}" stroke-width="2"/>`);
        ctx.out.push(bars(lineX + 28, iy + 4, Math.min(560, ctx.W - lineX - 28 - ctx.pad), 2, 22, 11).svg);
      }
      return note(ctx, ctx.pad, top + step * 5, ctx.cw, "주요 연혁(연도와 내용)을 알려 주시면 채워 드려요");
    }),

  location: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const light = ctx.t.mode === "light";
      const mapBg = light ? "#e8eef5" : C.soft2;
      const road = light ? "#ffffff" : C.soft;
      const mh = ctx.desk ? 420 : ctx.mob ? 240 : 340;
      // 지도 자리 (이미지가 아니라 지도 서비스를 붙이는 자리)
      let svg = box(ctx.pad, top, ctx.cw, mh, mapBg, { rx: RAD.card });
      for (let gx = 60; gx < ctx.cw; gx += 90) svg += `<line x1="${ctx.pad + gx}" y1="${top}" x2="${ctx.pad + gx - 40}" y2="${top + mh}" stroke="${light ? "#dbe3ee" : C.line}" stroke-width="2"/>`;
      svg += box(ctx.pad, top + mh * 0.55, ctx.cw, 14, road);
      svg += box(ctx.pad + ctx.cw * 0.62, top, 14, mh, road);
      const px = ctx.pad + ctx.cw / 2;
      const py = top + mh / 2 - 10;
      svg += `<path d="M${px},${py + 26} C${px - 6},${py + 12} ${px - 18},${py + 4} ${px - 18},${py - 8} A18,18 0 1 1 ${px + 18},${py - 8} C${px + 18},${py + 4} ${px + 6},${py + 12} ${px},${py + 26}Z" fill="${ctx.primary}"/>`;
      svg += `<circle cx="${px}" cy="${py - 8}" r="6" fill="#ffffff"/>`;
      const tag = fit(ctx.in.siteName, 14, ctx.cw - 40, true);
      const tw = measure(tag, 14, true) + 24;
      svg += box(px - tw / 2, py + 34, tw, 30, C.card, { rx: 15 }) + text(px, py + 49, tag, { size: 14, weight: 700, anchor: "middle" });
      ctx.out.push(svg);
      const lbl = "지도 — 네이버·카카오 지도를 연결해요";
      const lw = measure(lbl, 12, true) + 20;
      ctx.out.push(box(ctx.pad + 16, top + 16, lw, 26, C.card, { rx: 13 }) + text(ctx.pad + 26, top + 29, lbl, { size: 12, weight: 700, fill: C.muted }));

      const c = ctx.in.business.contact;
      const rows: [string, string | null][] = [
        ["주소", c.address.trim() || null],
        ["전화", c.phone.trim() || null],
        ["운영 시간", c.hours.trim() || null],
      ];
      return textImage(ctx, top + mh + (ctx.mob ? 32 : 56), "exterior", {
        aspect: 0.75,
        writeText: (x, ty, w) => {
          ctx.out.push(text(x, ty + ctx.s.h3 / 2, "오시는 길", { size: ctx.s.h3 + 3, weight: HW, h: true }));
          return infoRows(ctx, x, ty + ctx.s.h3 + 26, w, rows);
        },
      });
    }),

  services: (ctx, y) => {
    const offerings = ctx.in.business.offerings.slice(0, 8);
    y = section(ctx, y, C.bg, (top) => {
      let yy = top;
      offerings.forEach((o, i) => {
        if (i > 0) yy += ctx.mob ? 48 : 80;
        yy = textImage(ctx, yy, `offering:${i}`, {
          imageLeft: i % 2 === 0,
          aspect: ctx.desk ? 0.75 : 0.6,
          writeText: (x, ty, w) => {
            ctx.out.push(text(x, ty + 10, String(i + 1).padStart(2, "0"), { size: 15, weight: 800, fill: ctx.primaryText }));
            ty += 32;
            const nl = wrap(o.name, ctx.s.h2 - 4, w, 2, true);
            ctx.out.push(para(x, ty, nl, { size: ctx.s.h2 - 4, lh: ctx.s.h2 + 6, weight: HW, h: true }));
            ty += nl.length * (ctx.s.h2 + 6) + 14;
            const key = `offering.${i}.description`;
            const desc = cp(ctx, key, o.description.trim());
            if (desc) {
              const dl = wrap(desc, ctx.s.body, w, 4);
              ctx.out.push(para(x, ty, dl, { size: ctx.s.body, lh: ctx.s.body + 11, fill: C.body }));
              field(ctx, key, x, ty, dl, { size: ctx.s.body, lh: ctx.s.body + 11 });
              ty += dl.length * (ctx.s.body + 11) + 16;
            }
            const bb = bars(x, ty, w * 0.9, 3, 22, 10);
            ctx.out.push(bb.svg);
            ty += bb.h + 28;
            ctx.out.push(text(x, ty, "자세히 보기 →", { size: 15, weight: 700, fill: ctx.primaryText }));
            return ty + 12;
          },
        });
      });
      return yy;
    });
    return ctaBand(ctx, y);
  },

  service: (ctx, y) => {
    const p = ctx.in.page;
    const o = p.offering !== null ? ctx.in.business.offerings[p.offering] : null;
    const slotId = p.slotIds[0] ?? `page:${p.path}`;
    y = section(ctx, y, C.bg, (top) =>
      textImage(ctx, top, slotId, {
        imageLeft: true,
        imgW: 600,
        aspect: 0.72,
        writeText: (x, ty, w) => {
          const nl = wrap(o?.name ?? p.label, ctx.s.h2, w, 2, true);
          ctx.out.push(para(x, ty, nl, { size: ctx.s.h2, lh: ctx.s.h2 + 10, weight: HW, h: true }));
          ty += nl.length * (ctx.s.h2 + 10) + 14;
          const key = p.offering !== null ? `offering.${p.offering}.description` : undefined;
          const desc = key ? cp(ctx, key, o?.description.trim() ?? "") : "";
          if (desc) {
            const dl = wrap(desc, ctx.s.body, w, 4);
            ctx.out.push(para(x, ty, dl, { size: ctx.s.body, lh: ctx.s.body + 11, fill: C.body }));
            field(ctx, key, x, ty, dl, { size: ctx.s.body, lh: ctx.s.body + 11 });
            ty += dl.length * (ctx.s.body + 11) + 24;
          }
          ctx.out.push(text(x, ty + 10, "이런 분께 추천해요", { size: ctx.s.h3, weight: 700, h: true }));
          ty += 40;
          for (let i = 0; i < 3; i++) {
            ctx.out.push(`<circle cx="${r(x + 9)}" cy="${r(ty + 9)}" r="9" fill="${ctx.tint2}"/>` + chevron(x + 5, ty + 8, ctx.primaryText));
            ctx.out.push(box(x + 30, ty + 3, (w - 30) * (i === 2 ? 0.55 : 0.8), 11, C.bar, { rx: 3 }));
            ty += 34;
          }
          return note(ctx, x, ty + 10, w, "서비스의 특징·진행 방식·가격을 알려 주시면 채워 드려요");
        },
      }),
    );
    return ctaBand(ctx, y);
  },

  products: (ctx, y) => {
    y = offeringGrid(ctx, y, { bg: C.bg, title: null, sub: null, max: 8, mobileCols: 2, aspect: 0.8 });
    return ctaBand(ctx, y);
  },

  portfolio: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const id = ctx.in.page.slotIds[0] ?? `gallery:${ctx.in.page.path}`;
      const cols = ctx.mob ? 2 : 3;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      for (let i = 0; i < 6; i++) image(ctx, ctx.pad + (i % cols) * (w + gap), top + Math.floor(i / cols) * (w + gap), w, w, id, i);
      return top + Math.ceil(6 / cols) * (w + gap) - gap;
    }),

  reviews: (ctx, y) => reviewCards(ctx, y, 6, false),

  team: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const id = ctx.in.page.slotIds[0] ?? `team:${ctx.in.page.path}`;
      const cols = ctx.desk ? 4 : 2;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const ph = Math.round(w * 1.25);
      const itemH = ph + 70;
      for (let i = 0; i < 4; i++) {
        const x = ctx.pad + (i % cols) * (w + gap);
        const iy = top + Math.floor(i / cols) * (itemH + gap);
        image(ctx, x, iy, w, ph, id, i);
        ctx.out.push(box(x, iy + ph + 20, w * 0.45, 14, C.bar, { rx: 3 }) + box(x, iy + ph + 44, w * 0.65, 10, C.bar, { rx: 3 }));
      }
      const end = top + Math.ceil(4 / cols) * (itemH + gap) - gap;
      return note(ctx, ctx.pad, end + 20, ctx.cw, "구성원 이름과 역할을 알려 주시면 채워 드려요");
    }),

  notice: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const rowH = ctx.mob ? 60 : 64;
      ctx.out.push(box(ctx.pad, top, ctx.cw, 52, C.soft2, { rx: Math.min(8, RAD.card) }));
      const cols: [string, number][] = ctx.mob ? [["제목", 0.04]] : [["번호", 0.04], ["제목", 0.16], ["작성일", 0.84]];
      for (const [k, at] of cols) ctx.out.push(text(ctx.pad + ctx.cw * at, top + 26, k, { size: 14, weight: 700, fill: C.muted }));
      let yy = top + 52;
      for (let i = 0; i < 5; i++) {
        if (ctx.mob) {
          ctx.out.push(box(ctx.pad + 10, yy + 16, ctx.cw * (i % 2 ? 0.7 : 0.85), 12, C.bar, { rx: 3 }) + box(ctx.pad + 10, yy + 38, 70, 9, C.bar, { rx: 3 }));
        } else {
          ctx.out.push(box(ctx.pad + ctx.cw * 0.04, yy + 26, 20, 11, C.bar, { rx: 3 }));
          ctx.out.push(box(ctx.pad + ctx.cw * 0.16, yy + 26, ctx.cw * (i % 2 ? 0.42 : 0.55), 12, C.bar, { rx: 3 }));
          ctx.out.push(box(ctx.pad + ctx.cw * 0.84, yy + 26, 90, 11, C.bar, { rx: 3 }));
        }
        yy += rowH;
        ctx.out.push(hline(ctx.pad, ctx.pad + ctx.cw, yy));
      }
      return note(ctx, ctx.pad, yy + 24, ctx.cw, "공지 글이 올라오면 이 목록에 보여요");
    }),

  faq: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      let yy = top;
      for (let i = 0; i < 5; i++) {
        const open = i === 0;
        const h = open ? 150 : 72;
        ctx.out.push(`<circle cx="${r(ctx.pad + 18)}" cy="${r(yy + 36)}" r="16" fill="${ctx.tint2}"/>` + text(ctx.pad + 18, yy + 36, "Q", { size: 14, weight: 800, fill: ctx.primaryText, anchor: "middle" }));
        ctx.out.push(box(ctx.pad + 52, yy + 30, ctx.cw * (i % 2 ? 0.45 : 0.6), 12, C.bar, { rx: 3 }));
        ctx.out.push(chevron(ctx.pad + ctx.cw - 20, yy + 36, C.faint));
        if (open) ctx.out.push(box(ctx.pad + 52, yy + 72, ctx.cw - 72, 62, C.soft, { rx: Math.min(8, RAD.card) }) + bars(ctx.pad + 70, yy + 88, ctx.cw - 120, 2, 22, 10).svg);
        yy += h;
        ctx.out.push(hline(ctx.pad, ctx.pad + ctx.cw, yy));
      }
      return note(ctx, ctx.pad, yy + 24, ctx.cw, "자주 받는 질문과 답을 알려 주시면 채워 드려요");
    }),

  contact: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const formW = ctx.desk ? ctx.cw * 0.58 : ctx.cw;
      let fy = top;
      fy = formField(ctx, ctx.pad, fy, formW, "이름 *", "이름을 입력하세요");
      fy = formField(ctx, ctx.pad, fy, formW, "연락처 *", "010-0000-0000");
      fy = formField(ctx, ctx.pad, fy, formW, "이메일", "example@email.com");
      fy = formField(ctx, ctx.pad, fy, formW, "문의 내용 *", "궁금한 점을 자유롭게 적어 주세요", 150);
      ctx.out.push(box(ctx.pad, fy, 18, 18, C.card, { rx: 4, stroke: C.stroke }) + text(ctx.pad + 28, fy + 9, "개인정보 수집·이용에 동의합니다", { size: 14, fill: C.body }));
      fy += 42;
      formButton(ctx, ctx.pad, fy, formW, cp(ctx, "contact.button", "문의 보내기"), "contact.button");
      fy += 54;
      const cardX = ctx.desk ? ctx.pad + formW + 56 : ctx.pad;
      const cardW = ctx.desk ? ctx.cw - formW - 56 : ctx.cw;
      const cardY = ctx.desk ? top : fy + 40;
      const mark = ctx.out.length;
      ctx.out.push(text(cardX + 28, cardY + 40, "연락처", { size: ctx.s.h3, weight: HW, h: true }));
      const c = ctx.in.business.contact;
      const end = infoRows(ctx, cardX + 28, cardY + 72, cardW - 56, [
        ["전화", c.phone.trim() || null],
        ["이메일", c.email.trim() || null],
        ["운영 시간", c.hours.trim() || null],
      ]);
      ctx.out.splice(mark, 0, box(cardX, cardY, cardW, end - cardY + 10, C.soft, { rx: RAD.card + 2 }));
      return Math.max(fy, end + 10);
    }),

  reservation: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const formW = ctx.desk ? ctx.cw * 0.58 : ctx.cw;
      let fy = top;
      if (ctx.mob) {
        fy = formField(ctx, ctx.pad, fy, formW, "예약 날짜 *", "날짜를 고르세요");
        fy = formField(ctx, ctx.pad, fy, formW, "시간 *", "시간을 고르세요");
      } else {
        const half = (formW - 16) / 2;
        formField(ctx, ctx.pad, fy, half, "예약 날짜 *", "날짜를 고르세요");
        fy = formField(ctx, ctx.pad + half + 16, fy, half, "시간 *", "시간을 고르세요");
      }
      fy = formField(ctx, ctx.pad, fy, formW, "인원", "인원을 입력하세요");
      fy = formField(ctx, ctx.pad, fy, formW, "이름 *", "이름을 입력하세요");
      fy = formField(ctx, ctx.pad, fy, formW, "연락처 *", "010-0000-0000");
      fy = formField(ctx, ctx.pad, fy, formW, "요청 사항", "남기실 말씀이 있으면 적어 주세요", 110);
      formButton(ctx, ctx.pad, fy, formW, cp(ctx, "reservation.button", "예약하기"), "reservation.button");
      fy += 54;
      const cardX = ctx.desk ? ctx.pad + formW + 56 : ctx.pad;
      const cardW = ctx.desk ? ctx.cw - formW - 56 : ctx.cw;
      const cardY = ctx.desk ? top : fy + 40;
      const mark = ctx.out.length;
      ctx.out.push(text(cardX + 28, cardY + 40, "예약 안내", { size: ctx.s.h3, weight: HW, h: true }));
      const c = ctx.in.business.contact;
      let end = infoRows(ctx, cardX + 28, cardY + 72, cardW - 56, [
        ["운영 시간", c.hours.trim() || null],
        ["전화", c.phone.trim() || null],
      ]);
      end = note(ctx, cardX + 28, end, cardW - 56, "예약 규칙(취소·변경·예약금)을 알려 주시면 채워 드려요");
      ctx.out.splice(mark, 0, box(cardX, cardY, cardW, end - cardY + 28, C.soft, { rx: RAD.card + 2 }));
      return Math.max(fy, end + 28);
    }),

  pricing: (ctx, y) => {
    y = section(ctx, y, C.soft, (top) => {
      const cols = ctx.mob ? 1 : 3;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const h = 380;
      for (let i = 0; i < 3; i++) {
        const x = ctx.pad + (i % cols) * (w + gap);
        const cy = top + Math.floor(i / cols) * (h + gap);
        const hot = i === 1;
        ctx.out.push(box(x, cy, w, h, C.card, { rx: RAD.card + 2, stroke: hot ? ctx.primary : C.line, sw: hot ? 2 : 1 }));
        ctx.out.push(box(x + 28, cy + 32, w * 0.4, 14, C.bar, { rx: 3 }));
        ctx.out.push(box(x + 28, cy + 66, w * 0.55, 30, hot ? ctx.tint2 : C.bar, { rx: 4 }));
        for (let j = 0; j < 4; j++) ctx.out.push(chevron(x + 30, cy + 140 + j * 34, ctx.primaryText) + box(x + 50, cy + 134 + j * 34, (w - 80) * (j % 2 ? 0.6 : 0.8), 10, C.bar, { rx: 3 }));
        ctx.out.push(box(x + 28, cy + h - 76, w - 56, 48, hot ? ctx.primary : C.card, { rx: buttonRadius(48), stroke: hot ? undefined : C.stroke }));
        ctx.out.push(text(x + w / 2, cy + h - 52, "선택하기", { size: 15, weight: 700, fill: hot ? ctx.onPrimary : C.ink, anchor: "middle" }));
      }
      const end = top + Math.ceil(3 / cols) * (h + gap) - gap;
      return note(ctx, ctx.pad, end + 24, ctx.cw, "요금표(상품 이름·가격·포함 내용)를 알려 주시면 채워 드려요");
    });
    return ctaBand(ctx, y);
  },

  cases: (ctx, y) => {
    y = section(ctx, y, C.bg, (top) => {
      const id = ctx.in.page.slotIds[0] ?? `cases:${ctx.in.page.path}`;
      const cols = ctx.mob ? 1 : ctx.desk ? 3 : 2;
      const gap = ctx.s.gap;
      const w = colWidth(ctx, cols, gap);
      const ih = Math.round(w * 0.72);
      const h = ih + 110;
      for (let i = 0; i < 3; i++) {
        const x = ctx.pad + (i % cols) * (w + gap);
        const cy = top + Math.floor(i / cols) * (h + gap);
        image(ctx, x, cy, w, ih, id, i);
        ctx.out.push(box(x, cy + ih + 24, w * 0.6, 15, C.bar, { rx: 3 }) + bars(x, cy + ih + 54, w, 2, 20, 10).svg);
      }
      const end = top + Math.ceil(3 / cols) * (h + gap) - gap;
      return note(ctx, ctx.pad, end + 16, ctx.cw, "고객 사례(어떤 고객 · 무엇을 · 어떤 결과)를 알려 주시면 채워 드려요");
    });
    return ctaBand(ctx, y);
  },

  blog: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      let yy = top;
      for (let i = 0; i < 3; i++) {
        ctx.out.push(box(ctx.pad, yy, ctx.cw * (i % 2 ? 0.5 : 0.65), 18, C.bar, { rx: 4 }));
        ctx.out.push(box(ctx.pad, yy + 32, 90, 10, C.bar, { rx: 3 }));
        ctx.out.push(bars(ctx.pad, yy + 60, ctx.cw, 2, 22, 10).svg);
        yy += 118;
        ctx.out.push(hline(ctx.pad, ctx.pad + ctx.cw, yy - 24));
      }
      return note(ctx, ctx.pad, yy, ctx.cw, "첫 글이 올라오면 이 목록에 보여요");
    }),

  careers: (ctx, y) => {
    y = section(ctx, y, C.bg, (top) => {
      const id = ctx.in.page.slotIds[0] ?? `careers:${ctx.in.page.path}`;
      const ih = ctx.desk ? 460 : Math.round(ctx.cw * 0.56);
      image(ctx, ctx.pad, top, ctx.cw, ih, id);
      const yy = heading(ctx, ctx.pad, top + ih + 48, cp(ctx, "careers.title", "함께 일해요"), cp(ctx, "careers.subtitle", `${josa(ctx.in.siteName, "와/과")} 함께 성장할 동료를 찾습니다`), {
        keys: { title: "careers.title", sub: "careers.subtitle" },
      });
      return yy - 20;
    });
    return section(ctx, y, C.soft, (top) => {
      let yy = heading(ctx, ctx.pad, top, "채용 중인 자리", null);
      for (let i = 0; i < 3; i++) {
        ctx.out.push(card(ctx, ctx.pad, yy, ctx.cw, 88));
        ctx.out.push(box(ctx.pad + 24, yy + 26, ctx.cw * 0.35, 14, C.bar, { rx: 3 }) + box(ctx.pad + 24, yy + 52, ctx.cw * 0.2, 10, C.bar, { rx: 3 }));
        if (!ctx.mob) ctx.out.push(secondaryButton(ctx.pad + ctx.cw - 140, yy + 22, "지원하기", { size: 14, h: 44 }).svg);
        yy += 88 + 14;
      }
      return note(ctx, ctx.pad, yy + 10, ctx.cw, "채용 공고(직무 · 조건 · 지원 방법)를 알려 주시면 채워 드려요");
    });
  },

  generic: (ctx, y) =>
    section(ctx, y, C.bg, (top) => {
      const p = ctx.in.page;
      let yy = top;
      if (p.note.trim()) {
        const ls = wrap(p.note, ctx.s.body, Math.min(ctx.cw, 860), 8);
        ctx.out.push(para(ctx.pad, yy, ls, { size: ctx.s.body, lh: ctx.s.body + 12, fill: C.body }));
        yy += ls.length * (ctx.s.body + 12);
      } else {
        const bb = bars(ctx.pad, yy + 4, Math.min(ctx.cw, 860), 5, 26, 11);
        ctx.out.push(bb.svg);
        yy = note(ctx, ctx.pad, yy + bb.h + 28, Math.min(ctx.cw, 860), "이 페이지에 넣을 내용을 알려 주시면 채워 드려요");
      }
      const id = p.slotIds[0] ?? `page:${p.path}`;
      const ih = ctx.desk ? 520 : Math.round(ctx.cw * 0.56);
      image(ctx, ctx.pad, yy + 40, ctx.cw, ih, id);
      return yy + 40 + ih;
    }),
};

// ---------------------------------------------------------------------------------------------
// 진입점
// ---------------------------------------------------------------------------------------------

/**
 * 페이지 하나 × 화면 하나의 초안. forceHeight 를 주면 그 높이로 그린다 — 저장된 캡처 크기와 맞춰
 * 그림이 늘어나거나 줄지 않게 하려고 (그리는 규칙이 바뀌어도 이미 보낸 요청의 네모 위치가 크게 어긋나지 않는다).
 * 디자인이 바뀌면 저장하는 쪽(lib/ai/apply.ts)이 forceHeight 없이 다시 그려 새 크기를 저장한다.
 */
export function renderDraft(input: DraftInput, forceHeight?: number): DraftResult {
  const doc = input.design ?? rulesDesign({ styleTags: [], primaryColor: input.primaryColor, now: "1970-01-01T00:00:00.000Z" });
  const t = doc.theme;
  const p = paletteOf(t);
  const base = SIZES[input.device];
  const dens = DENSITY[t.density];
  const scale = t.headingScale;
  const s: Sizes = {
    ...base,
    h1: Math.round(base.h1 * scale),
    h2: Math.round(base.h2 * scale),
    h3: Math.round(base.h3 * Math.min(scale, 1.12)),
    sec: Math.round(base.sec * dens.sec),
    gap: Math.round(base.gap * dens.gap),
  };
  const W = DRAFT_WIDTH[input.device];
  const ind = industryOf(input.business.category);

  const prev = { C, FONT_BODY, FONT_HEAD, HW, RAD, BTN };
  C = colorsOf(p);
  FONT_BODY = FONT_STACK[t.bodyFont];
  FONT_HEAD = FONT_STACK[t.headingFont];
  HW = t.headingWeight;
  RAD = { ...RADIUS[t.radius] };
  BTN = t.buttonStyle;
  try {
    const ctx: Ctx = {
      in: input,
      doc,
      t,
      p,
      W,
      dev: input.device,
      mob: input.device === "mobile",
      desk: input.device === "desktop",
      s,
      pad: s.pad,
      cw: W - s.pad * 2,
      primary: p.primary,
      onPrimary: p.onPrimary,
      primaryText: p.primaryText,
      tint: p.tint,
      tint2: p.tint2,
      cta: copyOf(doc, input.page.path, "site.cta") ?? ctaLabel(input.business.category, input.business.purposes),
      menu: headerMenu(input.plan.pages),
      offerMenu: ind.offeringMenu,
      images: new Map(input.plan.images.map((i) => [i.id, i])),
      out: [],
      slots: [],
      fields: [],
      sections: [],
      pendingList: null,
    };

    let y = header(ctx, 0);
    if (input.page.kind !== "home") {
      y = titleBand(ctx, y);
      y = subNav(ctx, y);
    }
    const listed = (doc.collections ?? []).find((c) => c.page === input.page.path);
    if (listed && LIST_REPLACES.has(input.page.kind)) y = collectionList(ctx, y, listed, false);
    else {
      // 본문 뒤에 붙인다. 아래 행동 유도 띠가 있으면 띠 앞에 그려진다 (ctaBand)
      ctx.pendingList = listed ?? null;
      y = PAGE[input.page.kind](ctx, y);
      if (ctx.pendingList) y = collectionList(ctx, y, ctx.pendingList, true);
    }
    y = footer(ctx, y);

    const height = Math.max(200, Math.round(forceHeight ?? y));
    const shadow =
      t.cardStyle === "shadow"
        ? `<defs><filter id="pf-shadow" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="${t.mode === "dark" ? "#000000" : "#0f172a"}" flood-opacity="${t.mode === "dark" ? 0.45 : 0.09}"/></filter></defs>`
        : "";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="${FONT_BODY}">` +
      shadow +
      `<rect width="${W}" height="${height}" fill="${C.bg}"/>` +
      ctx.out.join("") +
      `</svg>`;
    return { width: W, height, svg, slots: ctx.slots, fields: ctx.fields, sections: ctx.sections };
  } finally {
    ({ C, FONT_BODY, FONT_HEAD, HW, RAD, BTN } = prev);
  }
}
