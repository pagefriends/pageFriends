import { ArrowRightIcon, QuoteIcon } from "lucide-react";
import type { Metadata } from "next";

import { Carousel } from "@/components/marketing/interactive";
import { Arc, Container, DarkCard, Display, Eyebrow, Lead, LightCard, Photo, Pill, RecommendSection, SampleBadge, Section, TrustStrip } from "@/components/marketing/primitives";
import { DELIVERY_DAYS } from "@/config/plans";
import { FUN_FACTS, LEADERS, VALUES, ph } from "@/content/site";

export const metadata: Metadata = { title: "회사 소개" };

/**
 * 회사 소개. 디자인 피클 /about 구성을 따른다:
 *   히어로(어두움, 사진 콜라주) → 신뢰 띠 → FUN FACTS(흰) → 우리의 약속 6카드 + 대표 인용(어두움)
 *   → 미션 3가지(흰) → 리더십 캐러셀 + 채용 카드(어두움) → 추천 읽을거리
 */
const MISSION = [
  { n: "01", title: "전달", body: "설명만 하면 된다는 약속을 지킵니다. 견적 · 미팅 · 계약서 없이 필수 정보만 받고, 며칠 안에 첫 완성본을 대시보드에 올립니다." },
  { n: "02", title: "제작", body: "AI 가 초안을 만들고 사람이 마무리합니다. 구조 · 문구 · 반응형까지 전문가가 검수한 결과물만 내보냅니다." },
  { n: "03", title: "발전", body: "만들고 끝이 아닙니다. 네모 하나로 수정을 요청하고, 규모가 커지면 플랜만 올리면 되는 구조로 사이트와 함께 성장합니다." },
];

export default function AboutPage() {
  const ceo = LEADERS[0];
  return (
    <>
      {/* 히어로 — 왼쪽 글, 오른쪽 사진 콜라주 */}
      <section className="bg-night-950 text-white">
        <Container className="grid items-center gap-12 pt-16 pb-14 sm:pt-24 sm:pb-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Eyebrow>원조</Eyebrow>
            <Display as="h1" size="xl" className="mt-4">
              한 가지만
              <br />
              말씀드릴게요
            </Display>
            <Lead className="mt-6 max-w-xl">
              페이지프렌즈는 AI 와 전문가가 함께 만드는 구독형 웹사이트 제작 서비스입니다. 템플릿이나 프롬프트로 시작하면 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본이
              오고, 화면 위에 네모를 그려 수정을 요청합니다. 디자인 · 개발 지식은 필요 없습니다.
            </Lead>
            <div className="mt-8">
              <Pill href="/signup">시작하기</Pill>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pb-8">
            <Photo img={ph("photo", 3)} alt="" className="aspect-[4/5]" priority sizes="(min-width: 1024px) 25vw, 50vw" />
            <Photo img={ph("photo", 4)} alt="" className="aspect-[4/5] translate-y-8" sizes="(min-width: 1024px) 25vw, 50vw" />
          </div>
        </Container>
        <Container className="pb-16 sm:pb-20">
          <TrustStrip />
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* FUN FACTS — 흰 바탕 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">궁금하실까 봐</Eyebrow>
          <Display className="mt-3">FUN FACTS</Display>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUN_FACTS.map((f) => (
              <LightCard key={f.label}>
                <p className="text-5xl font-extrabold tracking-tight text-brand-600 sm:text-6xl">{f.value}</p>
                <p className="mt-3 text-[15px] font-semibold text-ink-700">{f.label}</p>
              </LightCard>
            ))}
          </div>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 우리의 약속 — 어두운 바탕 */}
      <Section tone="dark">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow>왜 일하는가</Eyebrow>
              <Display className="mt-3">우리의 약속</Display>
              <Lead className="mt-5">사이트를 만드는 일이 사장님의 본업을 방해해서는 안 됩니다. 우리가 지키는 여섯 가지입니다.</Lead>
            </div>
            <Photo img={ph("photo", 5)} alt="" className="aspect-[4/3]" />
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v, i) => (
              <DarkCard key={v.title}>
                <p className="text-sm font-bold text-sky-400">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 text-lg font-bold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{v.body}</p>
              </DarkCard>
            ))}
          </div>

          {/* 대표 인용 */}
          <DarkCard className="mt-12 grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
            <Photo img={ceo.avatar} alt="" className="size-24 rounded-full sm:size-32" sizes="128px" />
            <div>
              <QuoteIcon className="size-8 text-sky-400" aria-hidden />
              <p className="mt-4 max-w-3xl text-xl font-semibold leading-snug sm:text-2xl">
                “좋은 사이트는 사장님의 시간을 돌려줍니다. 우리는 만드는 과정에서도 그 시간을 뺏지 않기로 했습니다. 설명 한 번, 네모 하나면 충분해야 합니다.”
              </p>
              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-white/60">
                <span className="font-semibold text-white">{ceo.name}</span>
                <span>페이지프렌즈 {ceo.role}</span>
                <SampleBadge />
              </p>
            </div>
          </DarkCard>
        </Container>
      </Section>
      <Arc from="dark" to="light" />

      {/* 미션 — 흰 바탕 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">여기서 시작합니다</Eyebrow>
          <Display className="mt-3">우리의 미션</Display>
          <Lead tone="light" className="mt-4 max-w-2xl">
            누구나 설명만으로 제대로 된 웹사이트를 갖게 하는 것. 세 가지로 나눠 실천합니다.
          </Lead>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {MISSION.map((m) => (
              <div key={m.n} className="border-t-2 border-brand-600 pt-6">
                <p className="text-sm font-bold text-brand-600">{m.n}</p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight">{m.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{m.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 리더십 — 어두운 바탕 캐러셀 */}
      <Section tone="dark">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>리더십</Eyebrow>
              <Display className="mt-3">팀을 소개합니다</Display>
            </div>
            <p className="text-sm text-white/50">
              <SampleBadge className="mr-1.5" />
              실제 팀 정보로 교체하세요.
            </p>
          </div>
          <div className="mt-10">
            <Carousel itemClassName="w-[70%] sm:w-[260px]">
              {LEADERS.map((p, i) => (
                <DarkCard key={`${p.name}-${i}`} className="h-full">
                  <Photo img={p.avatar} alt="" className="size-20 rounded-full" sizes="80px" />
                  <p className="mt-5 text-lg font-bold">{p.name}</p>
                  <p className="mt-1 text-sm text-white/60">{p.role}</p>
                </DarkCard>
              ))}
            </Carousel>
          </div>

          {/* 채용 카드 */}
          <DarkCard className="mt-12 flex flex-col gap-6 border border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">당신의 역량. 우리의 미션.</p>
              <p className="mt-2 text-sm text-white/60">제품 · 전문가 · 고객 팀에서 함께 일할 사람을 찾습니다. 서울과 원격, 어디서든.</p>
            </div>
            <Pill href="/careers" className="shrink-0">
              채용 보기 <ArrowRightIcon className="size-4" />
            </Pill>
          </DarkCard>
        </Container>
      </Section>
      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
