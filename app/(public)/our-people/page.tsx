import { BadgeCheckIcon, ScaleIcon, WorkflowIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Arc, Container, DarkCard, Display, Eyebrow, Hero, Lead, LightCard, Photo, QuestionsCard, RecommendSection, Section, Tag, TrustStrip } from "@/components/marketing/primitives";
import { DELIVERY_DAYS } from "@/config/plans";
import { FUN_FACTS, SOLUTIONS, ph } from "@/content/site";

export const metadata: Metadata = { title: "우리 팀" };

/**
 * 우리 팀. 디자인 피클 /our-people 구성:
 *   히어로 → 신뢰 띠 → 제작 화력(사진 + 3카드, 흰) → FUN FACTS(회색) → 만드는 것 12카드 + 질문 카드(어두움) → 추천
 */
const PILLARS = [
  { icon: BadgeCheckIcon, title: "검증된 전문가", body: "포트폴리오 심사와 실무 테스트를 통과한 디자이너 · 개발자 · 카피라이터만 전문가 팀에 합류합니다. 결과물은 팀 리드가 한 번 더 봅니다." },
  { icon: WorkflowIcon, title: "일관된 품질 시스템", body: "브리프 → AI 초안 → 전문가 검수 → 디바이스별 캡처. 누가 맡아도 같은 순서, 같은 체크리스트로 진행하므로 품질 편차가 없습니다." },
  { icon: ScaleIcon, title: "언제나 합법적인 도구", body: "정식 라이선스의 폰트 · 아이콘 · 이미지와 상용 가능한 오픈소스만 씁니다. 완성된 사이트의 소유권은 고객에게 있습니다." },
];

export default function OurPeoplePage() {
  return (
    <>
      <Hero
        eyebrow="전담 팀을 만나세요"
        title={
          <>
            창의력에는
            <br />
            주소가 없습니다
          </>
        }
        lead="서울 사무실과 전국의 원격 전문가가 한 팀으로 일합니다. AI 가 초안을 만들면 사람이 구조 · 문구 · 반응형을 검수하고, 수정 요청 하나하나에 사람이 답합니다."
        primary={{ href: "/signup", label: "시작하기" }}
        secondary={{ href: "/careers", label: "함께 일하기" }}
        image={ph("photo", 6)}
      />
      <section className="bg-night-950 pb-16 text-white sm:pb-20">
        <Container>
          <TrustStrip />
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* 제작 화력 — 흰 바탕 */}
      <Section tone="light">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <Photo img={ph("photo", 8)} alt="" className="aspect-[4/3]" />
            <div>
              <Eyebrow tone="light">준비 완료</Eyebrow>
              <Display className="mt-3">제작 화력</Display>
              <Lead tone="light" className="mt-5">
                디자이너, 프론트엔드 개발자, 카피라이터, QA 가 한 브리프를 나눠 맡습니다. 필수 정보가 들어오면 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본을 올리고, 그 뒤로는
                네모 하나에 요청 하나로 계속 다듬습니다.
              </Lead>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-600">문구 · 색 · 간격처럼 바로 고칠 수 있는 것은 AI 가 반영하고, 사진 교체 · 구조 변경처럼 판단이 필요한 것은 전문가가 직접 손을 댑니다. 우리 쪽 실수는 오류 신고로 알려주시면 무료로 고칩니다.</p>
            </div>
          </div>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <LightCard key={p.title}>
                <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{p.body}</p>
              </LightCard>
            ))}
          </div>
        </Container>
      </Section>

      {/* FUN FACTS — 회색 */}
      <Section tone="gray" className="border-t border-ink-200">
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
      <Arc from="gray" to="dark" />

      {/* 만드는 것 — 어두운 바탕 */}
      <Section tone="dark">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>만드는 것</Eyebrow>
              <Display className="mt-3">이런 사이트를 만듭니다</Display>
            </div>
            <Link href="/templates" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
              템플릿 보기 →
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SOLUTIONS.slice(0, 12).map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group">
                <DarkCard className="h-full border border-white/10 transition-colors group-hover:border-sky-400/60">
                  <h3 className="text-lg font-bold">{s.name}</h3>
                  <p className="mt-1 text-sm text-white/50">{s.short}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.hashtags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </DarkCard>
              </Link>
            ))}
          </div>
          <div className="mt-12">
            <QuestionsCard />
          </div>
        </Container>
      </Section>
      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
