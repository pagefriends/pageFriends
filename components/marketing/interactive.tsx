"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** 가로 스크롤 카드 캐러셀 (디자인 피클의 후기 · 카테고리 슬라이더) */
export function Carousel({ children, className, itemClassName, controls = true }: { children: React.ReactNode[]; className?: string; itemClassName?: string; controls?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <div className={cn("relative", className)}>
      <div ref={ref} className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children.map((c, i) => (
          <div key={i} className={cn("w-[85%] shrink-0 snap-start sm:w-[420px]", itemClassName)}>
            {c}
          </div>
        ))}
      </div>
      {controls ? (
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full border border-current/30 hover:border-current" aria-label="이전">
            <ChevronLeftIcon className="size-4" />
          </button>
          <button type="button" onClick={() => go(1)} className="grid size-10 place-items-center rounded-full border border-current/30 hover:border-current" aria-label="다음">
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 접었다 펴는 FAQ */
export function FaqAccordion({ items, tone = "light" }: { items: { q: string; a: string }[]; tone?: "light" | "dark" }) {
  const [open, setOpen] = useState<number | null>(0);
  const dark = tone === "dark";
  return (
    <div className={cn("divide-y", dark ? "divide-white/10" : "divide-ink-200")}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={it.q}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={isOpen}>
              <span className="text-base font-semibold sm:text-lg">{it.q}</span>
              <ChevronDownIcon className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180", dark ? "text-white/60" : "text-ink-400")} />
            </button>
            {isOpen ? <p className={cn("pb-5 text-[15px] leading-relaxed", dark ? "text-white/70" : "text-ink-600")}>{it.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

/** 탭 (플랫폼 페이지의 만들기 · 연결 · 협업 · 관리) */
export function Tabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn("rounded-full border px-4 py-2 text-[13px] font-semibold", active === t.key ? "border-sky-400 bg-sky-400 text-night-950" : "border-white/20 text-white/80 hover:border-white")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-8">{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}
