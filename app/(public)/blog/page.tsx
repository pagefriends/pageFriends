import { ArrowRightIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";

import { FilterPills, PostCard } from "@/components/marketing/content-cards";
import { Arc, Container, DarkCard, Display, Eyebrow, Lead, Pill, RecommendSection, SampleBadge, Section } from "@/components/marketing/primitives";
import { POSTS, POST_CATEGORIES } from "@/content/site";

/** 블로그 목록 (디자인 피클의 blog). 대표 글 + 뉴스레터 블록 + 카테고리 필터 + 최신 글 그리드 */

export const metadata: Metadata = { title: "블로그", description: "사이트 제작 · 운영에 도움이 되는 글. 브리프 쓰는 법, 수정 요청 요령, AI 토큰 안내." };

const FEATURED = POSTS[0];

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const category = raw && POST_CATEGORIES.includes(raw) ? raw : undefined;
  const posts = category ? POSTS.filter((p) => p.category === category) : POSTS;

  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-12 sm:pt-24 sm:pb-16">
          <Eyebrow>블로그</Eyebrow>
          <Display as="h1" size="xl" className="mt-4 max-w-4xl">
            디자인의 미래: 트렌드와 AI
          </Display>
          <Lead className="mt-6 max-w-2xl">사이트를 만들고 운영하는 데 바로 쓸 수 있는 글만 씁니다. 브리프, 수정 요청, 토큰, 그리고 실제 사례.</Lead>
        </Container>
      </section>

      <Arc from="dark" to="light" />

      {/* 대표 글 */}
      <Section tone="light" className="pt-4 sm:pt-6">
        <Container>
          <p className="text-xs text-ink-500">
            <SampleBadge className="mr-1.5" />
            아래 글은 샘플입니다. 실제 글로 교체하세요.
          </p>
          <div className="mt-6">
            <PostCard post={FEATURED} featured />
          </div>
        </Container>
      </Section>

      {/* 뉴스레터 */}
      <section className="bg-white pb-16 sm:pb-24">
        <Container>
          <DarkCard className="flex flex-col gap-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                <MailIcon className="size-5" />
              </span>
              <div>
                <Eyebrow>쿡북 구독</Eyebrow>
                <p className="mt-2 text-2xl font-bold">사이트 제작 레시피를 받아보세요</p>
                <p className="mt-2 max-w-xl text-sm text-white/60">가이드 · 전자책 · 웨비나 소식을 한 달에 한두 번 보냅니다. 구독은 페이지 아래 뉴스레터 폼에서, 지난 자료는 리소스에서 보세요.</p>
              </div>
            </div>
            <Pill href="/resources" size="md" className="shrink-0">
              리소스 보기 <ArrowRightIcon className="size-4" />
            </Pill>
          </DarkCard>
        </Container>
      </section>

      <Arc from="light" to="dark" />

      {/* 카테고리 + 최신 글 */}
      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>최신 글</Eyebrow>
              <Display className="mt-3">{category ? `${category} 글` : "새로 올라온 글"}</Display>
            </div>
          </div>
          <div className="mt-8">
            <FilterPills basePath="/blog" active={category} items={POST_CATEGORIES.map((c) => ({ key: c, label: c }))} />
          </div>
          {posts.length ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.slug} post={p} className="text-ink-900" />
              ))}
            </div>
          ) : (
            <p className="mt-10 text-sm text-white/60">해당 분류의 글이 아직 없습니다.</p>
          )}
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
