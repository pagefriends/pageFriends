"use client";

import { StarIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Tip } from "@/components/wizard/parts";
import { MAX_STYLES, STYLES, STYLE_BY_ID, STYLE_GROUPS, mergeStyles, type StyleId } from "@/config/design-styles";
import { paletteOf, themeFromStyles, type Theme, type ThemePreset } from "@/lib/design-doc";
import { cn } from "@/lib/utils";

/**
 * 디자인 유형 고르기 (배지 여러 개, 처음 고른 것이 대표 ★).
 * 고르는 즉시 합친 결과("AI가 이렇게 적용해요") · 충돌 안내 · 첫 화면 미리보기가 바뀐다 — 서버가 만들 디자인과 같은 함수(mergeStyles · themeFromStyles)를 쓴다.
 */
export function StylePicker({
  value,
  onChange,
  guided,
  primaryColor,
  onPickColor,
}: {
  value: StyleId[];
  onChange: (next: StyleId[]) => void;
  guided: boolean;
  primaryColor: string;
  onPickColor: (hex: string) => void;
}) {
  const merge = mergeStyles(value);
  const full = value.length >= MAX_STYLES;
  const toggle = (id: StyleId) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (!full) onChange([...value, id]);
  };
  const makePrimary = (id: StyleId) => onChange([id, ...value.filter((x) => x !== id)]);
  const suggest = [...new Set(value.flatMap((id) => STYLE_BY_ID[id].suggestColors))].slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      {STYLE_GROUPS.map((g) => (
        <div key={g.code}>
          <p className="mb-1.5 text-xs text-ink-500">
            <span className="font-semibold text-ink-700">{g.label}</span> · {g.desc}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.filter((s) => s.group === g.code).map((s) => {
              const i = value.indexOf(s.id);
              const on = i >= 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  disabled={!on && full}
                  aria-pressed={on}
                  title={s.desc}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded border py-1.5 pr-3 pl-2 text-[13px] transition-colors",
                    on ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-ink-200 text-ink-700 hover:border-ink-400",
                    !on && full && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="flex overflow-hidden rounded-sm border border-ink-200" aria-hidden>
                    {s.swatch.map((c, k) => (
                      <span key={k} className="block size-2.5" style={{ background: c }} />
                    ))}
                  </span>
                  {i === 0 ? <StarIcon className="size-3 fill-current" aria-label="대표" /> : null}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {value.length ? (
        <div className="rounded-md border border-ink-200 px-3 py-2.5">
          <p className="text-xs text-ink-500">
            고른 순서 · 처음 것이 <b className="text-ink-700">대표</b>예요 ({value.length}/{MAX_STYLES})
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {value.map((id, i) => (
              <li key={id} className={cn("inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs", i === 0 ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200")}>
                {i === 0 ? <StarIcon className="size-3 fill-current" /> : null}
                <span className="font-semibold">{STYLE_BY_ID[id].label}</span>
                {i > 0 ? (
                  <button type="button" onClick={() => makePrimary(id)} className="rounded-full px-1.5 text-[11px] text-ink-500 hover:bg-ink-100 hover:text-ink-900">
                    대표로
                  </button>
                ) : null}
                <button type="button" onClick={() => toggle(id)} className="grid size-5 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-900" aria-label={`${STYLE_BY_ID[id].label} 빼기`}>
                  <XIcon className="size-3" />
                </button>
              </li>
            ))}
          </ul>
          {guided ? <p className="mt-2 text-xs leading-relaxed text-ink-500">{value.map((id) => `${STYLE_BY_ID[id].label}: ${STYLE_BY_ID[id].desc}`).join(" / ")}</p> : null}
        </div>
      ) : guided ? (
        <Tip>마음에 드는 느낌을 1~4개 골라 주세요. 처음 고른 것을 가장 크게 반영하고, 나머지는 함께 섞어요. 모르겠으면 업종에 맞게 잡아 드려요.</Tip>
      ) : null}

      {merge.conflicts.length ? (
        <ul className="flex flex-col gap-1.5">
          {merge.conflicts.map((c) => (
            <li key={`${c.a}-${c.b}-${c.axis}`} className="flex gap-2 rounded-md border border-ink-300 bg-ink-100 px-3 py-2 text-xs leading-relaxed text-ink-700">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              {c.text}
            </li>
          ))}
        </ul>
      ) : null}

      {merge.summary.length ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
          <p className="font-semibold text-ink-900">AI가 이렇게 적용해요</p>
          <ul className="mt-1 list-disc pl-4">
            {merge.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {merge.avoid.length ? <p className="mt-1.5 text-xs text-ink-500">피할 것: {merge.avoid.slice(0, 6).join(" · ")}</p> : null}
        </div>
      ) : null}

      {suggest.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
          이 유형에 어울리는 메인 색
          {suggest.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPickColor(c)}
              aria-label={c}
              title={c}
              className={cn("size-6 rounded-sm border-2", primaryColor.toLowerCase() === c.toLowerCase() ? "border-ink-900" : "border-transparent")}
              style={{ background: c }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 첫 화면 미리보기 (헤더 + 첫 화면). 서버가 그릴 초안과 같은 테마 값으로 색 · 글꼴 · 굵기 · 모서리 · 버튼 · 배치 · 밝기를 보여 준다.
 * 글꼴은 이 컴퓨터에 깔린 글꼴로 보인다.
 */
export function StylePreview({
  styles,
  primaryColor,
  preset,
  siteName,
  tagline,
  cta,
  menu,
}: {
  styles: StyleId[];
  primaryColor: string;
  preset?: ThemePreset;
  siteName: string;
  tagline: string;
  cta: string;
  menu: string[];
}) {
  const theme: Theme = themeFromStyles(mergeStyles(styles), primaryColor, preset);
  const p = paletteOf(theme);
  const font = theme.headingFont === "serif" ? "'Noto Serif KR', 'Nanum Myeongjo', AppleMyungjo, Batang, serif" : "inherit";
  const radius = { none: 0, sm: 4, md: 8, lg: 12, xl: 20 }[theme.radius];
  const btnRadius = theme.buttonStyle === "pill" ? 999 : theme.buttonStyle === "square" ? (radius ? 3 : 0) : theme.buttonStyle === "outline" ? Math.min(radius, 12) : 8;
  const outline = theme.buttonStyle === "outline";
  const pad = { compact: 18, normal: 26, airy: 36 }[theme.density];
  const center = theme.heroLayout === "center";
  const wide = theme.heroLayout === "wide";
  const title = tagline.trim() || "한 줄 소개가 첫 화면 제목이 돼요";
  const image = (
    <div
      className="grid place-items-center text-[10px]"
      style={{ background: p.soft2, color: p.muted, border: `1.5px dashed ${p.faint}`, borderRadius: wide ? 0 : Math.min(radius, 10), height: wide ? 70 : center ? 64 : 96 }}
    >
      메인 이미지
    </div>
  );
  return (
    <div className="overflow-hidden rounded-md border border-ink-200" aria-label="첫 화면 미리보기" style={{ background: p.bg, color: p.text }}>
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${p.line}` }}>
        <span className="grid size-5 shrink-0 place-items-center text-[10px] font-bold" style={{ background: p.primary, color: p.onPrimary, borderRadius: Math.min(radius, 6) }}>
          {[...(siteName.trim() || "P")][0]}
        </span>
        <span className="max-w-32 truncate text-xs font-bold" style={{ fontFamily: font }}>
          {siteName.trim() || "회사 이름"}
        </span>
        <span className="ml-auto hidden gap-3 text-[11px] sm:flex" style={{ color: p.body }}>
          {menu.slice(0, 4).map((m, i) => (
            <span key={i} className="max-w-20 truncate">
              {m}
            </span>
          ))}
        </span>
        <span
          className="shrink-0 px-2.5 py-1 text-[10px] font-semibold"
          style={{ background: outline ? "transparent" : p.primary, color: outline ? p.primaryText : p.onPrimary, border: outline ? `1px solid ${p.primaryText}` : undefined, borderRadius: btnRadius }}
        >
          {cta}
        </span>
      </div>
      <div style={{ background: p.tint, padding: `${pad}px 16px ${wide ? 0 : pad}px` }}>
        <div className={cn("grid gap-4", !center && !wide && "sm:grid-cols-[1fr_200px] sm:items-center")}>
          <div className={center ? "text-center" : undefined}>
            <p className="text-[10px] font-bold" style={{ color: p.primaryText }}>
              업종
            </p>
            <p className="mt-1 text-lg leading-snug" style={{ fontFamily: font, fontWeight: theme.headingWeight, fontSize: Math.round(18 * theme.headingScale) }}>
              {title}
            </p>
            <div className={cn("mt-2.5 flex gap-1.5", center && "justify-center")}>
              <span
                className="px-2.5 py-1 text-[10px] font-semibold"
                style={{ background: outline ? "transparent" : p.primary, color: outline ? p.primaryText : p.onPrimary, border: outline ? `1px solid ${p.primaryText}` : undefined, borderRadius: btnRadius }}
              >
                {cta}
              </span>
              <span className="px-2.5 py-1 text-[10px] font-semibold" style={{ background: p.bg, color: p.text, border: `1px solid ${p.stroke}`, borderRadius: btnRadius }}>
                더 보기
              </span>
            </div>
          </div>
          {wide ? null : image}
        </div>
        {wide ? <div className="-mx-4 mt-4">{image}</div> : null}
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 py-3" style={{ background: p.bg }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-10"
            style={{
              background: theme.cardStyle === "flat" ? p.soft2 : p.card,
              border: theme.cardStyle === "line" ? `1px solid ${p.line}` : undefined,
              boxShadow: theme.cardStyle === "shadow" ? "0 4px 10px rgba(15,23,42,.10)" : undefined,
              borderRadius: radius,
            }}
          />
        ))}
      </div>
    </div>
  );
}
