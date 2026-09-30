import { ArrowRightIcon, CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Carousel, FaqAccordion } from "@/components/marketing/interactive";
import { Arc, BigNumber, Container, DarkCard, Display, Eyebrow, Hero, Lead, LightCard, Photo, Pill, QuestionsCard, RecommendSection, SampleBadge, Section, Tag, TrustStrip } from "@/components/marketing/primitives";
import { HELP_FAQ, KEY_NUMBERS, SOLUTIONS, SOLUTION_BY_SLUG, TESTIMONIALS, ph } from "@/content/site";
import { PLAN_BY_CODE, formatKrw } from "@/config/plans";

/**
 * 솔루션 상세 (14개 공통 템플릿). 디자인 피클의 brand-and-identity 페이지 구성을 따른다:
 *   히어로(어두움) → 태그 알약 줄 → 신뢰 띠 → 특징 3카드(어두움) → 결과물 목록 + 사진(흰)
 *   → 숫자(흰) → 추천 플랜 + 후기 캐러셀(어두움) → FAQ(흰) → 궁금한 점(어두움) → 추천 읽을거리
 */

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const solution = SOLUTION_BY_SLUG[slug];
  if (!solution) return { title: "솔루션" };
  return { title: solution.name, description: solution.intro };
}

/** 솔루션 FAQ 뒤에 붙는 공통 질문 2개 (도움말 FAQ 에서) */
const GENERIC_FAQ = [HELP_FAQ[0].items[1], HELP_FAQ[1].items[0]];

export default async function SolutionPage({ params }: PageProps<"/solutions/[slug]">) {
  const { slug } = await params;
  const solution = SOLUTION_BY_SLUG[slug];
  if (!solution) notFound();

  const plan = PLAN_BY_CODE[solution.recommendedPlan];
  const faq = [...solution.faq, ...GENERIC_FAQ];
  const deliverablePhoto = ph("photo", SOLUTIONS.findIndex((s) => s.slug === solution.slug) + 1);

  return (
    <>
      <Hero eyebrow={solution.eyebrow} title={solution.headline} lead={solution.intro} primary={{ href: `/signup?plan=${solution.recommendedPlan}`, label: "시작하기" }} secondary={{ href: "/demo", label: "편집 화면 체험" }} image={solution.image} size="lg" />

      {/* 제공 항목 태그 줄 (가로 스크롤) + 신뢰 띠 */}
      <section className="bg-night-950 pb-16 text-white sm:pb-24">
        <Container>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {solution.tags.map((t) => (
              <span key={t} className="shrink-0">
                <Tag>
                  <CheckIcon className="mr-1.5 size-3 text-sky-400" />
                  {t}
                </Tag>
              </span>
            ))}
          </div>
          <div className="mt-14 border-t border-white/10 pt-12">
            <TrustStrip />
          </div>
        </Container>
      </section>

      {/* 잠금 해제 — 특징 3카드 */}
      <Section tone="dark" className="pt-0">
        <Container>
          <Eyebrow>준비 완료</Eyebrow>
          <Display className="mt-3 max-w-3xl">브랜드에 맞게 유지되는 제작</Display>
          <Lead className="mt-5 max-w-2xl">{solution.name}에 필요한 구조와 문구를 AI 가 먼저 잡고, 전문가가 브랜드 톤에 맞춰 마무리합니다.</Lead>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {solution.features.map((f, i) => (
              <DarkCard key={f.title} className="border border-white/10">
                <p className="text-sm font-bold text-sky-400">0{i + 1}</p>
                <h3 className="mt-4 text-xl font-bold">{f.title}</h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/60">{f.body}</p>
              </DarkCard>
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* 결과물 목록 + 사진 */}
      <Section tone="light" className="pt-6 sm:pt-10">
        <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow tone="light">작게 시작하거나 한 번에</Eyebrow>
            <Display className="mt-3">사람들이 알아보는 사이트</Display>
            <Lead tone="light" className="mt-5">
              {solution.short}. 플랜 안에서 필요한 페이지부터 시작하고, 규모가 커지면 플랜만 올리면 됩니다.
            </Lead>
            <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {solution.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-2.5 text-[15px] font-medium text-ink-900">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                    <CheckIcon className="size-3" />
                  </span>
                  {d}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Pill href={`/signup?plan=${solution.recommendedPlan}`} size="md">
                시작하기
              </Pill>
              <Pill href="/templates" variant="outline" size="md">
                템플릿 보기
              </Pill>
            </div>
          </div>
          <Photo img={deliverablePhoto} alt="" className="aspect-[4/5] w-full sm:aspect-[5/4] lg:aspect-[4/5]" />
        </Container>
      </Section>

      {/* 숫자로 보는 */}
      <Section tone="light" className="pt-0">
        <Container>
          <Eyebrow tone="light">숫자로 보는</Eyebrow>
          <Display className="mt-3">추정치가 아니라 실제 조건</Display>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {KEY_NUMBERS.map((n) => (
              <BigNumber key={n.value} value={n.value} body={n.body} />
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      {/* 추천 플랜 + 후기 */}
      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
            <div>
              <Eyebrow>추천 플랜</Eyebrow>
              <Display className="mt-3">{solution.name}에는 {plan.name}</Display>
              <Lead className="mt-5">{plan.tagline}. 월 단위 결제, 언제든 상위 플랜으로 바꿀 수 있습니다.</Lead>
            </div>
            <LightCard className="text-ink-900">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-2xl font-extrabold">{plan.name}</p>
                <p className="text-sm text-ink-500">{plan.tagline}</p>
              </div>
              <p className="mt-5 text-5xl font-extrabold tracking-tight text-brand-600">
                {formatKrw(plan.priceKrw)}
                <span className="ml-1 text-base font-semibold text-ink-500">/ 월</span>
              </p>
              <ul className="mt-6 space-y-2.5">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-ink-700">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Pill href="/pricing" size="md">
                  요금제 자세히 <ArrowRightIcon className="size-4" />
                </Pill>
                <Pill href={`/signup?plan=${plan.code}`} variant="outline" size="md">
                  이 플랜으로 시작
                </Pill>
              </div>
            </LightCard>
          </div>

          <div className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>고객 후기</Eyebrow>
                <Display size="md" className="mt-3">
                  먼저 써 본 분들의 이야기
                </Display>
              </div>
              <p className="text-xs text-white/50">
                <SampleBadge className="mr-1.5" />
                샘플 후기입니다. 실제 고객 후기로 교체하세요.
              </p>
            </div>
            <div className="mt-10">
              <Carousel>
                {TESTIMONIALS.map((t) => (
                  <DarkCard key={t.storySlug} className="flex h-full flex-col border border-white/10">
                    <p className="text-4xl font-extrabold tracking-tight text-sky-400">{t.metric}</p>
                    <p className="mt-1 text-xs text-white/50">{t.metricLabel}</p>
                    <p className="mt-6 flex-1 text-lg leading-relaxed">“{t.quote}”</p>
                    <div className="mt-8 flex items-center gap-3">
                      <Image src={t.avatar.src} alt="" width={40} height={40} className="size-10 rounded-full object-cover" unoptimized />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{t.name}</p>
                        <p className="text-xs text-white/50">{t.role}</p>
                      </div>
                      <SampleBadge />
                    </div>
                  </DarkCard>
                ))}
              </Carousel>
            </div>
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* FAQ */}
      <Section tone="light" className="pt-6 sm:pt-10">
        <Container className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <Eyebrow tone="light">자주 묻는 질문</Eyebrow>
            <Display size="md" className="mt-3">
              {solution.name}, 궁금한 것
            </Display>
          </div>
          <div className="mt-8 lg:mt-0">
            <FaqAccordion items={faq} />
          </div>
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <QuestionsCard />
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
