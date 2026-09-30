import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StoryCard } from "@/components/marketing/content-cards";
import { Arc, BigNumber, Container, Display, Eyebrow, Lead, Photo, Pill, RecommendSection, SampleBadge, Section, Tag } from "@/components/marketing/primitives";
import { INDUSTRIES, SOLUTION_BY_SLUG, STORIES, STORY_BY_SLUG } from "@/content/site";

/** 고객 사례 상세 */

const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(INDUSTRIES.map((i) => [i.key, i.label]));

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/customer-stories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = STORY_BY_SLUG[slug];
  if (!story) return { title: "고객 사례" };
  return { title: `${story.company} — ${story.headline}`, description: story.summary };
}

export default async function CustomerStoryPage({ params }: PageProps<"/customer-stories/[slug]">) {
  const { slug } = await params;
  const story = STORY_BY_SLUG[slug];
  if (!story) notFound();

  const solution = SOLUTION_BY_SLUG[story.solution];
  const sameIndustry = STORIES.filter((s) => s.slug !== story.slug && s.industry === story.industry);
  const others = STORIES.filter((s) => s.slug !== story.slug && s.industry !== story.industry);
  const related = [...sameIndustry, ...others].slice(0, 3);

  return (
    <>
      {/* 머리 */}
      <section className="bg-night-950 text-white">
        <Container className="pt-12 pb-14 sm:pt-16 sm:pb-20">
          <Link href="/customer-stories" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
            <ArrowLeftIcon className="size-4" /> 고객 사례
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Image src={story.logo.src} alt={`${story.company} 로고 (임시)`} width={120} height={45} className="h-7 w-auto" unoptimized />
            <Tag>{INDUSTRY_LABEL[story.industry] ?? story.industry}</Tag>
            {solution ? <Tag>{solution.name}</Tag> : null}
            {story.sample ? <SampleBadge className="text-white/70" /> : null}
          </div>
          <Eyebrow className="mt-8">{story.company}</Eyebrow>
          <Display as="h1" size="lg" className="mt-4 max-w-4xl">
            {story.headline}
          </Display>
          <Lead className="mt-6 max-w-2xl">{story.summary}</Lead>
        </Container>
      </section>

      <Arc from="dark" to="light" />

      {/* 숫자 3개 */}
      <Section tone="light" className="pt-4 sm:pt-6">
        <Container>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {story.metrics.slice(0, 3).map((m) => (
              <BigNumber key={m.label} value={m.value} body={m.label} />
            ))}
          </div>
        </Container>
      </Section>

      {/* 인용 + 본문 + 사진 */}
      <Section tone="light" className="pt-0">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <blockquote className="rounded-2xl bg-night-950 p-8 text-white sm:p-10">
              <p className="text-2xl font-bold leading-snug sm:text-3xl">“{story.quote}”</p>
              <footer className="mt-6 text-sm text-white/60">— {story.quoteBy}</footer>
            </blockquote>
            <div className="mt-10 max-w-3xl space-y-5 text-[17px] leading-relaxed text-ink-700">
              {story.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {solution ? (
              <p className="mt-8 text-sm text-ink-500">
                이 사례에 쓴 솔루션:{" "}
                <Link href={`/solutions/${solution.slug}`} className="font-semibold text-brand-600 hover:underline">
                  {solution.name}
                </Link>
              </p>
            ) : null}
          </div>
          <Photo img={story.image} alt="" className="aspect-[4/3] w-full lg:sticky lg:top-24 lg:aspect-[4/5]" />
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      {/* 같은 업종 사례 */}
      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>같은 업종 사례</Eyebrow>
              <Display className="mt-3">
                {INDUSTRY_LABEL[story.industry] ?? story.industry} 팀들은 이렇게 시작했습니다
              </Display>
            </div>
            <Pill href="/consultation" className="shrink-0">
              상담 신청
            </Pill>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <StoryCard key={s.slug} story={s} className="text-ink-900" />
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
