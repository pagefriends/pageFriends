import type { Metadata } from "next";
import Link from "next/link";

import { PlanGrid } from "@/components/pricing/plan-grid";
import { buttonClass } from "@/components/ui/button";
import { BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW, CREDIT_PACKS, DELIVERY_DAYS, REQUEST_KIND_LABEL, TEMPLATE_PRICE_KRW, creditAmountLabel, formatKrw } from "@/config/plans";

export const metadata: Metadata = { title: "요금제" };

/** 디자인 피클 pricing 페이지 구성: 어두운 히어로 → 플랜 → "다 들어 있습니다" 항목 그리드 → FAQ */
const LOADED: { group: string; items: { title: string; body: string }[] }[] = [
  {
    group: "제작",
    items: [
      { title: "템플릿 또는 프롬프트", body: "완성 디자인을 가져오거나, 글로만 설명해도 됩니다." },
      { title: `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 첫 완성본`, body: "필수 정보 입력이 끝나면 제작이 시작됩니다." },
      { title: "페이지별 캡처", body: "홈 · 안내 · 리뷰 · 상품 · 관리자페이지를 탭으로 오갑니다." },
      { title: "디바이스별 화면", body: "모바일 · 태블릿 · 웹 (플랜에 따라)." },
    ],
  },
  {
    group: "수정",
    items: [
      { title: "네모 그려서 요청", body: "캡처 위에 빨간 네모를 그리고 번호별로 적습니다." },
      { title: "AI 반영", body: "문구·색·배치 같은 변경은 AI 가 바로 반영합니다." },
      { title: "전문가 요청", body: "사진 교체, 구조 변경처럼 사람이 필요한 작업." },
      { title: "요청 내역 · 답변", body: "접수 · 처리중 · 반영 완료 상태와 답변을 한 화면에서." },
    ],
  },
  {
    group: "결제 · 운영",
    items: [
      { title: "월 단위 결제", body: "포트원(토스페이먼츠) 카드 자동 결제. 언제든 해지." },
      { title: "추가 크레딧", body: "AI 토큰·전문가 횟수를 다 쓰면 추가 구매. 만료 없음. 오류 신고는 무료." },
      { title: "결제 시스템 옵션", body: `비즈니스 플랜에서 선택. 첫 달 ${formatKrw(BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW)}.` },
      { title: "플랜 변경", body: "규모가 커지면 상위 플랜으로 바로 전환." },
    ],
  },
];

const FAQ = [
  {
    q: "주간 요청 횟수를 다 쓰면 어떻게 되나요?",
    a: `추가 크레딧을 구매해 이어갈 수 있습니다. ${REQUEST_KIND_LABEL.ai} ${formatKrw(CREDIT_PACKS[0].priceKrw)}(${creditAmountLabel(CREDIT_PACKS[0])}) · ${formatKrw(CREDIT_PACKS[1].priceKrw)}(${creditAmountLabel(CREDIT_PACKS[1])}), ${REQUEST_KIND_LABEL.expert} ${formatKrw(CREDIT_PACKS[2].priceKrw)}(1회) · ${formatKrw(CREDIT_PACKS[3].priceKrw)}(10회). 크레딧은 만료되지 않습니다. 우리 쪽 오류를 신고하는 '오류 신고'는 무료입니다.`,
  },
  {
    q: "비즈니스 플랜의 결제 시스템 옵션은 무엇인가요?",
    a: `쇼핑몰처럼 사이트 안에서 결제를 받아야 할 때 켭니다. 결제 연동 초기 구축 비용이 포함되어 첫 달만 ${formatKrw(BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW)}이 청구되고, 다음 달부터는 월 89,000원입니다.`,
  },
  {
    q: "템플릿은 꼭 사야 하나요?",
    a: `아니요. 템플릿 없이 프롬프트만으로 진행할 수 있습니다. 템플릿은 데모 사이트 ${formatKrw(TEMPLATE_PRICE_KRW.demo)}, 운영 사이트(소유자 동의) ${formatKrw(TEMPLATE_PRICE_KRW.live)}이며 플랜과 별도로 1회 결제합니다.`,
  },
  {
    q: "언제든 해지할 수 있나요?",
    a: "네. 해지하면 현재 결제 기간이 끝날 때까지 그대로 이용하고 그 뒤로는 결제되지 않습니다. 기간 안에는 해지를 취소할 수 있습니다.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-night-950 text-white">
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 lg:pt-24">
          <p className="eyebrow text-sky-400">투명한 요금</p>
          <h1 className="display mt-4 max-w-4xl text-[44px] sm:text-6xl">
            플랜은 4개.
            <br />
            숨은 비용은 없습니다.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/70">
            모든 플랜은 월 단위이고 언제든 상위 플랜으로 바꿀 수 있습니다. 주간 요청 한도를 넘는 건은 건당 추가 결제로 이어갑니다.
          </p>
          <div className="mt-12">
            <PlanGrid tone="dark" ctaHref={(code) => `/signup?plan=${code}`} />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-brand-600">다 들어 있습니다</p>
          <h2 className="display mt-3 max-w-3xl text-4xl sm:text-5xl">제작부터 수정, 결제까지 한 구독으로</h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            {LOADED.map((g) => (
              <div key={g.group}>
                <p className="eyebrow border-b border-ink-200 pb-3 text-ink-500">{g.group}</p>
                <ul className="mt-4 divide-y divide-ink-100">
                  {g.items.map((i) => (
                    <li key={i.title} className="py-3.5">
                      <p className="font-semibold">{i.title}</p>
                      <p className="mt-0.5 text-[13px] text-ink-500">{i.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-brand-600">추가 크레딧</p>
            <h2 className="display mt-3 text-3xl">한도를 넘으면 건당</h2>
            <p className="mt-2 text-sm text-ink-500">플랜 한도를 넘는 사용은 크레딧에서 차감됩니다. 만료 없음. AI 는 토큰, 전문가는 횟수 단위입니다.</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs text-ink-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">종류</th>
                    <th className="px-5 py-2.5 font-medium">횟수</th>
                    <th className="px-5 py-2.5 text-right font-medium">가격</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_PACKS.map((p) => (
                    <tr key={p.code} className="border-t border-ink-100">
                      <td className="px-5 py-3">{REQUEST_KIND_LABEL[p.kind]}</td>
                      <td className="px-5 py-3">{creditAmountLabel(p)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatKrw(p.priceKrw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="eyebrow text-brand-600">템플릿</p>
            <h2 className="display mt-3 text-3xl">플랜과 별도로 1회</h2>
            <p className="mt-2 text-sm text-ink-500">구매한 템플릿은 여러 프로젝트에 쓸 수 있습니다.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink-200 bg-white p-6">
                <p className="eyebrow text-ink-500">데모 사이트</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{formatKrw(TEMPLATE_PRICE_KRW.demo)}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-600">완성된 디자인이 적용된 임시 사이트. 구조와 스타일을 그대로 가져옵니다.</p>
              </div>
              <div className="rounded-2xl border border-brand-600 bg-white p-6 ring-1 ring-brand-600">
                <p className="eyebrow text-brand-600">운영 사이트</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{formatKrw(TEMPLATE_PRICE_KRW.live)}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-600">실제 서비스 중인 사이트로, 소유자 동의를 받은 것만 제공합니다. 검증된 구성.</p>
              </div>
            </div>
            <Link href="/templates" className={buttonClass("dark", "md", "mt-6")}>
              템플릿 둘러보기
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="eyebrow text-brand-600">FAQ</p>
            <h2 className="display mt-3 text-4xl">자주 묻는 질문</h2>
          </div>
          <dl className="mt-8 divide-y divide-ink-200 lg:mt-0">
            {FAQ.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="text-lg font-bold">{f.q}</dt>
                <dd className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
