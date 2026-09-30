import type { Metadata } from "next";

import { FilterPills, ResourceCard } from "@/components/marketing/content-cards";
import { Arc, Container, Display, Eyebrow, Lead, Pill, RecommendSection, SampleBadge, Section } from "@/components/marketing/primitives";
import { RESOURCES, RESOURCE_CATEGORIES, type Resource } from "@/content/site";

/** 리소스 (디자인 피클의 resources). 카테고리 필터 + 대표 자료 + 그리드 */

export const metadata: Metadata = { title: "리소스", description: "가이드 · 전자책 · 웨비나 · 팟캐스트 · 레시피. 사이트 제작과 운영에 바로 쓰는 자료." };

const CATEGORY_KEYS = new Set<string>(RESOURCE_CATEGORIES.map((c) => c.key));

export default async function ResourcesPage({ searchParams }: PageProps<"/resources">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = raw && CATEGORY_KEYS.has(raw) ? (raw as Resource["category"]) : undefined;
  const items = category ? RESOURCES.filter((r) => r.category === category) : RESOURCES;
  const [featured, ...rest] = items;

  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-12 sm:pt-24 sm:pb-16">
          <Eyebrow>리소스</Eyebrow>
          <Display as="h1" size="xl" className="mt-4 max-w-4xl">
            다음 아이디어를 여세요
          </Display>
          <Lead className="mt-6 max-w-2xl">처음 만드는 홈페이지 가이드부터 쇼핑몰 체크리스트, 편집기 웨비나까지. 필요한 것만 골라 보세요.</Lead>
          <div className="mt-10">
            <FilterPills basePath="/resources" active={category} items={RESOURCE_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} />
          </div>
        </Container>
      </section>

      <Arc from="dark" to="light" />

      <Section tone="light" className="pt-4 sm:pt-6">
        <Container>
          <p className="text-xs text-ink-500">
            <SampleBadge className="mr-1.5" />
            아래 자료는 샘플입니다. 실제 자료로 교체하세요.
          </p>
          {featured ? (
            <>
              <div className="mt-6">
                <ResourceCard resource={featured} featured />
              </div>
              {rest.length ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((r) => (
                    <ResourceCard key={r.slug} resource={r} />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-10 text-sm text-ink-500">해당 분류의 자료가 아직 없습니다.</p>
          )}
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>자료보다 빠른 방법</Eyebrow>
            <Display className="mt-3">읽는 대신 바로 만들어 보세요</Display>
            <Lead className="mt-4 max-w-2xl">편집 화면 체험은 로그인 없이 바로 열립니다. 네모 그려서 요청하는 방식을 1분 안에 익힐 수 있습니다.</Lead>
          </div>
          <div className="flex flex-wrap gap-3">
            <Pill href="/demo">편집 화면 체험</Pill>
            <Pill href="/signup" variant="outlineLight">
              시작하기
            </Pill>
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
