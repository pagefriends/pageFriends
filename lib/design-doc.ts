import { STYLE_BY_ID, mergeStyles, normalizeStyles, type StyleId, type StyleMerge } from "@/config/design-styles";
import { contrastText } from "@/lib/site-plan";

/**
 * 디자인 문서 — AI 가 고치는 "사이트" 의 1단계 모습. projects.brief.design (jsonb) 에 저장한다.
 *
 *   theme: 색 · 글꼴 · 제목 굵기 · 모서리 · 여백 · 버튼 · 첫 화면 배치 · 카드 모양 · 밝기
 *   copy:  정해진 문구 자리(COPY_FIELDS)의 글. 사이트 공통(site) → 페이지별(pages[path]) 순으로 덮어쓴다.
 *
 * AI 는 코드를 쓰지 않고 이 문서의 값만 바꾼다 (정해진 키 · 정해진 값 범위만 통과). 그래서 한 곳을 고쳐도 다른 곳이 깨지지 않고,
 * 수정 1건이 작고, 같은 형식의 기록이 쌓여 나중에 자체 모델을 학습시키기 좋다.
 * 그림(구성 초안)은 lib/draft-render.ts 가 이 문서로 그린다. 2단계의 실제 HTML 렌더러도 같은 문서를 읽는다.
 */

export type FontClass = "sans" | "serif" | "rounded" | "display";
export type HeroLayout = "split" | "center" | "wide";
export type ButtonStyle = "square" | "rounded" | "pill" | "outline";
export type CardStyle = "line" | "shadow" | "flat";
export type Density = "compact" | "normal" | "airy";
export type Radius = "none" | "sm" | "md" | "lg" | "xl";
export type Temperature = "cool" | "neutral" | "warm";
export type Saturation = "muted" | "balanced" | "vivid";
export type HeadingWeight = 500 | 600 | 700 | 800 | 900;

export const FONT_CLASSES: FontClass[] = ["sans", "serif", "rounded", "display"];
export const HERO_LAYOUTS: HeroLayout[] = ["split", "center", "wide"];
export const BUTTON_STYLES: ButtonStyle[] = ["square", "rounded", "pill", "outline"];
export const CARD_STYLES: CardStyle[] = ["line", "shadow", "flat"];
export const DENSITIES: Density[] = ["compact", "normal", "airy"];
export const RADII: Radius[] = ["none", "sm", "md", "lg", "xl"];
export const TEMPERATURES: Temperature[] = ["cool", "neutral", "warm"];
export const SATURATIONS: Saturation[] = ["muted", "balanced", "vivid"];
export const HEADING_WEIGHTS: HeadingWeight[] = [500, 600, 700, 800, 900];

/** 사람이 읽는 이름 (관리자 화면 · AI 지시문 · 바뀐 값 표시) */
export const THEME_LABEL = {
  font: { sans: "고딕", serif: "명조", rounded: "둥근 고딕", display: "굵은 디스플레이" } satisfies Record<FontClass, string>,
  hero: { split: "글 · 사진 나란히", center: "가운데 제목 + 아래 사진", wide: "제목 아래 화면 폭 사진" } satisfies Record<HeroLayout, string>,
  button: { square: "각진 버튼", rounded: "살짝 둥근 버튼", pill: "알약 버튼", outline: "테두리 버튼" } satisfies Record<ButtonStyle, string>,
  card: { line: "선 카드", shadow: "그림자 카드", flat: "색면 카드" } satisfies Record<CardStyle, string>,
  density: { compact: "촘촘하게", normal: "보통", airy: "넉넉하게" } satisfies Record<Density, string>,
  radius: { none: "각지게", sm: "아주 살짝 둥글게", md: "살짝 둥글게", lg: "둥글게", xl: "아주 둥글게" } satisfies Record<Radius, string>,
  temperature: { cool: "차가운 톤", neutral: "중간 톤", warm: "따뜻한 톤" } satisfies Record<Temperature, string>,
  saturation: { muted: "차분한 색", balanced: "보통 채도", vivid: "선명한 색" } satisfies Record<Saturation, string>,
  mode: { light: "밝은 바탕", dark: "어두운 바탕" } satisfies Record<"light" | "dark", string>,
};

/** AI 와 사람이 고르는 테마 값. 실제 색(바탕 · 글자 · 선 …)은 paletteOf() 가 여기서 계산한다 — 대비가 항상 맞게 */
export type Theme = {
  /** 메인 색 (버튼 · 강조) */
  primary: string;
  /** 포인트 색 (작은 강조) */
  accent: string;
  mode: "light" | "dark";
  temperature: Temperature;
  saturation: Saturation;
  headingFont: FontClass;
  bodyFont: "sans" | "serif" | "rounded";
  headingWeight: HeadingWeight;
  /** 제목 크기 배율 0.9 ~ 1.3 */
  headingScale: number;
  radius: Radius;
  buttonStyle: ButtonStyle;
  density: Density;
  heroLayout: HeroLayout;
  cardStyle: CardStyle;
};

export type CopyMap = Record<string, string>;

export type DesignDoc = {
  version: number;
  /** rules: 태그 · 템플릿 규칙으로 만든 것 · ai: AI 가 만든 것 · admin: 담당자가 고친 것 */
  source: "rules" | "ai" | "admin";
  styleTags: StyleId[];
  theme: Theme;
  copy: { site: CopyMap; pages: Record<string, CopyMap> };
  /** AI 가 태그를 어떻게 적용했는지 (사용자 · 관리자 화면) */
  appliedTags?: { tag: StyleId; how: string }[];
  /** AI 의 디자인 설명 */
  notes?: string;
  /** AI 첫 제작이 진행 중 (편집기 안내) */
  aiPending?: boolean;
  updatedAt: string;
};

// ---------------------------------------------------------------------------------------------
// 색 계산
// ---------------------------------------------------------------------------------------------

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: [number, number, number]): string {
  return `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;
}

export function isHex(v: unknown): v is string {
  return typeof v === "string" && parseHex(v) !== null;
}

/** a 와 b 를 섞는다. k = 0 이면 a, 1 이면 b */
export function mix(a: string, b: string, k: number): string {
  const x = parseHex(a) ?? [37, 99, 235];
  const y = parseHex(b) ?? [255, 255, 255];
  return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

function luminance(hex: string): number {
  const c = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 대비 (1 ~ 21) */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 바탕 위에서 읽히도록 색을 밝히거나 어둡게 한다 (최소 대비 min) */
export function readableOn(color: string, bg: string, min = 3): string {
  if (contrast(color, bg) >= min) return color;
  const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
  for (let k = 0.1; k <= 1; k += 0.1) {
    const c = mix(color, target, k);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}

export type Palette = {
  bg: string;
  /** 번갈아 쓰는 연한 구역 바탕 */
  soft: string;
  soft2: string;
  card: string;
  text: string;
  body: string;
  muted: string;
  faint: string;
  line: string;
  /** 입력칸 · 보조 버튼 테두리 */
  stroke: string;
  bar: string;
  /** 푸터 바탕 */
  dark: string;
  onDark: string;
  onDarkMuted: string;
  /** 푸터 연락처 글자 */
  onDarkSoft: string;
  /** 푸터 구분선 */
  darkLine: string;
  primary: string;
  onPrimary: string;
  /** 바탕 위 글자로 쓸 메인 색 (대비 보정) */
  primaryText: string;
  accent: string;
  /** 첫 화면 · 제목 띠 바탕 */
  tint: string;
  tint2: string;
};

type Neutrals = Omit<Palette, "primary" | "onPrimary" | "primaryText" | "accent" | "tint" | "tint2">;

// light · cool 은 예전 초안의 색과 한 글자도 다르지 않아야 한다 (예전 사이트의 그림이 바뀌지 않게)
const NEUTRALS: Record<"light" | "dark", Record<Temperature, Neutrals>> = {
  light: {
    cool: {
      bg: "#ffffff",
      soft: "#f8fafc",
      soft2: "#f1f5f9",
      card: "#ffffff",
      text: "#0f172a",
      body: "#334155",
      muted: "#64748b",
      faint: "#94a3b8",
      line: "#e2e8f0",
      stroke: "#cbd5e1",
      bar: "#e2e8f0",
      dark: "#0f172a",
      onDark: "#ffffff",
      onDarkMuted: "#94a3b8",
      onDarkSoft: "#cbd5e1",
      darkLine: "#1e293b",
    },
    neutral: {
      bg: "#ffffff",
      soft: "#f7f7f6",
      soft2: "#efefed",
      card: "#ffffff",
      text: "#18181b",
      body: "#3f3f46",
      muted: "#71717a",
      faint: "#a1a1aa",
      line: "#e4e4e7",
      stroke: "#d4d4d8",
      bar: "#e4e4e7",
      dark: "#18181b",
      onDark: "#ffffff",
      onDarkMuted: "#a1a1aa",
      onDarkSoft: "#d4d4d8",
      darkLine: "#27272a",
    },
    warm: {
      bg: "#fffdf8",
      soft: "#f8f3ea",
      soft2: "#f1e9dc",
      card: "#fffdf8",
      text: "#1c1917",
      body: "#44403c",
      muted: "#78716c",
      faint: "#a8a29e",
      line: "#e7dfd2",
      stroke: "#d6ccbd",
      bar: "#ebe3d6",
      dark: "#1c1917",
      onDark: "#fafaf9",
      onDarkMuted: "#a8a29e",
      onDarkSoft: "#d6d3d1",
      darkLine: "#292524",
    },
  },
  dark: {
    cool: {
      bg: "#0b1020",
      soft: "#111a2e",
      soft2: "#18233b",
      card: "#111a2e",
      text: "#f8fafc",
      body: "#cbd5e1",
      muted: "#94a3b8",
      faint: "#64748b",
      line: "#22304a",
      stroke: "#33466e",
      bar: "#273550",
      dark: "#060912",
      onDark: "#f8fafc",
      onDarkMuted: "#94a3b8",
      onDarkSoft: "#cbd5e1",
      darkLine: "#1a2338",
    },
    neutral: {
      bg: "#111111",
      soft: "#1a1a1a",
      soft2: "#232323",
      card: "#1a1a1a",
      text: "#fafafa",
      body: "#d4d4d8",
      muted: "#a1a1aa",
      faint: "#71717a",
      line: "#2e2e30",
      stroke: "#3f3f46",
      bar: "#323234",
      dark: "#080808",
      onDark: "#fafafa",
      onDarkMuted: "#a1a1aa",
      onDarkSoft: "#d4d4d8",
      darkLine: "#232325",
    },
    warm: {
      bg: "#16120f",
      soft: "#1f1a16",
      soft2: "#2a231e",
      card: "#1f1a16",
      text: "#fafaf9",
      body: "#e7e5e4",
      muted: "#a8a29e",
      faint: "#78716c",
      line: "#352d27",
      stroke: "#4a3f36",
      bar: "#3a312a",
      dark: "#0c0a08",
      onDark: "#fafaf9",
      onDarkMuted: "#a8a29e",
      onDarkSoft: "#d6d3d1",
      darkLine: "#2a231e",
    },
  },
};

/**
 * 테마 → 실제 색. 메인 색 위 글자는 예전 초안과 같은 규칙(contrastText)을 쓴다.
 * 메인 색을 바탕 위 글자로 쓸 때 거의 안 보이면(밝은 바탕 2:1 · 어두운 바탕 3:1 미만) 읽히게 보정한다.
 */
export function paletteOf(theme: Theme): Palette {
  const n = NEUTRALS[theme.mode][theme.temperature];
  const primary = isHex(theme.primary) ? theme.primary : "#2563eb";
  const accent = isHex(theme.accent) ? theme.accent : primary;
  const light = theme.mode === "light";
  const tintK = theme.saturation === "muted" ? 0.955 : theme.saturation === "vivid" ? 0.87 : 0.93;
  return {
    ...n,
    primary,
    onPrimary: contrastText(primary),
    primaryText: readableOn(primary, n.bg, light ? 2 : 3),
    accent: readableOn(accent, n.bg, 2),
    tint: light ? mix(primary, n.bg, tintK) : mix(primary, n.bg, 0.86),
    tint2: light ? mix(primary, n.bg, 0.82) : mix(primary, n.bg, 0.68),
  };
}

// ---------------------------------------------------------------------------------------------
// 태그 · 템플릿 → 테마 (규칙). API 키가 없어도 초안이 태그대로 달라 보이게 한다
// ---------------------------------------------------------------------------------------------

export type ThemePreset = Partial<Theme>;

export function themeFromStyles(merge: StyleMerge, primaryColor: string, preset?: ThemePreset): Theme {
  const ax = merge.axes;
  const pick = <T,>(v: number, steps: [number, T][], fallback: T): T => {
    for (const [min, out] of steps) if (v >= min) return out;
    return fallback;
  };
  const headingFont = merge.font;
  let headingWeight = pick<HeadingWeight>(ax.weight, [[1.5, 900], [0.5, 800], [-0.5, 700], [-1.5, 600]], 500);
  if (headingFont === "serif" && headingWeight > 700) headingWeight = 700;
  if (headingFont === "display") headingWeight = 900;
  const accent = merge.primary ? (merge.ids.map((id) => STYLE_BY_ID[id].accent).find(Boolean) ?? primaryColor) : primaryColor;
  const base: Theme = {
    primary: isHex(primaryColor) ? primaryColor : "#2563eb",
    accent,
    mode: merge.dark ? "dark" : "light",
    temperature: ax.temp >= 0.75 ? "warm" : ax.temp <= -0.75 ? "cool" : "neutral",
    saturation: ax.color >= 1 ? "vivid" : ax.color <= -1 ? "muted" : "balanced",
    headingFont,
    bodyFont: headingFont === "rounded" ? "rounded" : "sans",
    headingWeight,
    headingScale: Math.round(Math.min(1.3, Math.max(0.9, merge.scale + ax.weight * 0.03)) * 100) / 100,
    radius: pick<Radius>(ax.shape, [[1.5, "xl"], [0.5, "lg"], [-0.5, "md"], [-1.5, "sm"]], "none"),
    buttonStyle: merge.button,
    density: ax.space >= 1 ? "airy" : ax.space <= -1 ? "compact" : "normal",
    heroLayout: merge.hero,
    cardStyle: merge.card,
  };
  return sanitizeTheme({ ...base, ...preset, primary: base.primary }, base);
}

/** 값 범위를 벗어난 칸은 fallback 으로 */
export function sanitizeTheme(t: Partial<Record<keyof Theme, unknown>>, fallback: Theme): Theme {
  const inList = <T,>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
  return {
    primary: isHex(t.primary) ? t.primary : fallback.primary,
    accent: isHex(t.accent) ? t.accent : fallback.accent,
    mode: t.mode === "dark" || t.mode === "light" ? t.mode : fallback.mode,
    temperature: inList(t.temperature, TEMPERATURES, fallback.temperature),
    saturation: inList(t.saturation, SATURATIONS, fallback.saturation),
    headingFont: inList(t.headingFont, FONT_CLASSES, fallback.headingFont),
    bodyFont: inList(t.bodyFont, ["sans", "serif", "rounded"] as const, fallback.bodyFont),
    headingWeight: inList(Number(t.headingWeight) as HeadingWeight, HEADING_WEIGHTS, fallback.headingWeight),
    headingScale: typeof t.headingScale === "number" && Number.isFinite(t.headingScale) ? Math.round(Math.min(1.3, Math.max(0.9, t.headingScale)) * 100) / 100 : fallback.headingScale,
    radius: inList(t.radius, RADII, fallback.radius),
    buttonStyle: inList(t.buttonStyle, BUTTON_STYLES, fallback.buttonStyle),
    density: inList(t.density, DENSITIES, fallback.density),
    heroLayout: inList(t.heroLayout, HERO_LAYOUTS, fallback.heroLayout),
    cardStyle: inList(t.cardStyle, CARD_STYLES, fallback.cardStyle),
  };
}

/** 태그도 템플릿도 없을 때 (예전 사이트) — 지금까지의 초안 모습 그대로 */
export function defaultTheme(primaryColor: string): Theme {
  return {
    primary: isHex(primaryColor) ? primaryColor : "#2563eb",
    accent: isHex(primaryColor) ? primaryColor : "#2563eb",
    mode: "light",
    temperature: "cool",
    saturation: "balanced",
    headingFont: "sans",
    bodyFont: "sans",
    headingWeight: 800,
    headingScale: 1,
    radius: "lg",
    buttonStyle: "pill",
    density: "normal",
    heroLayout: "split",
    cardStyle: "line",
  };
}

/** 위저드 제출 때 · 예전 사이트를 처음 그릴 때 만드는 규칙 기반 디자인 문서 */
export function rulesDesign(input: { styleTags: readonly unknown[]; primaryColor: string; preset?: ThemePreset; now?: string }): DesignDoc {
  const tags = normalizeStyles(input.styleTags);
  const theme = tags.length || input.preset ? themeFromStyles(mergeStyles(tags), input.primaryColor, input.preset) : defaultTheme(input.primaryColor);
  return { version: 1, source: "rules", styleTags: tags, theme, copy: { site: {}, pages: {} }, updatedAt: input.now ?? new Date().toISOString() };
}

/** AI 첫 제작이 진행 중인지. 10분이 지나도 끝나지 않았으면 멈춘 것으로 본다 (엔진이 정리한다) */
export function isAiPending(doc: Pick<DesignDoc, "aiPending" | "updatedAt">, now = Date.now()): boolean {
  return Boolean(doc.aiPending) && now - new Date(doc.updatedAt).getTime() < 10 * 60_000;
}

/**
 * 저장된 디자인 문서를 안전하게 읽는다 (사이트 주인이 brief 를 직접 고칠 수도 있으므로 모든 값을 다시 검사한다).
 * 디자인 문서가 없는 예전 사이트는 기본 테마 그대로 — 예전 톤으로 테마를 새로 만들면 저장된 캡처 높이와 그림이 어긋난다.
 * 톤 → 태그 변환은 디자인 문서를 처음 만들 때(AI 첫 제작 등)만 한다.
 */
export function designOf(brief: { design?: DesignDoc | null; tone?: string[]; styleTags?: string[]; primaryColor: string }): DesignDoc {
  const d = brief.design;
  const tags = normalizeStyles(brief.styleTags?.length ? brief.styleTags : (brief.tone ?? []));
  const fallback: DesignDoc = { ...rulesDesign({ styleTags: [], primaryColor: brief.primaryColor, now: "1970-01-01T00:00:00.000Z" }), version: 0, styleTags: tags };
  if (!d || typeof d !== "object" || !d.theme) return fallback;
  return {
    version: typeof d.version === "number" ? d.version : 1,
    source: d.source === "ai" || d.source === "admin" ? d.source : "rules",
    styleTags: normalizeStyles(d.styleTags ?? tags),
    theme: sanitizeTheme(d.theme, fallback.theme),
    copy: { site: cleanCopy(d.copy?.site), pages: Object.fromEntries(Object.entries(d.copy?.pages ?? {}).map(([k, v]) => [k, cleanCopy(v)])) },
    appliedTags: Array.isArray(d.appliedTags) ? d.appliedTags.filter((a) => a && typeof a.how === "string").slice(0, 8) : undefined,
    notes: typeof d.notes === "string" ? d.notes.slice(0, 2000) : undefined,
    aiPending: d.aiPending === true,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : fallback.updatedAt,
  };
}

function cleanCopy(m: unknown): CopyMap {
  if (!m || typeof m !== "object") return {};
  const out: CopyMap = {};
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (typeof v === "string" && fieldDef(k)) out[k] = clampCopy(k, v);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 문구 자리
// ---------------------------------------------------------------------------------------------

export type CopyFieldDef = {
  /** 정확한 키 또는 "offering.*.description" 처럼 번호 자리 */
  key: string;
  label: string;
  /** site: 모든 페이지에 같이 쓰는 문구 · page: 페이지마다 */
  scope: "site" | "page";
  max: number;
  /** 이 문구가 보이는 페이지 종류 (page 범위일 때) */
  kinds?: string[];
};

/**
 * 초안 그림이 그리는 문구 자리. AI 는 여기 있는 키만 바꿀 수 있다.
 * 사실(가격 · 연혁 · 후기 · 구성원 · 자격)이 들어가는 자리는 없다 — 그런 내용은 고객이 준 것만 쓴다.
 * max 는 가장 좁은 화면 · 가장 큰 제목 배율에서도 "…" 로 잘리지 않는 글자 수(공백 포함)다.
 */
export const COPY_FIELDS: CopyFieldDef[] = [
  { key: "site.cta", label: "헤더 · 첫 화면 버튼", scope: "site", max: 10 },
  { key: "footer.tagline", label: "푸터 한 줄 소개", scope: "site", max: 50 },
  { key: "offerings.title", label: "서비스 구역 제목", scope: "site", max: 20 },
  { key: "offerings.subtitle", label: "서비스 구역 설명", scope: "site", max: 44 },
  { key: "offering.*.description", label: "서비스 한 줄 설명", scope: "site", max: 60 },
  { key: "strengths.title", label: "강점 구역 제목", scope: "site", max: 22 },
  { key: "strength.*", label: "강점 한 줄", scope: "site", max: 34 },
  { key: "reviews.title", label: "후기 구역 제목", scope: "site", max: 16 },
  { key: "cta.title", label: "아래 행동 유도 띠 제목", scope: "site", max: 22 },
  { key: "cta.subtitle", label: "아래 행동 유도 띠 설명", scope: "site", max: 44 },
  { key: "hero.eyebrow", label: "첫 화면 작은 머리글", scope: "page", max: 20, kinds: ["home"] },
  { key: "hero.title", label: "첫 화면 큰 제목", scope: "page", max: 26, kinds: ["home"] },
  { key: "hero.subtitle", label: "첫 화면 설명", scope: "page", max: 50, kinds: ["home"] },
  { key: "hero.secondary", label: "첫 화면 두 번째 버튼", scope: "page", max: 10, kinds: ["home"] },
  { key: "about.title", label: "소개 구역 제목", scope: "page", max: 22, kinds: ["home", "about"] },
  { key: "about.body", label: "소개 글", scope: "page", max: 220, kinds: ["home", "about"] },
  { key: "about.button", label: "소개 구역 버튼", scope: "page", max: 10, kinds: ["home"] },
  { key: "page.subtitle", label: "페이지 제목 아래 설명", scope: "page", max: 44 },
  { key: "contact.button", label: "문의 폼 버튼", scope: "page", max: 10, kinds: ["contact"] },
  { key: "reservation.button", label: "예약 폼 버튼", scope: "page", max: 10, kinds: ["reservation"] },
  { key: "careers.title", label: "채용 소개 제목", scope: "page", max: 20, kinds: ["careers"] },
  { key: "careers.subtitle", label: "채용 소개 설명", scope: "page", max: 44, kinds: ["careers"] },
];

const WILD = /^(offering|strength)\.(\d)(\.description)?$/;

export function fieldDef(key: string): CopyFieldDef | undefined {
  const exact = COPY_FIELDS.find((f) => f.key === key);
  if (exact) return exact;
  const m = WILD.exec(key);
  if (!m) return undefined;
  const pattern = m[1] === "offering" ? (m[3] ? "offering.*.description" : null) : m[3] ? null : "strength.*";
  return pattern ? COPY_FIELDS.find((f) => f.key === pattern) : undefined;
}

/**
 * 꺾쇠 · 인터넷 주소 · 이메일 · 전화번호를 걷어내고 길이를 자른다 (문구 자리에는 글만 들어간다).
 * 연락처는 그림이 고객 정보에서 직접 넣는다 — AI 가 쓴 글에 번호 · 주소가 섞여 잘못된 연락처가 퍼지지 않게.
 */
export function clampCopy(key: string, value: string): string {
  const max = fieldDef(key)?.max ?? 60;
  const cleaned = value
    .replace(/[<>]/g, "")
    .replace(/(https?:\/\/|www\.)\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...cleaned].slice(0, max).join("");
}

/** 사실을 지어내지 않게: 고객이 준 서비스 · 강점 수와 소개 글이 있는지 */
export type CopyLimits = { offerings: number; strengths: number; hasAbout: boolean };

/** 이 키를 이 사이트에 써도 되는지. 안 되면 이유 */
export function copyKeyProblem(key: string, limits: CopyLimits): string | null {
  const m = WILD.exec(key);
  if (m?.[1] === "offering" && Number(m[2]) >= limits.offerings) return `${key}: 없는 서비스`;
  if (m?.[1] === "strength" && Number(m[2]) >= limits.strengths) return `${key}: 고객이 적지 않은 강점`;
  if (key === "about.body" && !limits.hasAbout) return "about.body: 고객이 소개 글을 주지 않음 (지어내지 않는다)";
  return null;
}

/** 문구 찾기: 페이지 → 사이트 공통 → 없음 */
export function copyOf(doc: Pick<DesignDoc, "copy">, path: string, key: string): string | undefined {
  const v = doc.copy.pages[path]?.[key] ?? doc.copy.site[key];
  return v && v.trim() ? v : undefined;
}

// ---------------------------------------------------------------------------------------------
// 바꾸기 (AI · 담당자)
// ---------------------------------------------------------------------------------------------

export type ThemeChange = { key: keyof Theme; value: string };
export type CopyChange = { scope: "site" | "page"; path?: string | null; key: string; value: string };

export const THEME_KEYS: (keyof Theme)[] = [
  "primary",
  "accent",
  "mode",
  "temperature",
  "saturation",
  "headingFont",
  "bodyFont",
  "headingWeight",
  "headingScale",
  "radius",
  "buttonStyle",
  "density",
  "heroLayout",
  "cardStyle",
];

export type AppliedChange = { kind: "theme" | "copy"; key: string; path?: string; before: string; after: string };

/**
 * 바꿀 값을 검사해 새 문서를 만든다. 범위를 벗어난 값 · 모르는 키 · 없는 페이지는 버리고(rejected 에 이유), 실제로 바뀐 것만 applied 에 남긴다.
 * 버전은 올리지 않는다 — 저장하는 쪽이 올린다.
 */
export function applyChanges(
  doc: DesignDoc,
  changes: { theme?: ThemeChange[]; copy?: CopyChange[] },
  pagePaths: readonly string[],
  limits: CopyLimits,
): { doc: DesignDoc; applied: AppliedChange[]; rejected: string[] } {
  const applied: AppliedChange[] = [];
  const rejected: string[] = [];
  const theme: Theme = { ...doc.theme };
  for (const c of changes.theme ?? []) {
    if (!THEME_KEYS.includes(c.key)) {
      rejected.push(`테마 키 ${c.key}`);
      continue;
    }
    const raw = c.key === "headingWeight" || c.key === "headingScale" ? Number(c.value) : c.value;
    const next = sanitizeTheme({ ...theme, [c.key]: raw }, theme);
    const before = String(theme[c.key]);
    const after = String(next[c.key]);
    if (after === before) {
      if (String(raw) !== before) rejected.push(`${c.key}=${c.value}`);
      continue;
    }
    Object.assign(theme, next);
    applied.push({ kind: "theme", key: c.key, before, after });
  }

  const site = { ...doc.copy.site };
  const pages: Record<string, CopyMap> = Object.fromEntries(Object.entries(doc.copy.pages).map(([k, v]) => [k, { ...v }]));
  for (const c of changes.copy ?? []) {
    const def = fieldDef(c.key);
    if (!def) {
      rejected.push(`문구 키 ${c.key}`);
      continue;
    }
    const problem = copyKeyProblem(c.key, limits);
    if (problem) {
      rejected.push(problem);
      continue;
    }
    const value = clampCopy(c.key, c.value);
    if (!value) {
      rejected.push(`${c.key}: 빈 문구`);
      continue;
    }
    const scope = def.scope === "site" && c.scope !== "page" ? "site" : "page";
    if (scope === "page") {
      const path = c.path ?? "";
      if (!pagePaths.includes(path)) {
        rejected.push(`없는 페이지 ${path}`);
        continue;
      }
      const before = pages[path]?.[c.key] ?? site[c.key] ?? "";
      if (before === value) continue;
      pages[path] = { ...pages[path], [c.key]: value };
      applied.push({ kind: "copy", key: c.key, path, before, after: value });
    } else {
      const before = site[c.key] ?? "";
      if (before === value) continue;
      site[c.key] = value;
      applied.push({ kind: "copy", key: c.key, before, after: value });
    }
  }
  return { doc: { ...doc, theme, copy: { site, pages } }, applied, rejected };
}

/** 바뀐 값 한 줄 (관리자 화면 · 대화) */
export function describeChange(c: AppliedChange): string {
  if (c.kind === "copy") return `${fieldDef(c.key)?.label ?? c.key}: "${c.before || "기본 문구"}" → "${c.after}"`;
  const label: Record<string, string> = {
    primary: "메인 색",
    accent: "포인트 색",
    mode: "바탕",
    temperature: "색 온도",
    saturation: "채도",
    headingFont: "제목 글꼴",
    bodyFont: "본문 글꼴",
    headingWeight: "제목 굵기",
    headingScale: "제목 크기",
    radius: "모서리",
    buttonStyle: "버튼 모양",
    density: "여백",
    heroLayout: "첫 화면 배치",
    cardStyle: "카드 모양",
  };
  const word = (k: string, v: string): string => {
    const table: Record<string, Record<string, string>> = {
      headingFont: THEME_LABEL.font,
      bodyFont: THEME_LABEL.font,
      heroLayout: THEME_LABEL.hero,
      buttonStyle: THEME_LABEL.button,
      cardStyle: THEME_LABEL.card,
      density: THEME_LABEL.density,
      radius: THEME_LABEL.radius,
      temperature: THEME_LABEL.temperature,
      saturation: THEME_LABEL.saturation,
      mode: THEME_LABEL.mode,
    };
    return table[k]?.[v] ?? v;
  };
  return `${label[c.key] ?? c.key}: ${word(c.key, c.before)} → ${word(c.key, c.after)}`;
}

/** 테마를 한 줄씩 (지시서 · 관리자 화면) */
export function describeTheme(t: Theme): string[] {
  return [
    `메인 색 ${t.primary} · 포인트 색 ${t.accent}`,
    `${THEME_LABEL.mode[t.mode]} · ${THEME_LABEL.temperature[t.temperature]} · ${THEME_LABEL.saturation[t.saturation]}`,
    `제목 ${THEME_LABEL.font[t.headingFont]} ${t.headingWeight} · 크기 ×${t.headingScale} · 본문 ${THEME_LABEL.font[t.bodyFont]}`,
    `모서리 ${THEME_LABEL.radius[t.radius]} · ${THEME_LABEL.button[t.buttonStyle]} · ${THEME_LABEL.card[t.cardStyle]}`,
    `여백 ${THEME_LABEL.density[t.density]} · 첫 화면 ${THEME_LABEL.hero[t.heroLayout]}`,
  ];
}
