import { ArrowRightIcon, CompassIcon, LayoutTemplateIcon, RefreshCwIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, BigNumber, Container, DarkCard, Display, Eyebrow, Hero, Lead, Photo, Pill, Section } from "@/components/marketing/primitives";
import { Closing } from "@/components/marketing/sections";
import { DELIVERY_DAYS } from "@/config/plans";
import { COMMAND_STEPS, HELP_FAQ, KEY_NUMBERS } from "@/content/site";

export const metadata: Metadata = { title: "이용 방법 — 묻지 말고 그냥 시작하세요" };

/**
 * 이용 방법. 디자인 피클 /how-design-pickle-works 구성:
 * 가운데 히어로 → "무엇이 궁금하세요?" 4가지 갈래 → 4단계 타임라인 → FAQ → 숫자 → 질문 카드 → 추천
 */

const JOURNEYS: { icon: LucideIcon; title: string; body: string; href: string; cta: string }[] = [
  { icon: CompassIcon, title: "처음이에요", body: "사이트를 처음 만듭니다. 무엇부터 해야 하는지, 어떤 플랜이 맞는지 알고 싶어요.", href: "/pricing", cta: "플랜 살펴보기" },
  { icon: LayoutTemplateIcon, title: "템플릿으로", body: "완성된 디자인을 가져와서 내 내용만 넣고 싶어요. 데모 1,000원, 운영 사이트 8,900원.", href: "/templates", cta: "템플릿 보기" },
  { icon: SparklesIcon, title: "프롬프트로", body: "템플릿 없이 글로만 설명할게요. AI 가 구조 · 문구 · 디자인 초안을 만듭니다.", href: "/solutions/ai-site", cta: "AI 제작 알아보기" },
  { icon: RefreshCwIcon, title: "이미 사이트가 있어요", body: "지금 사이트를 새로 만들거나 옮기고 싶어요. 참고 사이트로 첨부하면 구조를 이어갑니다.", href: "/consultation", cta: "상담 신청" },
];

const FAQ = HELP_FAQ.flatMap((g) => g.items).slice(0, 5);

export default function HowItWorksPage() {
  return (
    <>
      <Hero center size="lg" eyebrow="제작 솔루션" title="묻지 말고 그냥 시작하세요" lead={`견적 · 미팅 · 계약서 없이 5분 안에 시작합니다. 필수 정보를 입력하면 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 첫 완성본이 올라오고, 고칠 곳은 네모를 그려 요청합니다.`} primary={{ href: "/signup", label: "시작하기" }} secondary={{ href: "/demo", label: "편집 화면 체험" }} />

      {/* 무엇이 궁금하세요? */}
      <Section tone="dark" className="pt-0 sm:pt-0">
        <Container>
          <Eyebrow>무엇이 궁금하세요?</Eyebrow>
          <Display className="mt-3 max-w-3xl">지금 상황에 맞는 길을 고르세요</Display>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {JOURNEYS.map((j) => (
              <Link key={j.title} href={j.href} className="group block">
                <DarkCard className="flex h-full flex-col transition-colors group-hover:bg-night-800">
                  <span className="grid size-12 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                    <j.icon className="size-6" />
                  </span>
                  <h2 className="mt-6 text-2xl font-bold sm:text-3xl">{j.title}</h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/60">{j.body}</p>
                  <p className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold text-sky-400">
                    {j.cta} <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </DarkCard>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* 4단계 타임라인 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">브리프. 확인. 네모. 완성.</Eyebrow>
          <Display className="mt-3 max-w-3xl">시작부터 운영까지 네 단계</Display>
          <ol className="mt-12 space-y-12 sm:space-y-16">
            {COMMAND_STEPS.map((s, i) => (
              <li key={s.n} className="relative grid gap-6 pl-14 sm:pl-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
                {/* 세로 선 + 번호 */}
                {i < COMMAND_STEPS.length - 1 ? <span className="absolute top-12 bottom-[-3rem] left-5 w-px bg-ink-200 sm:left-6 sm:bottom-[-4rem]" aria-hidden /> : null}
                <span className="absolute top-0 left-0 grid size-10 place-items-center rounded-full bg-brand-600 text-sm font-extrabold text-white sm:size-12 sm:text-base">{s.n}</span>
                <div>
                  <h3 className="text-2xl font-bold sm:text-3xl">{s.title}</h3>
                  <Lead tone="light" className="mt-3 text-base sm:text-lg">
                    {s.body}
                  </Lead>
                </div>
                <Photo img={s.image} alt="" className="aspect-[16/10]" />
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-wrap gap-3">
            <Pill href="/signup">시작하기</Pill>
            <Pill href="/platform" variant="outline">
              플랫폼 자세히
            </Pill>
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

      {/* 숫자 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">조건은 이렇습니다</Eyebrow>
          <Display className="mt-3">숫자로 보는 페이지프렌즈</Display>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {KEY_NUMBERS.map((n) => (
              <BigNumber key={n.value} value={n.value} body={n.body} />
            ))}
          </div>
        </Container>
      </Section>

      <Closing arcFrom="light" />
    </>
  );
}
