import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Carousel } from "@/components/marketing/interactive";
import { Arc, Container, DarkCard, Display, Eyebrow, Photo, Pill, QuestionsCard, RecommendSection, SampleBadge, Section, Tag, type Tone } from "@/components/marketing/primitives";
import { COMMAND_STEPS, SOLUTIONS, STORIES, TESTIMONIALS } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * 여러 공개 페이지가 같이 쓰는 큰 섹션 (서버 컴포넌트).
 * primitives.tsx 의 부품을 content/site.ts 데이터와 묶기만 한다.
 * 후기 · 사례는 샘플 콘텐츠이므로 제목 옆에 항상 <SampleBadge /> 를 붙인다.
 */

/** 고객 후기 캐러셀 — 디자인 피클의 "What our customers say" */
export function TestimonialCarousel({ tone = "light", eyebrow = "고객의 말", title = "써 본 사람들의 이야기" }: { tone?: Tone; eyebrow?: string; title?: string }) {
  const dark = tone === "dark";
  return (
    <Section tone={tone}>
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
            <Display className="mt-3 max-w-2xl">
              {title} <SampleBadge className="ml-2 align-middle text-sm" />
            </Display>
          </div>
          <Pill href="/customer-stories" variant={dark ? "outlineLight" : "outline"} size="md" className="shrink-0 self-start lg:self-auto">
            사례 전체 보기 <ArrowRightIcon className="size-4" />
          </Pill>
        </div>
        <div className="mt-10">
          <Carousel>
            {TESTIMONIALS.map((t) => (
              <div key={t.storySlug} className={cn("flex h-full flex-col rounded-2xl p-7", dark ? "bg-night-900" : "border border-ink-200 bg-white")}>
                <p className="text-lg font-semibold leading-snug">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="relative size-11 overflow-hidden rounded-full bg-ink-200">
                    <Image src={t.avatar.src} alt="" fill className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className={cn("text-xs", dark ? "text-white/60" : "text-ink-500")}>{t.role}</p>
                  </div>
                </div>
                <div className={cn("mt-6 border-t border-dotted pt-5", dark ? "border-white/20" : "border-ink-300")}>
                  <p className={cn("text-4xl font-extrabold tracking-tight", dark ? "text-sky-400" : "text-brand-600")}>{t.metric}</p>
                  <p className={cn("mt-1 text-xs", dark ? "text-white/60" : "text-ink-500")}>{t.metricLabel}</p>
                </div>
                <Link href={`/customer-stories/${t.storySlug}`} className={cn("mt-5 inline-flex items-center gap-1 text-sm font-semibold hover:underline", dark ? "text-sky-400" : "text-brand-600")}>
                  사례 보기 <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            ))}
          </Carousel>
        </div>
      </Container>
    </Section>
  );
}

/** 고객 사례 그리드 (어두운 바탕) — 디자인 피클의 "Customer stories" */
export function StoriesGrid({ eyebrow = "고객 사례", title = "첫날부터 함께", limit = 6 }: { eyebrow?: string; title?: string; limit?: number }) {
  return (
    <Section tone="dark">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Display className="mt-3 max-w-2xl">
              {title} <SampleBadge className="ml-2 align-middle text-sm" />
            </Display>
          </div>
          <Pill href="/customer-stories" variant="outlineLight" size="md" className="shrink-0 self-start lg:self-auto">
            전체 사례 <ArrowRightIcon className="size-4" />
          </Pill>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STORIES.slice(0, limit).map((s) => (
            <DarkCard key={s.slug} className="flex flex-col">
              <Image src={s.logo.src} alt={`${s.company} 로고 (임시)`} width={120} height={45} className="h-7 w-auto opacity-80" unoptimized />
              <p className="mt-6 text-lg font-bold leading-snug">{s.headline}</p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
                {s.metrics.map((m) => (
                  <div key={m.label}>
                    <dt className="text-[11px] text-white/50">{m.label}</dt>
                    <dd className="mt-1 text-xl font-extrabold tracking-tight text-sky-400">{m.value}</dd>
                  </div>
                ))}
              </dl>
              <Link href={`/customer-stories/${s.slug}`} className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold text-sky-400 hover:underline">
                더 보기 <ArrowRightIcon className="size-4" />
              </Link>
            </DarkCard>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** "만드는 것" 솔루션 캐러셀 (어두운 바탕) — 디자인 피클의 카테고리 슬라이더 */
export function SolutionsCarousel({ eyebrow = "만드는 것", title = "필요한 모든 사이트를 한 곳에서" }: { eyebrow?: string; title?: string }) {
  return (
    <Section tone="dark">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Display className="mt-3 max-w-3xl [text-wrap:balance]">{title}</Display>
          </div>
          <Pill href="/signup" size="md" className="shrink-0 self-start lg:self-auto">
            시작하기
          </Pill>
        </div>
        <div className="mt-10">
          <Carousel itemClassName="sm:w-[340px]">
            {SOLUTIONS.map((s, i) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group block h-full rounded-2xl bg-night-900 p-4">
                <Photo img={s.image} className="aspect-[4/3]" sizes="(min-width: 640px) 340px, 85vw" />
                <p className="mt-4 text-lg font-bold group-hover:underline">{s.name}</p>
                <p className="mt-1 text-[13px] text-white/60">{s.short}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.hashtags.map((h) => (
                    <Tag key={`${i}-${h}`}>{h}</Tag>
                  ))}
                </div>
              </Link>
            ))}
          </Carousel>
        </div>
      </Container>
    </Section>
  );
}

/** 4단계 커맨드 센터 카드 (어두운 바탕) — 디자인 피클의 "Brief. Review. Approve. Repeat." */
export function StepsGrid({ eyebrow = "브리프. 확인. 네모. 완성.", title = "내 사이트의 컨트롤 타워", cta = { href: "/demo", label: "편집 화면 체험" } }: { eyebrow?: string; title?: string; cta?: { href: string; label: string } | null }) {
  return (
    <Section tone="dark">
      <Container>
        <div className="text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Display className="mx-auto mt-3 max-w-3xl">{title}</Display>
          {cta ? (
            <div className="mt-8 flex justify-center">
              <Pill href={cta.href} size="md">
                {cta.label} <ArrowRightIcon className="size-4" />
              </Pill>
            </div>
          ) : null}
        </div>
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {COMMAND_STEPS.map((s) => (
            <li key={s.n}>
              <DarkCard className="flex h-full flex-col p-5 sm:p-5">
                <Photo img={s.image} className="aspect-[4/3]" sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw" />
                <p className="mt-5 text-sm font-bold text-sky-400">{String(s.n).padStart(2, "0")}</p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{s.body}</p>
              </DarkCard>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}

/** 페이지 끝: 어두운 바탕의 "궁금한 점이 있나요?" + 추천 읽을거리 */
export function Closing({ arcFrom }: { arcFrom?: Tone }) {
  return (
    <>
      {arcFrom && arcFrom !== "dark" ? <Arc from={arcFrom} to="dark" /> : null}
      <Section tone="dark" className="py-12 sm:py-16">
        <Container>
          <QuestionsCard />
        </Container>
      </Section>
      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
