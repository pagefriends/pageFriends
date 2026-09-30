import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, Container, DarkCard, Display, Eyebrow, Lead, LightCard, Photo, Pill, Section, Tag } from "@/components/marketing/primitives";
import { ApplicationForm } from "@/components/site/application-form";
import { SOLUTIONS, ph } from "@/content/site";

export const metadata: Metadata = { title: "전문가 지원" };

/**
 * 전문가 지원. 디자인 피클 /creative-application 구성:
 *   헤더(어두움) → 누가 맞을까요 + 경험을 즐기세요(흰) → 만드는 것(어두움) → 지원 폼(흰) → FAQ
 */
const REQUIREMENTS = [
  { title: "Figma · 디자인 툴 숙련", body: "Figma 를 기본으로, 포토샵 · 일러스트레이터 등 필요한 툴을 능숙하게 다룹니다." },
  { title: "반응형 구현 경험", body: "모바일 · 태블릿 · 웹 세 화면을 모두 고려해 설계하거나 구현해 본 경험이 있습니다." },
  { title: "한국어 커뮤니케이션", body: "브리프와 수정 요청을 정확히 읽고, 답변을 짧고 분명한 한국어로 씁니다." },
  { title: "고객 응대 경험", body: "비전문가 고객의 요청을 해석하고 대안을 제시해 본 경험이 있으면 좋습니다." },
  { title: "안정적인 장비 · 인터넷", body: "원격 작업이 가능한 컴퓨터와 인터넷 환경을 갖추고 있습니다." },
  { title: "팀 협업", body: "디자이너 · 개발자 · 카피라이터가 한 브리프를 나눠 맡습니다. 공유 문서와 체크리스트로 일합니다." },
  { title: "포트폴리오", body: "직접 만든 웹사이트 · 화면 · 글을 볼 수 있는 공개 링크가 있습니다." },
];

const PERKS = [
  { title: "원격 · 유연 근무", body: "어디서든, 정해진 시간대 안에서 자유롭게 일합니다." },
  { title: "AI 가 만든 초안에서 시작", body: "빈 화면이 아니라 AI 초안 위에서 판단과 마무리에 집중합니다." },
  { title: "명확한 브리프", body: "업종 · 목적 · 톤 · 페이지 구성이 정리된 브리프로 시작합니다. 추측할 필요가 없습니다." },
  { title: "네모 단위의 요청", body: "수정 요청은 화면 위 네모 하나에 요청 하나. 무엇을 고칠지 헷갈리지 않습니다." },
  { title: "투명한 정산", body: "처리한 요청과 완성본 기준으로 매월 정산합니다. 기준은 계약 시 문서로 드립니다." },
  { title: "성장하는 커뮤니티", body: "전문가 팀 채널에서 사례와 피드백을 나누고, 팀 리드가 검수 결과를 돌려줍니다." },
  { title: "도구 · 라이선스 제공", body: "Figma 팀 시트와 정식 라이선스의 폰트 · 이미지 · 아이콘을 제공합니다." },
];

const FAQ = [
  { q: "계약 형태는 어떻게 되나요?", a: "기본은 프리랜서(업무 위탁) 계약입니다. 정규직 · 계약직 공고는 채용 페이지에서 따로 안내합니다." },
  { q: "지원 자격이 있나요?", a: "학력 · 자격증은 보지 않습니다. 포트폴리오와 실무 테스트로 판단합니다. 한국어로 요청을 읽고 답변할 수 있어야 합니다." },
  { q: "프로젝트는 얼마나 주어지나요?", a: "가능한 시간과 분야를 등록하면 그에 맞춰 배정합니다. 주당 몇 시간만 하는 것도 가능합니다." },
  { q: "학력이나 전공이 중요한가요?", a: "아니요. 결과물로만 판단합니다." },
  { q: "지역 제한이 있나요?", a: "없습니다. 대한민국 어디서든 원격으로 일할 수 있습니다. 정산을 위해 국내 계좌가 필요합니다." },
  { q: "심사 과정은 어떻게 되나요?", a: "1) 지원서 · 포트폴리오 검토 → 2) 소규모 실무 테스트 → 3) 온라인 인터뷰 → 4) 계약. 보통 2주 안에 끝납니다." },
  { q: "탈락하면 피드백을 받을 수 있나요?", a: "실무 테스트 단계까지 간 지원자에게는 간단한 피드백을 이메일로 드립니다." },
  { q: "테스트 과제에 보상이 있나요?", a: "네. 실무 테스트는 소규모이며, 완료하면 정해진 금액을 지급합니다. 테스트 결과물은 채용 외 목적으로 쓰지 않습니다." },
  { q: "결과는 어떻게 통보되나요?", a: "각 단계 결과는 지원서에 적은 이메일로 보냅니다. 합격 · 불합격 모두 알려드립니다." },
  { q: "정산은 언제 되나요?", a: "매월 말 마감, 다음 달 10일 정산입니다. 세금계산서 또는 원천징수 방식은 계약 시 정합니다." },
];

/** 채용 공고 제목(?role=)을 폼의 지원 분야 선택지로 대응 */
function roleFromQuery(role: string | undefined): string | undefined {
  if (!role) return undefined;
  if (role.includes("디자이너")) return "웹 디자이너";
  if (role.includes("프론트엔드")) return "프론트엔드";
  if (role.includes("콘텐츠") || role.includes("카피")) return "콘텐츠 · 카피";
  if (role.includes("QA") || role.includes("검수")) return "QA · 검수";
  return undefined;
}

export default async function CreativeApplicationPage({ searchParams }: PageProps<"/creative-application">) {
  const sp = await searchParams;
  const defaultRole = roleFromQuery(typeof sp.role === "string" ? sp.role : undefined);
  return (
    <>
      {/* 헤더 */}
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-16 text-center sm:pt-24 sm:pb-20">
          <div className="mx-auto max-w-3xl">
            <Eyebrow>전문가로 합류하세요</Eyebrow>
            <Display as="h1" size="xl" className="mt-4">
              당신의 창작 여정이
              <br />
              여기서 시작됩니다
            </Display>
            <Lead className="mx-auto mt-6 max-w-2xl">
              페이지프렌즈 전문가 팀은 AI 초안을 검수하고 사장님의 수정 요청에 답하는 디자이너 · 개발자 · 카피라이터 · QA 로 이루어져 있습니다. 어디서든, 포트폴리오만 있으면 지원할 수 있습니다.
            </Lead>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Pill href="#apply">지금 지원하기</Pill>
              <Pill href="/our-people" variant="outlineLight">
                팀 알아보기
              </Pill>
            </div>
          </div>
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* 누가 맞을까요 */}
      <Section tone="light">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <Eyebrow tone="light">누가 맞을까요</Eyebrow>
              <Display className="mt-3">이런 분을 찾습니다</Display>
              <Lead tone="light" className="mt-5">
                모든 항목을 갖출 필요는 없습니다. 포트폴리오와 실무 테스트로 판단합니다.
              </Lead>
              <Photo img={ph("photo", 12)} alt="" className="mt-8 aspect-[4/3]" />
            </div>
            <ul className="divide-y divide-ink-200">
              {REQUIREMENTS.map((r) => (
                <li key={r.title} className="flex gap-4 py-5">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                    <CheckIcon className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-base font-bold">{r.title}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-600">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* 경험을 즐기세요 */}
          <div className="mt-24">
            <Eyebrow tone="light">경험을 즐기세요</Eyebrow>
            <Display className="mt-3">전문가 팀에서 얻는 것</Display>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PERKS.map((p, i) => (
                <LightCard key={p.title} className="bg-ink-50">
                  <p className="text-sm font-bold text-brand-600">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{p.body}</p>
                </LightCard>
              ))}
            </div>
          </div>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 만드는 것 */}
      <Section tone="dark">
        <Container>
          <Eyebrow>만드는 것</Eyebrow>
          <Display className="mt-3">이런 사이트를 함께 만듭니다</Display>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SOLUTIONS.slice(0, 12).map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="group">
                <DarkCard className="h-full border border-white/10 transition-colors group-hover:border-sky-400/60">
                  <h3 className="text-lg font-bold">{s.name}</h3>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.hashtags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                </DarkCard>
              </Link>
            ))}
          </div>
        </Container>
      </Section>
      <Arc from="dark" to="light" />

      {/* 지원 폼 */}
      <Section tone="light" id="apply">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
            <div>
              <Eyebrow tone="light">지원하기</Eyebrow>
              <Display className="mt-3">지원서를 보내주세요</Display>
              <Lead tone="light" className="mt-5">
                포트폴리오 링크 하나면 충분합니다. 검토 후 실무 테스트 안내를 이메일로 드립니다.
              </Lead>
              <ol className="mt-8 space-y-3 text-sm text-ink-600">
                {["지원서 · 포트폴리오 검토", "소규모 실무 테스트 (보상 지급)", "온라인 인터뷰", "계약 · 온보딩"].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <LightCard className="shadow-sm">
              <ApplicationForm defaultRole={defaultRole} />
            </LightCard>
          </div>
        </Container>
      </Section>

      {/* FAQ */}
      <Section tone="gray" className="border-t border-ink-200">
        <Container className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <Eyebrow tone="light">자주 묻는 질문</Eyebrow>
            <Display className="mt-3">지원 전에 궁금한 것</Display>
          </div>
          <div className="mt-8 lg:mt-0">
            <FaqAccordion items={FAQ} />
          </div>
        </Container>
      </Section>
    </>
  );
}
