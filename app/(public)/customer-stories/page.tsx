import type { Metadata } from "next";

import { FilterPills, ResourceCard, StoryCard } from "@/components/marketing/content-cards";
import { Arc, Container, Display, Eyebrow, Hero, Lead, QuestionsCard, RecommendSection, SampleBadge, Section } from "@/components/marketing/primitives";
import { INDUSTRIES, RESOURCES, STORIES, type IndustryKey } from "@/content/site";

/** 고객 사례 목록 (디자인 피클의 customer-stories). 업종 필터 + 사례 카드 + 온디맨드 콘텐츠 */

export const metadata: Metadata = { title: "고객 사례", description: "페이지프렌즈로 사이트를 만든 소상공인 · 스타트업 · 에이전시의 이야기." };

const INDUSTRY_KEYS = new Set<string>(INDUSTRIES.map((i) => i.key));
const WEBINARS = RESOURCES.filter((r) => r.category === "webinar");

export default async function CustomerStoriesPage({ searchParams }: PageProps<"/customer-stories">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = raw && INDUSTRY_KEYS.has(raw) ? (raw as IndustryKey) : undefined;
  const stories = category ? STORIES.filter((s) => s.industry === category) : STORIES;

  return (
    <>
      <Hero eyebrow="고객 사례" title="실전에서 증명된 결과" lead="동네 카페부터 에이전시까지. 페이지프렌즈로 사이트를 만들고 운영하는 팀들이 어떻게 시작했고 무엇이 달라졌는지 보세요." size="lg" />

      <section className="bg-night-950 pb-10 text-white sm:pb-14">
        <Container>
          <FilterPills basePath="/customer-stories" active={category} items={INDUSTRIES.map((i) => ({ key: i.key, label: i.label }))} />
        </Container>
      </section>

      <Arc from="dark" to="light" />

      <Section tone="light" className="pt-4 sm:pt-6">
        <Container>
          <p className="text-xs text-ink-500">
            <SampleBadge className="mr-1.5" />
            아래 사례는 샘플입니다. 실제 고객 사례로 교체하세요.
          </p>
          {stories.length ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((s) => (
                <StoryCard key={s.slug} story={s} />
              ))}
            </div>
          ) : (
            <p className="mt-10 text-sm text-ink-500">해당 업종의 사례가 아직 없습니다.</p>
          )}
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      {/* 온디맨드 콘텐츠 */}
      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <Eyebrow>온디맨드 콘텐츠</Eyebrow>
          <Display className="mt-3">웨비나 · 이벤트 다시 보기</Display>
          <Lead className="mt-4 max-w-2xl">편집기 사용법부터 사이트 운영 팁까지. 시간 날 때 보세요.</Lead>
          {WEBINARS.length ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {WEBINARS.map((r) => (
                <ResourceCard key={r.slug} resource={r} className="text-ink-900" />
              ))}
            </div>
          ) : (
            <p className="mt-8 text-sm text-white/60">등록된 웨비나가 아직 없습니다.</p>
          )}
          <div className="mt-16">
            <QuestionsCard />
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
