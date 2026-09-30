import { QuoteIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, Container, Display, Eyebrow, Lead, Pill, SampleBadge, Section } from "@/components/marketing/primitives";
import { Closing } from "@/components/marketing/sections";
import { PlanGrid } from "@/components/pricing/plan-grid";
import { BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW, CREDIT_PACKS, DELIVERY_DAYS, REQUEST_KIND_LABEL, TEMPLATE_PRICE_KRW, creditAmountLabel, formatKrw } from "@/config/plans";
import { TESTIMONIALS } from "@/content/site";

export const metadata: Metadata = { title: "요금제" };

/**
 * 디자인 피클 pricing 페이지 구성:
 * 어두운 히어로 + 플랜 4장 → 인용 → HOW IT WORKS 01/02/03 → "다 들어 있습니다" 4열 → 추가 크레딧 · 템플릿 → FAQ → 질문 카드 → 추천
 */
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
  {
    group: "지원",
    items: [
      { title: "실시간 채팅", body: "평일 10:00~18:00 사람이 답합니다." },
      { title: "오류 신고 무료", body: "우리 쪽 실수는 토큰 · 횟수 어디에서도 차감하지 않습니다." },
      { title: "도움말 센터", body: "시작하기 · 수정 요청 · 요금 FAQ 를 언제든." },
      { title: "전담 매니저", body: "엔터프라이즈 플랜은 처음부터 끝까지 함께." },
    ],
  },
];

const FAQ = [
  {
    q: "AI 토큰이나 전문가 요청 횟수를 다 쓰면 어떻게 되나요?",
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

const HOW = [
  { n: "01", title: "플랜을 고르고 시작", body: "회원가입 후 플랜을 고르면 바로 제작에 들어갑니다. 템플릿은 선택 사항이고, 프롬프트만으로도 됩니다." },
  { n: "02", title: `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 뒤 첫 완성본`, body: "대시보드에 페이지별 · 디바이스별 캡처가 올라옵니다. 네모를 그려 고칠 곳을 표시하고 한 번에 요청합니다." },
  { n: "03", title: "쓴 만큼만, 넘으면 크레딧", body: "AI 는 실제 쓴 토큰만큼 차감되고 결제 기간마다 초기화됩니다. 한도를 넘으면 만료 없는 크레딧으로 이어갑니다." },
];

const QUOTE = TESTIMONIALS[3];

export default function PricingPage() {
  return (
    <>
      {/* 히어로 + 플랜 */}
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-16 sm:pt-24 sm:pb-20">
          <Eyebrow>요금제</Eyebrow>
          <Display as="h1" size="xl" className="mt-4 max-w-5xl">
            문제를 말하세요.
            <br />
            플랜을 가져가세요.
          </Display>
          <Lead className="mt-6 max-w-2xl">플랜은 4개, 숨은 비용은 없습니다. 모든 플랜은 월 단위이고 언제든 상위 플랜으로 바꿀 수 있습니다. AI 는 실제 사용한 토큰만큼만 차감됩니다.</Lead>
          <div className="mt-12">
            <PlanGrid tone="dark" ctaHref={(code) => `/signup?plan=${code}`} />
          </div>
        </Container>
      </section>

      {/* 인용 */}
      <Section tone="dark" className="border-t border-white/10 py-14 sm:py-20">
        <Container className="max-w-4xl text-center">
          <QuoteIcon className="mx-auto size-8 text-sky-400" />
          <p className="mt-6 text-2xl font-bold leading-snug sm:text-3xl">&ldquo;{QUOTE.quote}&rdquo;</p>
          <p className="mt-5 text-sm text-white/60">
            {QUOTE.name} · {QUOTE.role} <SampleBadge className="ml-2" />
          </p>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* HOW IT WORKS */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">HOW IT WORKS</Eyebrow>
          <Display className="mt-3 max-w-3xl">무엇을 기대할 수 있나</Display>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {HOW.map((h) => (
              <li key={h.n} className="border-t-2 border-brand-600 pt-6">
                <p className="text-sm font-extrabold text-brand-600">{h.n}</p>
                <h3 className="mt-2 text-xl font-bold sm:text-2xl">{h.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{h.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Pill href="/how-it-works" variant="outline" size="md">
              이용 방법 자세히
            </Pill>
          </div>
        </Container>
      </Section>

      {/* 다 들어 있습니다 */}
      <Section tone="gray">
        <Container>
          <Eyebrow tone="light">다 들어 있습니다</Eyebrow>
          <Display className="mt-3 max-w-3xl">제작부터 수정, 결제, 지원까지 한 구독으로</Display>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {LOADED.map((g) => (
              <div key={g.group}>
                <p className="eyebrow border-b border-ink-300 pb-3 text-ink-500">{g.group}</p>
                <ul className="mt-4 divide-y divide-ink-200">
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
        </Container>
      </Section>

      {/* 추가 크레딧 · 템플릿 */}
      <Section tone="light">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow tone="light">추가 크레딧</Eyebrow>
            <Display size="sm" className="mt-3">
              한도를 넘으면 추가로
            </Display>
            <p className="mt-2 text-sm text-ink-500">플랜 한도를 넘는 사용은 크레딧에서 차감됩니다. 만료 없음. AI 는 토큰, 전문가는 횟수 단위입니다.</p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-left text-xs text-ink-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">종류</th>
                    <th className="px-5 py-2.5 font-medium">수량</th>
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
            <Eyebrow tone="light">템플릿</Eyebrow>
            <Display size="sm" className="mt-3">
              플랜과 별도로 1회
            </Display>
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
            <div className="mt-6">
              <Pill href="/templates" variant="dark" size="md">
                템플릿 둘러보기
              </Pill>
            </div>
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section tone="gray">
        <Container className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <Eyebrow tone="light">FAQ</Eyebrow>
            <Display className="mt-3">자주 묻는 질문</Display>
            <p className="mt-3 text-sm text-ink-500">
              더 많은 질문은{" "}
              <Link href="/help" className="font-semibold text-brand-600 hover:underline">
                도움말 센터
              </Link>
              에서.
            </p>
          </div>
          <div className="mt-8 lg:mt-0">
            <FaqAccordion items={FAQ} />
          </div>
        </Container>
      </Section>

      <Closing arcFrom="gray" />
    </>
  );
}
