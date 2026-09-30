"use client";

import { ArrowUpRightIcon, BriefcaseIcon, ChevronDownIcon, MenuIcon, MessageSquareIcon, MicIcon, PenLineIcon, SearchIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/site/logo";
import { buttonClass } from "@/components/ui/button";
import { INDUSTRIES, NAV } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * 디자인 피클식 상단 바: 로고 · 메가메뉴(솔루션 & 서비스 / 플랫폼 / 요금제 / 리소스 / 왜 페이지프렌즈) · 검색 · 로그인 · CTA.
 * 데스크톱은 hover 로 열리고, 모바일은 햄버거 → 전체 화면 드로어(아코디언).
 */
type Menu = "solutions" | "resources" | "why";

export function MegaNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState<Menu | null>(null);
  const [search, setSearch] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const show = (m: Menu) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(m);
  };
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 120);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSearch(false);
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const topLink = "inline-flex h-16 items-center gap-1 text-[14px] text-white/85 hover:text-white";

  return (
    <header className="sticky top-0 z-40 bg-night-950 text-white" onMouseLeave={hide}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo light />
          <nav className="hidden items-center gap-6 lg:flex" aria-label="주요 메뉴">
            <button type="button" className={topLink} onMouseEnter={() => show("solutions")} onClick={() => setOpen(open === "solutions" ? null : "solutions")} aria-expanded={open === "solutions"}>
              {NAV.solutions.label} <ChevronDownIcon className={cn("size-3.5 transition-transform", open === "solutions" && "rotate-180")} />
            </button>
            <Link href={NAV.platform.href} className={topLink} onMouseEnter={hide}>
              {NAV.platform.label}
            </Link>
            <Link href={NAV.pricing.href} className={topLink} onMouseEnter={hide}>
              {NAV.pricing.label}
            </Link>
            <button type="button" className={topLink} onMouseEnter={() => show("resources")} onClick={() => setOpen(open === "resources" ? null : "resources")} aria-expanded={open === "resources"}>
              {NAV.resources.label} <ChevronDownIcon className={cn("size-3.5 transition-transform", open === "resources" && "rotate-180")} />
            </button>
            <button type="button" className={topLink} onMouseEnter={() => show("why")} onClick={() => setOpen(open === "why" ? null : "why")} aria-expanded={open === "why"}>
              {NAV.why.label} <ChevronDownIcon className={cn("size-3.5 transition-transform", open === "why" && "rotate-180")} />
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button type="button" onClick={() => setSearch(true)} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white" aria-label="검색">
            <SearchIcon className="size-[18px]" />
          </button>
          {signedIn ? (
            <Link href="/dashboard" className="hidden text-[14px] text-white/85 hover:text-white sm:inline">
              대시보드
            </Link>
          ) : (
            <Link href={NAV.signIn.href} className="hidden text-[14px] text-white/85 hover:text-white sm:inline">
              {NAV.signIn.label}
            </Link>
          )}
          <Link href={NAV.cta.href} className={buttonClass("primary", "md")}>
            {NAV.cta.label}
          </Link>
          <button type="button" onClick={() => setDrawer(true)} className="grid size-9 place-items-center rounded-full text-white/80 hover:bg-white/10 lg:hidden" aria-label="메뉴 열기">
            <MenuIcon className="size-5" />
          </button>
        </div>
      </div>

      {/* 메가메뉴 패널 */}
      {open ? (
        <div className="absolute inset-x-0 top-16 hidden lg:block" onMouseEnter={() => show(open)} onMouseLeave={hide}>
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid grid-cols-[1fr_260px] gap-6 rounded-b-2xl bg-night-900 p-6 shadow-2xl ring-1 ring-white/10">
              <div>
                {open === "solutions" ? (
                  <>
                    <p className="text-xs text-white/50">{NAV.solutions.label}</p>
                    <ul className="mt-3 grid grid-cols-2 gap-x-8">
                      {NAV.solutions.items.map((it) => (
                        <li key={it.href} className="border-b border-white/10">
                          <Link href={it.href} onClick={() => setOpen(null)} className="group flex items-center justify-between py-3">
                            <span>
                              <span className="block text-[14px] font-semibold group-hover:text-sky-300">{it.label}</span>
                              <span className="block text-xs text-white/50">{it.desc}</span>
                            </span>
                            <ArrowUpRightIcon className="size-4 text-white/30 group-hover:text-sky-300" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {open === "resources" ? (
                  <>
                    <p className="text-xs text-white/50">{NAV.resources.label}</p>
                    <div className="mt-3 grid grid-cols-2 gap-5">
                      {NAV.resources.featured.map((f) => (
                        <Link key={f.href} href={f.href} onClick={() => setOpen(null)} className="group">
                          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-night-800">
                            <Image src={f.image.src} alt="" fill className="object-cover" unoptimized />
                          </div>
                          <p className="mt-3 text-[14px] font-semibold group-hover:text-sky-300">{f.label}</p>
                          <p className="text-xs text-white/50">{f.desc}</p>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
                {open === "why" ? (
                  <>
                    <p className="text-xs text-white/50">{NAV.why.label}</p>
                    <div className="mt-3 grid grid-cols-2 gap-5">
                      {NAV.why.featured.map((f) => (
                        <Link key={f.href} href={f.href} onClick={() => setOpen(null)} className="group">
                          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-night-800">
                            <Image src={f.image.src} alt="" fill className="object-cover" unoptimized />
                          </div>
                          <p className="mt-3 text-[14px] font-semibold group-hover:text-sky-300">{f.label}</p>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="border-l border-white/10 pl-6">
                {open === "why" ? (
                  <ul className="flex flex-col gap-3 pt-6 text-[14px]">
                    {NAV.why.links.map((l, i) => (
                      <li key={l.href}>
                        <Link href={l.href} onClick={() => setOpen(null)} className="inline-flex items-center gap-2 text-white/85 hover:text-sky-300">
                          {[<MessageSquareIcon key="a" className="size-4 text-sky-400" />, <BriefcaseIcon key="b" className="size-4 text-sky-400" />, <ArrowUpRightIcon key="c" className="size-4 text-sky-400" />][i]}
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <p className="text-xs text-white/50">업종별 사례</p>
                    <ul className="mt-3 flex flex-col gap-2 text-[14px]">
                      {INDUSTRIES.map((ind) => (
                        <li key={ind.key}>
                          <Link href={`/customer-stories?category=${ind.key}`} onClick={() => setOpen(null)} className="text-white/85 hover:text-sky-300">
                            {ind.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {open === "resources" ? (
                      <ul className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 text-[14px]">
                        {NAV.resources.links.map((l, i) => (
                          <li key={l.href}>
                            <Link href={l.href} onClick={() => setOpen(null)} className="inline-flex items-center gap-2 text-white/85 hover:text-sky-300">
                              {[<PenLineIcon key="a" className="size-4 text-sky-400" />, <MicIcon key="b" className="size-4 text-sky-400" />, <ArrowUpRightIcon key="c" className="size-4 text-sky-400" />][i]}
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Link href="/templates" onClick={() => setOpen(null)} className="mt-6 block overflow-hidden rounded-xl bg-brand-600 p-5 text-white">
                        <p className="text-xs font-semibold tracking-wide text-white/70 uppercase">템플릿</p>
                        <p className="mt-1 text-[15px] font-bold leading-snug">완성 디자인 1,000원부터</p>
                        <p className="mt-1 text-xs text-white/80">운영 사이트 템플릿 8,900원</p>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 검색 오버레이 */}
      {search ? <SearchOverlay onClose={() => setSearch(false)} /> : null}

      {/* 모바일 드로어 */}
      {drawer ? <MobileDrawer signedIn={signedIn} onClose={() => setDrawer(false)} /> : null}
    </header>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-night-950/95 backdrop-blur-sm" role="dialog" aria-label="검색">
      <button type="button" onClick={onClose} className="absolute top-6 right-6 grid size-10 place-items-center rounded-full border border-white/30 text-white hover:border-white" aria-label="닫기">
        <XIcon className="size-4" />
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          onClose();
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-5"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="무엇을 찾으세요? 아무 단어나 입력해 보세요"
          className="h-14 w-full rounded-full border border-white/30 bg-transparent px-6 text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          {[
            { href: "/blog", label: "블로그" },
            { href: "/help", label: "도움말" },
            { href: "/pricing", label: "요금제" },
            { href: "/templates", label: "템플릿" },
          ].map((s) => (
            <Link key={s.href} href={s.href} onClick={onClose} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-white/80 hover:bg-white/20">
              {s.label} <ArrowUpRightIcon className="size-3" />
            </Link>
          ))}
        </div>
      </form>
    </div>
  );
}

function DrawerRow({ href, label, onClose }: { href: string; label: string; onClose: () => void }) {
  return (
    <li>
      <Link href={href} onClick={onClose} className="block py-2 text-[15px] text-white/85 hover:text-white">
        {label}
      </Link>
    </li>
  );
}

function DrawerHead({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between py-3 text-left text-base font-semibold" aria-expanded={open}>
      {label} <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
    </button>
  );
}

function MobileDrawer({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
  const [sec, setSec] = useState<Menu | null>("solutions");
  const toggle = (k: Menu) => setSec(sec === k ? null : k);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-night-950 text-white lg:hidden" role="dialog" aria-label="메뉴">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light />
        <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="닫기">
          <XIcon className="size-5" />
        </button>
      </div>
      <div className="px-5 pb-10">
        <div className="divide-y divide-white/10">
          <div>
            <DrawerHead label={NAV.solutions.label} open={sec === "solutions"} onToggle={() => toggle("solutions")} />
            {sec === "solutions" ? (
              <ul className="grid grid-cols-2 gap-x-4 pb-3">
                {NAV.solutions.items.map((it) => (
                  <DrawerRow key={it.href} href={it.href} label={it.label} onClose={onClose} />
                ))}
              </ul>
            ) : null}
          </div>
          <Link href={NAV.platform.href} onClick={onClose} className="block py-3 text-base font-semibold">
            {NAV.platform.label}
          </Link>
          <Link href={NAV.pricing.href} onClick={onClose} className="block py-3 text-base font-semibold">
            {NAV.pricing.label}
          </Link>
          <div>
            <DrawerHead label={NAV.resources.label} open={sec === "resources"} onToggle={() => toggle("resources")} />
            {sec === "resources" ? (
              <ul className="pb-3">
                {NAV.resources.featured.map((f) => (
                  <DrawerRow key={f.href} href={f.href} label={f.label} onClose={onClose} />
                ))}
                {NAV.resources.links.map((l) => (
                  <DrawerRow key={l.href} href={l.href} label={l.label} onClose={onClose} />
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <DrawerHead label={NAV.why.label} open={sec === "why"} onToggle={() => toggle("why")} />
            {sec === "why" ? (
              <ul className="pb-3">
                {NAV.why.featured.map((f) => (
                  <DrawerRow key={f.href} href={f.href} label={f.label} onClose={onClose} />
                ))}
                {NAV.why.links.map((l) => (
                  <DrawerRow key={l.href} href={l.href} label={l.label} onClose={onClose} />
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Link href={NAV.cta.href} onClick={onClose} className={buttonClass("primary", "lg", "w-full")}>
            {NAV.cta.label}
          </Link>
          <Link href={signedIn ? "/dashboard" : NAV.signIn.href} onClick={onClose} className={buttonClass("outlineLight", "lg", "w-full")}>
            {signedIn ? "대시보드" : NAV.signIn.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
