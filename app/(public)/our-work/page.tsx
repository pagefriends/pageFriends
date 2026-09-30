import type { Metadata } from "next";

import { FilterPills, WorkCard, type WorkItem } from "@/components/marketing/content-cards";
import { Arc, Container, Display, Eyebrow, Hero, Lead, Pill, RecommendSection, SampleBadge, Section } from "@/components/marketing/primitives";
import { SOLUTIONS, ph } from "@/content/site";

/**
 * 작업 사례 (디자인 피클의 our-work). 솔루션별 필터 + 메이슨리 그리드.
 * 항목은 솔루션 × 임시 이미지로 만든 샘플이다. 실제 작업물이 오면 여기 WORK_ITEMS 만 바꾸면 된다.
 */

export const metadata: Metadata = { title: "작업 사례", description: "페이지프렌즈로 만든 사이트 예시. 회사소개부터 쇼핑몰, 예약, 포트폴리오까지." };

const KINDS: WorkItem["kind"][] = ["photo", "tall", "square"];
const WORK_ITEMS: WorkItem[] = Array.from({ length: 18 }, (_, i) => {
  const solution = SOLUTIONS[i % SOLUTIONS.length];
  const n = Math.floor(i / SOLUTIONS.length) + 1;
  const kind = KINDS[i % KINDS.length];
  return { id: `${solution.slug}-${n}`, title: `${solution.name} 예시 ${n}`, solutionSlug: solution.slug, solutionName: solution.name, kind, image: ph(kind, i + 1), hashtags: solution.hashtags };
});

const FILTERS = SOLUTIONS.map((s) => ({ key: s.slug, label: s.name }));

export default async function OurWorkPage({ searchParams }: PageProps<"/our-work">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = raw && SOLUTIONS.some((s) => s.slug === raw) ? raw : undefined;
  const items = category ? WORK_ITEMS.filter((w) => w.solutionSlug === category) : WORK_ITEMS;

  return (
    <>
      <Hero eyebrow="작업 사례" title="우리가 만드는 것" lead="회사소개, 쇼핑몰, 예약, 포트폴리오. 업종과 목적에 따라 어떻게 다르게 만드는지 보세요. 마음에 드는 예시를 누르면 해당 솔루션으로 이동합니다." size="lg" />

      <section className="bg-night-950 pb-16 text-white sm:pb-24">
        <Container>
          <FilterPills basePath="/our-work" active={category} items={FILTERS} />
          <p className="mt-6 text-xs text-white/50">
            <SampleBadge className="mr-1.5" />
            아래 예시는 임시 이미지로 만든 샘플입니다. 실제 작업물로 교체하세요.
          </p>

          {items.length ? (
            <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
              {items.map((item) => (
                <WorkCard key={item.id} item={item} className="mb-5 break-inside-avoid" />
              ))}
            </div>
          ) : (
            <p className="mt-10 text-sm text-white/60">해당 분류의 예시가 아직 없습니다.</p>
          )}
        </Container>
      </section>

      <Arc from="dark" to="light" />

      <Section tone="light" className="pt-6 sm:pt-10">
        <Container className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow tone="light">이제 당신 차례</Eyebrow>
            <Display className="mt-3">이런 사이트가 필요하다면</Display>
            <Lead tone="light" className="mt-4 max-w-2xl">
              템플릿을 고르거나 프롬프트만 적으면 됩니다. 필수 정보 입력 후 며칠 안에 첫 완성본이 올라옵니다.
            </Lead>
          </div>
          <div className="flex flex-wrap gap-3">
            <Pill href="/signup">시작하기</Pill>
            <Pill href="/templates" variant="outline">
              템플릿 보기
            </Pill>
          </div>
        </Container>
      </Section>

      <RecommendSection />
    </>
  );
}
