import { ArrowRightIcon, ClockIcon, CoinsIcon, HeadsetIcon, ShieldCheckIcon, ZapIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Arc, BigNumber, ComparisonTable, Container, DarkCard, Display, Eyebrow, Lead, LightCard, Photo, PhotoStat, Pill, Section, TrustStrip } from "@/components/marketing/primitives";
import { Closing, SolutionsCarousel, StepsGrid, StoriesGrid, TestimonialCarousel } from "@/components/marketing/sections";
import { DELIVERY_DAYS } from "@/config/plans";
import { KEY_NUMBERS, PHOTO_STATS, WHY_CARDS, ph } from "@/content/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "페이지프렌즈 — AI 웹사이트 제작, 3~7일 완성" };

/**
 * 홈. 디자인 피클 홈의 섹션 순서를 그대로 따른다:
 * 히어로 → 신뢰 띠 + 파트너 카드 → 왜 우리(5카드) → 고객이 얻는 것(숫자) → 만드는 것(캐러셀)
 * → 컨트롤 타워(4단계) → 비교표 → 후기 → 고객 사례 → 질문 카드 → 추천 읽을거리
 */

const WHY_ICON: Record<string, LucideIcon> = { shield: ShieldCheckIcon, zap: ZapIcon, coins: CoinsIcon, clock: ClockIcon, headset: HeadsetIcon };

export default function HomePage() {
  return (
    <>
      {/* 1. 히어로 — 왼쪽 글, 오른쪽 사진 콜라주 */}
      <section className="bg-night-950 text-white">
        <Container className="grid items-center gap-12 pt-16 pb-16 sm:pt-24 sm:pb-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Eyebrow>AI 웹사이트 제작 · {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 완성</Eyebrow>
            <Display as="h1" size="xl" className="mt-4">
              설명만 하면
              <br />
              웹사이트가
              <br />
              완성됩니다
            </Display>
            <Lead className="mt-6 max-w-xl">
              템플릿 또는 프롬프트로 시작해 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본을 받습니다. 고칠 곳은 화면 위에 네모를 그려 요청하면 AI 와 전문가가 반영합니다.
            </Lead>
            <div className="mt-8 flex flex-wrap gap-3">
              <Pill href="/signup">시작하기</Pill>
              <Pill href="/how-it-works" variant="outlineLight">
                이용 방법
              </Pill>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Photo img={ph("tall", 1)} alt="" className="aspect-[3/4]" priority sizes="(min-width: 1024px) 25vw, 50vw" />
            <div className="grid gap-4">
              <Photo img={ph("square", 1)} alt="" className="aspect-square" priority sizes="(min-width: 1024px) 25vw, 50vw" />
              <div className="rounded-2xl bg-night-900 p-4 text-xs">
                <p className="font-semibold">
                  <span className="mr-1.5 inline-block bg-mark px-1 text-[10px] text-white">1</span>제목 문구를 더 짧게
                </p>
                <p className="mt-1 text-white/50">AI 반영 · 반영 완료</p>
                <p className="mt-3 font-semibold">
                  <span className="mr-1.5 inline-block bg-mark px-1 text-[10px] text-white">2</span>실제 매장 사진으로 교체
                </p>
                <p className="mt-1 text-white/50">전문가 요청 · 처리중</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 2. 신뢰 띠 + 파트너 카드 */}
      <Section tone="dark" className="pt-0 sm:pt-0">
        <Container className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <TrustStrip />
          <DarkCard className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-night-800 text-sky-400">
              <ShieldCheckIcon className="size-7" />
            </div>
            <div>
              <p className="text-lg font-bold">토스페이먼츠 결제 연동 파트너</p>
              <p className="mt-1 text-sm text-white/60">쇼핑몰 · 예약 결제는 포트원(토스페이먼츠)로 연동합니다. 카드 정보는 저장하지 않습니다.</p>
              <Link href="/solutions/shop" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:underline">
                더 알아보기 <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </DarkCard>
        </Container>
      </Section>

      {/* 3. 왜 우리 — 5카드, 첫 카드는 2행 */}
      <Section tone="dark" className="pt-0 sm:pt-0">
        <Container>
          <Eyebrow>사람의 창의력, AI 가 돕습니다</Eyebrow>
          <Display className="mt-3 max-w-3xl">
            AI 가 만들고,
            <br />
            전문가가 마무리합니다
          </Display>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
            {WHY_CARDS.map((c, i) => {
              const Icon = WHY_ICON[c.icon] ?? ShieldCheckIcon;
              const first = i === 0;
              return (
                <DarkCard key={c.title} className={cn("flex flex-col", first && "md:col-span-2 lg:col-span-1 lg:row-span-2")}>
                  <span className="grid size-12 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                    <Icon className="size-6" />
                  </span>
                  <h3 className={cn("mt-6 font-bold", first ? "text-2xl sm:text-3xl" : "text-lg")}>{c.title}</h3>
                  <p className={cn("mt-2 leading-relaxed text-white/60", first ? "text-base" : "text-[14px]")}>{c.body}</p>
                  {first ? <Photo img={ph("photo", 12)} alt="" className="mt-auto aspect-[4/3] pt-0 lg:mt-8" sizes="(min-width: 1024px) 33vw, 100vw" /> : null}
                </DarkCard>
              );
            })}
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* 4. 고객이 얻는 것 — 큰 숫자 + 사진 통계 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">원하는 결과</Eyebrow>
          <Display className="mt-3">고객이 얻는 것</Display>
          <Lead tone="light" className="mt-3 max-w-2xl">
            추정치가 아니라 실제 상품 조건입니다. 플랜에 따라 달라지는 값은 요금제에서 확인하세요.
          </Lead>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {KEY_NUMBERS.map((n) => (
              <BigNumber key={n.value} value={n.value} body={n.body} />
            ))}
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PHOTO_STATS.map((s) => (
              <PhotoStat key={s.label} value={s.value} label={s.label} image={s.image} accent={"accent" in s && s.accent === true} />
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      {/* 5. 만드는 것 — 솔루션 캐러셀 */}
      <SolutionsCarousel />

      {/* 6. 컨트롤 타워 — 4단계 */}
      <StepsGrid />

      <Arc from="dark" to="light" />

      {/* 7. 왜 우리? — 비교표 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">당신을 위해</Eyebrow>
          <Display className="mt-3">왜 우리?</Display>
          <Lead tone="light" className="mt-3 max-w-2xl">
            직접 만들기, 프리랜서, 에이전시. 한 번 만들고 끝나는 사이트는 없기에, 만든 뒤 얼마나 쉽게 고칠 수 있는지까지 비교했습니다.
          </Lead>
          <LightCard className="mt-10">
            <ComparisonTable />
          </LightCard>
          <div className="mt-8">
            <Pill href="/comparison" variant="outline" size="md">
              자세히 비교하기 <ArrowRightIcon className="size-4" />
            </Pill>
          </div>
        </Container>
      </Section>

      {/* 8. 후기 캐러셀 */}
      <TestimonialCarousel tone="light" />

      <Arc from="light" to="dark" />

      {/* 9. 고객 사례 */}
      <StoriesGrid />

      {/* 10 · 11. 질문 카드 + 추천 읽을거리 */}
      <Closing />
    </>
  );
}
