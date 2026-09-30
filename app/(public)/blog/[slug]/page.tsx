import { ArrowLeftIcon, ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/marketing/content-cards";
import { Arc, Container, Display, Eyebrow, Lead, Photo, Pill, RecommendSection, SampleBadge, Section } from "@/components/marketing/primitives";
import { POSTS, POST_BY_SLUG } from "@/content/site";
import { formatDate } from "@/lib/utils";

/** 블로그 글 상세 */

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = POST_BY_SLUG[slug];
  if (!post) return { title: "블로그" };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = POST_BY_SLUG[slug];
  if (!post) notFound();

  const sameCategory = POSTS.filter((p) => p.slug !== post.slug && p.category === post.category);
  const others = POSTS.filter((p) => p.slug !== post.slug && p.category !== post.category);
  const related = [...sameCategory, ...others].slice(0, 3);

  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="pt-12 pb-14 sm:pt-16 sm:pb-20">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
            <ArrowLeftIcon className="size-4" /> 블로그
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={`/blog?category=${encodeURIComponent(post.category)}`}>
              <Eyebrow className="hover:underline">{post.category}</Eyebrow>
            </Link>
            {post.sample ? <SampleBadge className="text-white/70" /> : null}
          </div>
          <Display as="h1" size="lg" className="mt-4 max-w-4xl">
            {post.title}
          </Display>
          <Lead className="mt-6 max-w-2xl">{post.excerpt}</Lead>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
            <span className="font-semibold text-white/80">{post.author}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(post.date)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" /> {post.readMinutes}분 읽기
            </span>
          </p>
        </Container>
      </section>

      <Arc from="dark" to="light" />

      <Section tone="light" className="pt-2 sm:pt-4">
        <Container>
          <Photo img={post.image} alt="" className="aspect-[16/9] w-full" priority sizes="(min-width: 1280px) 1200px, 100vw" />
          <article className="mx-auto mt-12 max-w-3xl space-y-6 text-[17px] leading-relaxed text-ink-700">
            {post.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
          <div className="mx-auto mt-12 flex max-w-3xl flex-col items-start gap-4 rounded-2xl bg-ink-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-lg font-bold">직접 해보고 싶다면</p>
              <p className="mt-1 text-sm text-ink-600">템플릿 또는 프롬프트로 5분 안에 시작할 수 있습니다.</p>
            </div>
            <Pill href="/signup" size="md" className="shrink-0">
              시작하기
            </Pill>
          </div>
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      <Section tone="dark" className="pt-6 sm:pt-10">
        <Container>
          <Eyebrow>관련 글</Eyebrow>
          <Display className="mt-3">이어서 읽기</Display>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} className="text-ink-900" />
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
