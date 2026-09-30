import { ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, Container, Display, Eyebrow, LightCard, Photo, Section, TrustStrip } from "@/components/marketing/primitives";
import { ConsultationForm } from "@/components/site/consultation-form";
import { DELIVERY_DAYS, PLANS, formatKrw } from "@/config/plans";
import { SOLUTIONS, ph } from "@/content/site";

export const metadata: Metadata = { title: "상담 신청" };

/**
 * 상담 신청. 디자인 피클 /design-pickle-consultation 구성:
 *   2단(왼쪽 글 + 아바타, 오른쪽 흰 폼 카드, 어두움) → 진행 순서 01/02/03 + 신뢰 띠(흰) → FAQ(어두움)
 */
const STEPS = [
  { n: "01", title: "30분 통화", body: "만들고 싶은 사이트, 업종, 일정, 예산을 듣습니다. 준비할 것은 없습니다. 참고 사이트가 있으면 더 좋습니다." },
  { n: "02", title: "통화 후 맞춤 플랜", body: "어떤 플랜과 옵션이 맞는지, 페이지 구성은 어떻게 할지 정리해 이메일로 보내드립니다." },
  { n: "03", title: "결정은 당신이", body: "계약서도, 압박도 없습니다. 마음이 정해지면 회원가입 후 플랜을 고르면 바로 제작이 시작됩니다." },
];

const FAQ = [
  { q: "상담에 비용이 드나요?", a: "아니요. 상담은 무료이고, 상담 후 가입 의무도 없습니다." },
  { q: "제작은 얼마나 걸리나요?", a: `필수 정보 입력 후 첫 완성본까지 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일입니다. 상담에서 일정을 먼저 맞출 수 있습니다.` },
  { q: "중간에 해지할 수 있나요?", a: "네. 언제든 해지할 수 있고, 현재 결제 기간이 끝날 때까지 이용한 뒤 더 이상 결제되지 않습니다." },
  { q: "사이트 소유권은 누구에게 있나요?", a: "완성된 사이트의 콘텐츠와 디자인 소유권은 고객에게 있습니다. 도메인도 고객 명의로 연결합니다." },
];

export default function ConsultationPage() {
  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="grid gap-12 pt-16 pb-16 sm:pt-24 sm:pb-24 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <Eyebrow>무료 상담</Eyebrow>
            <Display as="h1" size="xl" className="mt-4">
              제작 전략을
              <br />
              이야기해요
            </Display>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Photo key={i} img={ph("avatar", i)} alt="" className="size-11 rounded-full border-2 border-night-950" sizes="44px" />
                ))}
              </div>
              <Link href="/our-people" className="inline-flex items-center gap-1 text-sm font-semibold text-sky-300 hover:text-sky-200">
                팀 만나기 <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-white/70">
              어떤 사이트가 필요한지 아직 정리되지 않아도 괜찮습니다. 30분 통화에서 업종과 목적을 듣고, 페이지 구성과 맞는 플랜을 정리해 드립니다. 월 {formatKrw(PLANS[0].priceKrw)}부터 시작하는 4개 플랜 중 무엇이 맞는지, 결제 시스템이나 CMS 가 필요한지도 이때 정합니다.
            </p>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/70">
              상담은 영업이 아니라 설계입니다. 통화 뒤에 맞춤 플랜을 이메일로 보내드리고, 결정은 천천히 하셔도 됩니다.
            </p>
          </div>

          <LightCard className="text-ink-900 shadow-xl">
            <h2 className="text-2xl font-extrabold tracking-tight">일정을 잡아드릴게요</h2>
            <p className="mt-2 text-sm text-ink-500">영업일 기준 1일 안에 통화 가능한 시간을 이메일로 안내합니다.</p>
            <div className="mt-6">
              <ConsultationForm siteTypes={SOLUTIONS.map((s) => s.name)} />
            </div>
          </LightCard>
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* 진행 순서 + 신뢰 띠 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">어떻게 진행되나요</Eyebrow>
          <Display className="mt-3">세 단계면 끝납니다</Display>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t-2 border-brand-600 pt-6">
                <p className="text-sm font-bold text-brand-600">{s.n}</p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-20">
            <TrustStrip tone="light" />
          </div>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* FAQ */}
      <Section tone="dark">
        <Container className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <Eyebrow>자주 묻는 질문</Eyebrow>
            <Display className="mt-3">상담 전에 궁금한 것</Display>
          </div>
          <div className="mt-8 lg:mt-0">
            <FaqAccordion items={FAQ} tone="dark" />
          </div>
        </Container>
      </Section>
    </>
  );
}
