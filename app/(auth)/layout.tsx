import Image from "next/image";

import { Logo } from "@/components/site/logo";
import { DELIVERY_DAYS } from "@/config/plans";

const CARDS = [
  { src: "/samples/tpl-shop.svg", label: "쇼핑몰" },
  { src: "/samples/tpl-cafe.svg", label: "카페 · 매장" },
  { src: "/samples/tpl-clinic.svg", label: "병원 · 클리닉" },
  { src: "/samples/tpl-portfolio.svg", label: "포트폴리오" },
];

/**
 * 로그인·회원가입 공통. 디자인 피클 로그인 화면처럼 왼쪽은 어두운 브랜드 패널(눈썹 라벨 + 큰 헤드라인 + 미리보기 카드 4개),
 * 오른쪽은 흰 폼 패널.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full flex-1 bg-ink-100 lg:grid-cols-[1.15fr_1fr] lg:gap-4 lg:p-4">
      <section className="relative hidden flex-col justify-between overflow-hidden rounded-3xl bg-night-950 p-10 text-white lg:flex">
        <div className="flex justify-center">
          <Logo light />
        </div>
        <div>
          <p className="eyebrow text-sky-400">AI 웹사이트 제작 · {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 완성</p>
          <h1 className="display mt-3 text-4xl xl:text-5xl">
            설명만 하면
            <br />
            웹사이트가 완성됩니다
          </h1>
          <div className="mt-8 grid grid-cols-4 gap-3">
            {CARDS.map((c) => (
              <div key={c.src}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-night-900">
                  <Image src={c.src} alt={c.label} fill className="object-cover" unoptimized />
                </div>
                <p className="mt-2 text-xs font-semibold text-white/80">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-white/50">
          <span>템플릿 또는 프롬프트</span>
          <span>네모 그려서 수정 요청</span>
          <span>AI 반영 + 전문가 수정</span>
          <span>월 29,000원부터</span>
        </div>
      </section>
      <section className="flex flex-col bg-white p-6 sm:p-10 lg:rounded-3xl">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </section>
    </div>
  );
}
