import { ArrowUpRightIcon, ClockIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Photo, SampleBadge } from "@/components/marketing/primitives";
import { INDUSTRIES, RESOURCE_CATEGORIES, type Img, type Post, type Resource, type Story } from "@/content/site";
import { cn, formatDate } from "@/lib/utils";

/**
 * 콘텐츠 카드 (고객 사례 · 글 · 리소스 · 작업 사례) + 필터 알약.
 * 서버 컴포넌트만. 목록 페이지(customer-stories · blog · resources · our-work)가 같이 쓴다.
 */

const INDUSTRY_LABEL: Record<string, string> = Object.fromEntries(INDUSTRIES.map((i) => [i.key, i.label]));
const RESOURCE_LABEL: Record<string, string> = Object.fromEntries(RESOURCE_CATEGORIES.map((c) => [c.key, c.label]));

/** 쿼리스트링 필터 알약 줄. active 는 현재 선택된 key (없으면 "all") */
export function FilterPills({ basePath, param = "category", active, items, tone = "dark", className }: { basePath: string; param?: string; active?: string; items: { key: string; label: string }[]; tone?: "dark" | "light"; className?: string }) {
  const current = active ?? "all";
  const all = [{ key: "all", label: "전체" }, ...items];
  return (
    <div className={cn("-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {all.map((it) => {
        const isActive = current === it.key;
        const href = it.key === "all" ? basePath : `${basePath}?${param}=${encodeURIComponent(it.key)}`;
        return (
          <Link
            key={it.key}
            href={href}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
              tone === "dark"
                ? isActive
                  ? "border-sky-400 bg-sky-400 text-night-950"
                  : "border-white/20 text-white/80 hover:border-white"
                : isActive
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-300 text-ink-700 hover:border-ink-900",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

/** 고객 사례 카드 (흰 바탕) */
export function StoryCard({ story, className }: { story: Story; className?: string }) {
  const metric = story.metrics[0];
  return (
    <Link href={`/customer-stories/${story.slug}`} className={cn("group flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white transition-colors hover:border-ink-900", className)}>
      <Photo img={story.image} alt="" className="aspect-[16/10] rounded-none" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Image src={story.logo.src} alt={`${story.company} 로고 (임시)`} width={96} height={36} className="h-5 w-auto invert" unoptimized />
          <span className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">{INDUSTRY_LABEL[story.industry] ?? story.industry}</span>
        </div>
        {metric ? (
          <div className="mt-5">
            <p className="text-4xl font-extrabold tracking-tight text-brand-600 sm:text-5xl">{metric.value}</p>
            <p className="mt-1 text-xs text-ink-500">{metric.label}</p>
          </div>
        ) : null}
        <p className="mt-4 text-lg font-bold leading-snug group-hover:underline">{story.headline}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{story.summary}</p>
        <div className="mt-auto flex items-center justify-between pt-5 text-sm font-semibold text-brand-600">
          <span className="inline-flex items-center gap-1">
            사례 읽기 <ArrowUpRightIcon className="size-4" />
          </span>
          {story.sample ? <SampleBadge className="text-ink-500" /> : null}
        </div>
      </div>
    </Link>
  );
}

/** 블로그 글 카드 (흰 바탕). featured 면 큰 가로 카드 */
export function PostCard({ post, featured = false, className }: { post: Post; featured?: boolean; className?: string }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn("group overflow-hidden rounded-2xl border border-ink-200 bg-white transition-colors hover:border-ink-900", featured ? "grid lg:grid-cols-[1.2fr_1fr]" : "flex flex-col", className)}
    >
      <Photo img={post.image} alt="" className={cn("rounded-none", featured ? "aspect-[16/10] lg:aspect-auto lg:min-h-[360px]" : "aspect-[16/10]")} sizes={featured ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} />
      <div className={cn("flex flex-1 flex-col", featured ? "p-6 sm:p-10" : "p-5 sm:p-6")}>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
          <span>{post.category}</span>
          {post.sample ? <SampleBadge className="text-ink-500" /> : null}
        </div>
        <p className={cn("mt-3 font-bold leading-snug group-hover:underline", featured ? "text-2xl sm:text-3xl lg:text-4xl" : "text-lg")}>{post.title}</p>
        <p className={cn("mt-3 leading-relaxed text-ink-600", featured ? "text-base sm:text-lg" : "line-clamp-3 text-[14px]")}>{post.excerpt}</p>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-xs text-ink-500">
          <span>{formatDate(post.date)}</span>
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" /> {post.readMinutes}분
          </span>
        </p>
      </div>
    </Link>
  );
}

/** 리소스 카드 (흰 바탕). featured 면 큰 가로 카드 */
export function ResourceCard({ resource, featured = false, className }: { resource: Resource; featured?: boolean; className?: string }) {
  return (
    <Link
      href={resource.href}
      className={cn("group overflow-hidden rounded-2xl border border-ink-200 bg-white transition-colors hover:border-ink-900", featured ? "grid lg:grid-cols-[1.2fr_1fr]" : "flex flex-col", className)}
    >
      <Photo img={resource.image} alt="" className={cn("rounded-none", featured ? "aspect-[16/10] lg:aspect-auto lg:min-h-[340px]" : "aspect-[16/10]")} sizes={featured ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"} />
      <div className={cn("flex flex-1 flex-col", featured ? "p-6 sm:p-10" : "p-5 sm:p-6")}>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
          <span>{RESOURCE_LABEL[resource.category] ?? resource.category}</span>
          {resource.sample ? <SampleBadge className="text-ink-500" /> : null}
        </div>
        <p className={cn("mt-3 font-bold leading-snug group-hover:underline", featured ? "text-2xl sm:text-3xl lg:text-4xl" : "text-lg")}>{resource.title}</p>
        <p className={cn("mt-3 leading-relaxed text-ink-600", featured ? "text-base sm:text-lg" : "text-[14px]")}>{resource.excerpt}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-brand-600">
          보기 <ArrowUpRightIcon className="size-4" />
        </span>
      </div>
    </Link>
  );
}

export type WorkItem = { id: string; title: string; solutionSlug: string; solutionName: string; kind: "photo" | "tall" | "square"; image: Img; hashtags: string[] };
const WORK_ASPECT: Record<WorkItem["kind"], string> = { photo: "aspect-[4/3]", tall: "aspect-[3/4]", square: "aspect-square" };

/** 작업 사례 카드 (어두운 바탕 · 메이슨리 그리드용) */
export function WorkCard({ item, className }: { item: WorkItem; className?: string }) {
  return (
    <Link href={`/solutions/${item.solutionSlug}`} className={cn("group block overflow-hidden rounded-2xl border border-white/10 bg-night-900 transition-colors hover:border-white/40", className)}>
      <Photo img={item.image} alt="" className={cn("rounded-none", WORK_ASPECT[item.kind])} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
      <div className="p-5">
        <p className="text-[11px] font-semibold tracking-wide text-sky-400 uppercase">{item.solutionName}</p>
        <p className="mt-1.5 text-base font-bold group-hover:underline">{item.title}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.hashtags.map((t) => (
            <span key={t} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/70 uppercase">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
