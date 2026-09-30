import { ActivityIcon, CircleHelpIcon, MailIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { NewsletterForm } from "@/components/site/newsletter-form";
import { Logo } from "@/components/site/logo";
import { FOOTER_COLUMNS, LEGAL_LINKS, SUPPORT } from "@/content/site";

const SOCIAL = [
  { label: "Facebook", href: "#", glyph: "f" },
  { label: "X", href: "#", glyph: "X" },
  { label: "LinkedIn", href: "#", glyph: "in" },
  { label: "Instagram", href: "#", glyph: "ig" },
  { label: "YouTube", href: "#", glyph: "▶" },
  { label: "TikTok", href: "#", glyph: "tt" },
];

/** 디자인 피클식 푸터: 뉴스레터 + SNS / 4열 링크 + 도움말 / 하늘색 하단 바 */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-night-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 border-b border-white/10 pb-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-md">
            <p className="text-sm font-semibold">뉴스레터 구독</p>
            <p className="mt-1 text-xs text-white/50">새 글과 제품 소식을 보내드립니다. 광고는 보내지 않습니다.</p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/50">팔로우</span>
            <ul className="flex gap-2">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a href={s.href} aria-label={s.label} className="grid size-9 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white/80 hover:bg-white/20">
                    {s.glyph}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-10 pt-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          {FOOTER_COLUMNS.map((col, i) => (
            <div key={col.title} className={i === 0 ? "sm:row-span-2" : undefined}>
              <p className="eyebrow border-b border-white/15 pb-3 text-white">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/70">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {i === 0 ? (
                <div className="mt-10">
                  <p className="eyebrow border-b border-white/15 pb-3 text-white">도움이 필요하세요?</p>
                  <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/70">
                    <li className="flex items-center gap-2">
                      <MailIcon className="size-4 text-white/40" />
                      <a href={`mailto:${SUPPORT.email}`} className="hover:text-white">
                        {SUPPORT.email}
                      </a>
                    </li>
                    <li className="flex items-center gap-2">
                      <PhoneIcon className="size-4 text-white/40" />
                      <span>
                        {SUPPORT.phone} <span className="text-white/40">· {SUPPORT.hours}</span>
                      </span>
                    </li>
                    {SUPPORT.links.map((l, j) => (
                      <li key={l.href} className="flex items-center gap-2">
                        {[<MessageSquareIcon key="a" className="size-4 text-white/40" />, <CircleHelpIcon key="b" className="size-4 text-white/40" />, <ActivityIcon key="c" className="size-4 text-white/40" />][j]}
                        <Link href={l.href} className="hover:text-white">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* 하늘색 하단 바 (디자인 피클의 라임 바) */}
      <div className="bg-sky-400 text-night-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="font-semibold">© {new Date().getFullYear()} 페이지프렌즈</span>
          </div>
          <div className="flex flex-wrap gap-5 font-medium">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:underline">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
