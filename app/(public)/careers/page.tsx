import { ArrowRightIcon, MapPinIcon, ShieldAlertIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";

import { Carousel } from "@/components/marketing/interactive";
import { Arc, Container, DarkCard, Display, Eyebrow, Lead, LightCard, Photo, Pill, RecommendSection, SampleBadge, Section, TrustStrip } from "@/components/marketing/primitives";
import { BENEFITS, FUN_FACTS, JOBS, SUPPORT, VALUES, ph } from "@/content/site";

export const metadata: Metadata = { title: "채용" };

/**
 * 채용. 디자인 피클 /careers 구성:
 *   히어로 + 사진 캐러셀 → 신뢰 띠 + 팀 사진(어두움) → 채용 중 목록(흰) → 우리는 누구인가 + 핵심 가치(어두움)
 *   → 미션 + 직원 후기(흰) → 제공하는 것(어두움) → 추천
 * 숫자는 FUN_FACTS 와 실제 공고 수만 쓴다. 직원 만족도 같은 지어낸 비율은 넣지 않는다.
 */
const OFFICIAL_DOMAIN = SUPPORT.email.split("@")[1];

const TEAM_FACTS = [...FUN_FACTS, { value: "원격", label: "서울 사무실 · 원격 근무 병행" }, { value: String(JOBS.length), label: "채용 중인 포지션" }];

/** 샘플 직원 후기 — 실제 인터뷰로 교체 */
const VOICES = [
  { quote: "요청 하나하나에 사람이 답한다는 원칙이 처음엔 부담이었는데, 지금은 이 일의 가장 좋은 부분입니다. 사장님 사이트가 열리는 걸 같이 봅니다.", name: "OOO", role: "전문가 팀 · 웹 디자이너", avatar: ph("avatar", 8) },
  { quote: "AI 가 초안을 만들어 주니 반복 작업이 줄고, 판단이 필요한 곳에만 시간을 씁니다. 개발자로서 배우는 속도가 다릅니다.", name: "OOO", role: "제품 팀 · 프론트엔드", avatar: ph("avatar", 9) },
  { quote: "원격으로 일해도 외롭지 않습니다. 브리프 하나를 디자이너 · 개발자 · 카피라이터가 같이 보니까 늘 대화가 있어요.", name: "OOO", role: "고객 팀 · 고객 성공", avatar: ph("avatar", 10) },
];

export default function CareersPage() {
  return (
    <>
      {/* 히어로 + 사진 캐러셀 */}
      <section className="bg-night-950 text-white">
        <Container className="pt-16 sm:pt-24">
          <Eyebrow>페이지프렌즈</Eyebrow>
          <Display as="h1" size="xl" className="mt-4 max-w-4xl">
            평범한 제작 서비스가
            <br />
            아닙니다
          </Display>
          <Lead className="mt-6 max-w-2xl">AI 가 만들고 사람이 마무리하는 웹사이트 제작. 우리는 사장님이 설명 한 번으로 제대로 된 사이트를 갖게 하는 일을 합니다. 그 일을 같이 할 사람을 찾습니다.</Lead>
          <div className="mt-8 flex flex-wrap gap-3">
            <Pill href="#openings">채용 공고 보기</Pill>
            <Pill href="/creative-application" variant="outlineLight">
              전문가로 지원
            </Pill>
          </div>
        </Container>
        <Container className="mt-14">
          <Carousel controls={false} itemClassName="w-[80%] sm:w-[460px]">
            {[9, 10, 11, 12].map((i) => (
              <Photo key={i} img={ph("photo", i)} alt="" className="aspect-[4/3]" sizes="460px" priority={i === 9} />
            ))}
          </Carousel>
        </Container>
        <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <TrustStrip />
            <p className="mt-8 text-[15px] leading-relaxed text-white/70">
              페이지프렌즈는 서울에 사무실을 두고, 전국의 전문가와 원격으로 일합니다. 제품 팀은 편집기와 AI 파이프라인을 만들고, 전문가 팀은 초안을 검수해 사이트를 완성하고, 고객 팀은 요청 하나하나에 답합니다.
            </p>
          </div>
          <Photo img={ph("photo", 7)} alt="" className="aspect-[4/3]" />
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* 채용 중 — 흰 바탕 */}
      <Section tone="light" id="openings">
        <Container>
          <Eyebrow tone="light">OPENINGS</Eyebrow>
          <Display className="mt-3">채용 중</Display>
          <p className="mt-3 text-sm text-ink-500">
            <SampleBadge className="mr-1.5" />
            공고는 샘플입니다. 실제 공고로 교체하세요.
          </p>
          <ul className="mt-10 divide-y divide-ink-200 border-y border-ink-200">
            {JOBS.map((j) => (
              <li key={j.title} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold">{j.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="size-3.5" /> {j.team} 팀
                    </span>
                    <span>{j.type}</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPinIcon className="size-3.5" /> {j.location}
                    </span>
                  </div>
                </div>
                <Pill href={`/creative-application?role=${encodeURIComponent(j.title)}`} variant="dark" size="md" className="shrink-0 self-start sm:self-auto">
                  지원하기 <ArrowRightIcon className="size-4" />
                </Pill>
              </li>
            ))}
          </ul>
          <LightCard className="mt-8 flex gap-4 bg-ink-50">
            <ShieldAlertIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <div className="text-sm leading-relaxed text-ink-700">
              <p className="font-semibold text-ink-900">채용 사칭에 주의하세요</p>
              <p className="mt-1">
                페이지프렌즈의 채용 관련 연락은 <span className="font-semibold">@{OFFICIAL_DOMAIN}</span> 도메인 이메일로만 보냅니다. 다른 주소나 메신저로 개인정보 · 금전 · 장비 구매를 요구하면 사칭입니다. 의심스러우면{" "}
                <a href={`mailto:${SUPPORT.email}`} className="font-semibold text-brand-600 hover:underline">
                  {SUPPORT.email}
                </a>
                로 확인해 주세요.
              </p>
            </div>
          </LightCard>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 우리는 누구인가 + 핵심 가치 — 어두운 바탕 */}
      <Section tone="dark">
        <Container>
          <Eyebrow>궁금하실까 봐</Eyebrow>
          <Display className="mt-3">우리는 누구인가</Display>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM_FACTS.map((f) => (
              <DarkCard key={f.label}>
                <p className="text-4xl font-extrabold tracking-tight text-sky-400 sm:text-5xl">{f.value}</p>
                <p className="mt-3 text-sm text-white/70">{f.label}</p>
              </DarkCard>
            ))}
          </div>

          <div className="mt-20">
            <Eyebrow>일하는 방식의 중심</Eyebrow>
            <Display className="mt-3">핵심 가치</Display>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {VALUES.map((v, i) => (
                <DarkCard key={v.title} className="border border-white/10">
                  <p className="text-sm font-bold text-sky-400">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-lg font-bold">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{v.body}</p>
                </DarkCard>
              ))}
            </div>
          </div>
        </Container>
      </Section>
      <Arc from="dark" to="light" />

      {/* 미션 + 직원 후기 — 흰 바탕 */}
      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow tone="light">우리의 미션</Eyebrow>
            <Display className="mt-3">누구나 설명만으로 제대로 된 웹사이트를 갖게 합니다</Display>
            <Lead tone="light" className="mt-5">
              견적도, 미팅도, 디자인 지식도 없이. AI 가 초안을 만들고 사람이 마무리하며, 수정은 네모 하나로 끝나는 세상을 만듭니다.
            </Lead>
          </div>
          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow tone="light">함께 일하는 사람들</Eyebrow>
              <Display size="md" className="mt-3">
                팀의 목소리
              </Display>
            </div>
            <p className="text-sm text-ink-500">
              <SampleBadge className="mr-1.5" />
              실제 인터뷰로 교체하세요.
            </p>
          </div>
          <div className="mt-8">
            <Carousel>
              {VOICES.map((v, i) => (
                <LightCard key={i} className="flex h-full flex-col bg-ink-50">
                  <p className="flex-1 text-[15px] leading-relaxed text-ink-700">“{v.quote}”</p>
                  <div className="mt-6 flex items-center gap-3">
                    <Photo img={v.avatar} alt="" className="size-11 rounded-full" sizes="44px" />
                    <div>
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-xs text-ink-500">{v.role}</p>
                    </div>
                  </div>
                </LightCard>
              ))}
            </Carousel>
          </div>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 제공하는 것 — 어두운 바탕 */}
      <Section tone="dark">
        <Container>
          <Eyebrow>제공하는 것</Eyebrow>
          <Display className="mt-3">일에 집중할 수 있도록</Display>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b, i) => (
              <DarkCard key={b} className="border border-white/10">
                <p className="text-sm font-bold text-sky-400">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-3 text-base font-bold">{b}</p>
              </DarkCard>
            ))}
          </div>
          <DarkCard className="mt-12 flex flex-col gap-6 border border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">맞는 공고가 없나요?</p>
              <p className="mt-2 text-sm text-white/60">전문가 팀은 상시 지원을 받습니다. 포트폴리오만 있으면 됩니다.</p>
            </div>
            <Pill href="/creative-application" className="shrink-0">
              전문가로 지원 <ArrowRightIcon className="size-4" />
            </Pill>
          </DarkCard>
        </Container>
      </Section>
      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
