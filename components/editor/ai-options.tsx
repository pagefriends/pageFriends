"use client";

import { ChevronDownIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { DraftBox, EditorTemplate } from "@/components/editor/types";
import { Select } from "@/components/ui/input";
import { MAX_STYLES, STYLES, STYLE_BY_ID, type StyleId } from "@/config/design-styles";
import { cn } from "@/lib/utils";

/**
 * AI 반영 네모의 옵션 — 이 부분만 다른 디자인 유형으로, 또는 구매한 템플릿의 느낌으로 고쳐 달라고 할 때.
 * 아무것도 고르지 않으면 사이트의 디자인 유형을 그대로 쓴다. 접어 두어 카드가 길어지지 않게 한다.
 */
export function AiOptions({ box, onChange, siteStyles, templates }: { box: DraftBox; onChange: (patch: Partial<DraftBox>) => void; siteStyles: StyleId[]; templates: EditorTemplate[] }) {
  const custom = box.styles !== undefined;
  const styles = box.styles ?? siteStyles;
  const template = templates.find((t) => t.id === box.templateId) ?? null;
  const [open, setOpen] = useState(custom || Boolean(template));
  const label = (ids: StyleId[]) => (ids.length ? ids.map((id, i) => `${i === 0 ? "★" : ""}${STYLE_BY_ID[id].label}`).join(" · ") : "업종에 맞게");
  const toggle = (id: StyleId) => {
    const next = styles.includes(id) ? styles.filter((x) => x !== id) : styles.length < MAX_STYLES ? [...styles, id] : styles;
    onChange({ styles: next });
  };

  return (
    <div className="mt-2 rounded border border-ink-200 text-xs" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left" aria-expanded={open}>
        <span className="min-w-0 truncate text-ink-500">
          디자인 유형 <b className="font-semibold text-ink-700">{custom ? label(styles) : `사이트 기본 (${label(siteStyles)})`}</b>
          {template ? (
            <>
              {" "}
              · 참고 템플릿 <b className="font-semibold text-ink-700">{template.name}</b>
            </>
          ) : null}
        </span>
        <ChevronDownIcon className={cn("size-3.5 shrink-0 text-ink-500 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="border-t border-ink-100 px-2.5 py-2">
          <p className="text-[11px] text-ink-500">이 부분만 다른 느낌으로 바꾸고 싶을 때 골라요. 처음 고른 것이 대표예요.</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {STYLES.map((s) => {
              const i = styles.indexOf(s.id);
              const on = i >= 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  title={s.desc}
                  className={cn("inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5", on ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-ink-200 text-ink-700 hover:border-ink-400")}
                >
                  {i === 0 ? <StarIcon className="size-2.5 fill-current" /> : null}
                  {s.label}
                </button>
              );
            })}
          </div>
          {custom ? (
            <button type="button" onClick={() => onChange({ styles: undefined })} className="mt-1.5 text-[11px] text-brand-600 hover:underline">
              사이트 기본으로 되돌리기
            </button>
          ) : null}

          <label className="mt-2.5 block text-[11px] font-semibold text-ink-700" htmlFor={`tpl-${box.id}`}>
            참고 템플릿 (선택)
          </label>
          <Select id={`tpl-${box.id}`} value={box.templateId ?? ""} onChange={(e) => onChange({ templateId: e.target.value || null })} className="mt-1 h-8 py-0 text-xs">
            <option value="">없음</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id} disabled={!t.purchased}>
                {t.name}
                {t.tags.length ? ` · ${t.tags.map((id) => STYLE_BY_ID[id].label).join("·")}` : ""}
                {t.purchased ? "" : " (구매 필요)"}
              </option>
            ))}
          </Select>
          {templates.some((t) => !t.purchased) ? (
            <Link href="/templates" target="_blank" className="mt-1 inline-block text-[11px] text-brand-600 hover:underline">
              템플릿 둘러보기 · 구매 →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
