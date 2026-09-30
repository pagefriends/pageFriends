import { BookOpenIcon, ClockIcon, MailIcon, MessageCircleIcon, PhoneIcon, UserCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, Container, Display, Eyebrow, Hero, Lead, LightCard, Pill, RecommendSection, Section } from "@/components/marketing/primitives";
import { SUPPORT, ph } from "@/content/site";

export const metadata: Metadata = { title: "실시간 채팅" };

/**
 * 실시간 지원. 디자인 피클 /24-live-chat 구성을 따르되, 우리는 24시간이 아니라 평일 10~18시 사람이 답한다.
 *   히어로 → 3카드 + 운영시간(흰) → 채팅 시작 + FAQ(어두움) → 추천
 */
const CARDS = [
  { icon: MessageCircleIcon, title: "평균 응답 10분 이내 목표", body: "운영 시간 안에는 담당자가 채팅으로 바로 답합니다. 사이트 이름을 함께 적으면 더 빨리 찾을 수 있습니다." },
  { icon: BookOpenIcon, title: "도움말 센터", body: "시작하기 · 수정 요청 · 요금 · 결제에 대한 자주 묻는 질문을 먼저 확인해 보세요. 대부분은 채팅 없이 해결됩니다.", href: "/help", label: "도움말 보기" },
  { icon: UserCheckIcon, title: "전문가 요청", body: "사진 교체 · 구조 변경처럼 사람이 필요한 작업은 채팅이 아니라 편집기에서 네모를 그려 전문가 요청으로 보내세요.", href: "/demo", label: "편집기 체험" },
];

const FAQ = [
  { q: "채팅은 언제 이용할 수 있나요?", a: `${SUPPORT.hours}에 사람이 답합니다. 그 외 시간에 남긴 메시지는 다음 영업일 시작과 함께 순서대로 답변합니다.` },
  { q: "채팅으로 수정 요청을 보내도 되나요?", a: "수정 요청은 편집기에서 네모를 그려 보내야 처리 · 기록됩니다. 채팅은 사용법 · 결제 · 계정 문의에 이용해 주세요." },
  { q: "긴급한 오류가 났어요.", a: "사이트가 열리지 않거나 결제가 안 되는 문제는 채팅에 '긴급' 이라고 적어 주세요. 우리 쪽 오류는 오류 신고로 접수해도 차감이 없습니다." },
  { q: "채팅 기록은 남나요?", a: "네. 로그인한 계정 기준으로 대화 기록이 남아 이어서 문의할 수 있습니다. 기록은 개인정보처리방침에 따라 보관합니다." },
];

export default function LiveChatPage() {
  return (
    <>
      <Hero
        eyebrow="실시간 지원"
        title={
          <>
            평일 10시부터 18시까지,
            <br />
            사람이 답합니다
          </>
        }
        lead="봇이 아니라 페이지프렌즈 담당자가 채팅으로 답합니다. 사용법, 결제, 계정, 진행 상황. 무엇이든 물어보세요."
        primary={{ href: "#chat", label: "채팅 시작" }}
        secondary={{ href: "/help", label: "도움말 센터" }}
        image={ph("photo", 2)}
        size="lg"
      />
      <Arc from="dark" to="light" />

      {/* 3카드 + 운영시간 */}
      <Section tone="light">
        <Container>
          <div className="grid gap-4 md:grid-cols-3">
            {CARDS.map((c) => (
              <LightCard key={c.title} className="flex flex-col">
                <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <c.icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold">{c.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-ink-600">{c.body}</p>
                {c.href ? (
                  <Link href={c.href} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
                    {c.label} →
                  </Link>
                ) : null}
              </LightCard>
            ))}
          </div>

          <LightCard className="mt-6 grid gap-6 bg-ink-50 sm:grid-cols-3">
            <div className="flex gap-3">
              <ClockIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">운영 시간</p>
                <p className="mt-1 text-base font-bold">{SUPPORT.hours}</p>
                <p className="mt-0.5 text-xs text-ink-500">주말 · 공휴일 휴무</p>
              </div>
            </div>
            <div className="flex gap-3">
              <MailIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">이메일</p>
                <a href={`mailto:${SUPPORT.email}`} className="mt-1 block text-base font-bold hover:underline">
                  {SUPPORT.email}
                </a>
                <p className="mt-0.5 text-xs text-ink-500">영업일 기준 1일 안에 답변</p>
              </div>
            </div>
            <div className="flex gap-3">
              <PhoneIcon className="mt-0.5 size-5 shrink-0 text-brand-600" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">전화</p>
                <a href={`tel:${SUPPORT.phone.replace(/-/g, "")}`} className="mt-1 block text-base font-bold hover:underline">
                  {SUPPORT.phone}
                </a>
                <p className="mt-0.5 text-xs text-ink-500">운영 시간 내</p>
              </div>
            </div>
          </LightCard>
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 채팅 시작 + FAQ */}
      <Section tone="dark" id="chat">
        <Container className="lg:grid lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <Eyebrow>지금 바로</Eyebrow>
            <Display className="mt-3">채팅 시작</Display>
            <Lead className="mt-5">로그인하면 계정과 사이트 정보를 함께 보내 더 빨리 답할 수 있습니다.</Lead>
            <div className="mt-8">
              <Pill href="#chat">채팅 시작</Pill>
            </div>
            <p className="mt-4 text-xs text-white/50">채팅 위젯은 곧 연결됩니다. 그때까지는 이메일 · 전화로 문의해 주세요.</p>
          </div>
          <div className="mt-12 lg:mt-0">
            <Eyebrow>자주 묻는 질문</Eyebrow>
            <div className="mt-4">
              <FaqAccordion items={FAQ} tone="dark" />
            </div>
          </div>
        </Container>
      </Section>
      <Arc from="dark" to="gray" />
      <RecommendSection />
    </>
  );
}
