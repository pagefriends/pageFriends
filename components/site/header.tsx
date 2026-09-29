import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { getSessionUser } from "@/lib/auth/session";

const NAV = [
  { href: "/templates", label: "템플릿" },
  { href: "/pricing", label: "요금제" },
  { href: "/demo", label: "편집 화면 체험" },
] as const;

/** 공개 페이지 상단 바. 디자인 피클처럼 어두운 바탕 + 오른쪽 끝에 액센트 알약 CTA. */
export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-30 bg-night-950 text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo light />
          <nav className="hidden items-center gap-7 text-[14px] text-white/80 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className={buttonClass("primary", "sm")}>
              대시보드
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-[14px] text-white/80 hover:text-white sm:inline">
                로그인
              </Link>
              <Link href="/signup" className={buttonClass("primary", "sm")}>
                무료로 시작
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "서비스",
    links: [
      { href: "/templates", label: "템플릿" },
      { href: "/templates?kind=live", label: "운영 사이트 템플릿" },
      { href: "/pricing", label: "요금제" },
      { href: "/demo", label: "편집 화면 체험" },
    ],
  },
  {
    title: "만드는 사이트",
    links: [
      { href: "/templates", label: "홈페이지 · 소개" },
      { href: "/templates", label: "쇼핑몰" },
      { href: "/templates", label: "예약 · 문의" },
      { href: "/pricing", label: "개인 앱 (엔터프라이즈)" },
    ],
  },
  {
    title: "계정",
    links: [
      { href: "/login", label: "로그인" },
      { href: "/signup", label: "회원가입" },
      { href: "/dashboard", label: "내 사이트" },
      { href: "/billing", label: "플랜 · 결제" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-night-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            템플릿 또는 프롬프트만으로 시작해 3~7일 안에 완성되는 AI 웹사이트 제작 서비스. 완성 화면 위에 네모를 그려 수정을 요청하세요.
          </p>
          <dl className="mt-6 flex flex-col gap-1.5 text-sm text-white/60">
            <div className="flex gap-2">
              <dt className="text-white/40">문의</dt>
              <dd>help@pagefriends.kr</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-white/40">운영</dt>
              <dd>평일 10:00 ~ 18:00</dd>
            </div>
          </dl>
        </div>
        {FOOTER_COLS.map((c) => (
          <div key={c.title}>
            <p className="eyebrow text-sky-300">{c.title}</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-white/70">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* 디자인 피클의 라임 하단 바 → 하늘색 하단 바 */}
      <div className="bg-sky-400 text-night-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-semibold">© {new Date().getFullYear()} 페이지프렌즈</span>
          <div className="flex gap-5">
            <span>이용약관</span>
            <span>개인정보처리방침</span>
            <span>사업자 정보</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
