import { MailIcon, MessageCircleIcon, SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/marketing/interactive";
import { Arc, Container, Display, Eyebrow, Lead, LightCard, Section } from "@/components/marketing/primitives";
import { ContactForm } from "@/components/site/contact-form";
import { HELP_FAQ, SUPPORT } from "@/content/site";

export const metadata: Metadata = { title: "도움말 센터" };

/**
 * 도움말 센터: 가운데 정렬 히어로 + 검색(→ /search) → FAQ 그룹(흰) → 문의 폼(어두움)
 */
export default function HelpPage() {
  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-16 text-center sm:pt-24 sm:pb-20">
          <div className="mx-auto max-w-3xl">
            <Eyebrow>도움말 센터</Eyebrow>
            <Display as="h1" size="xl" className="mt-4">
              자주 묻는 질문
            </Display>
            <Lead className="mx-auto mt-6 max-w-2xl">시작하기, 수정 요청, 요금 · 결제. 대부분의 궁금증은 여기서 풀립니다.</Lead>
            <form action="/search" method="get" role="search" className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-white/20 bg-white/5 p-1.5 pl-5 focus-within:border-sky-400">
              <SearchIcon className="size-5 shrink-0 text-white/50" aria-hidden />
              <input
                type="search"
                name="q"
                required
                placeholder="예: 토큰, 해지, 오류 신고"
                aria-label="도움말 검색"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <button type="submit" className="h-10 shrink-0 rounded-full bg-sky-400 px-5 text-sm font-semibold text-night-950 hover:bg-sky-300">
                검색
              </button>
            </form>
          </div>
        </Container>
      </section>
      <Arc from="dark" to="light" />

      {/* FAQ 그룹 */}
      <Section tone="light">
        <Container className="space-y-16">
          {HELP_FAQ.map((g) => (
            <div key={g.group} id={g.group} className="lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
              <div>
                <Eyebrow tone="light">주제</Eyebrow>
                <Display size="md" className="mt-3">
                  {g.group}
                </Display>
              </div>
              <div className="mt-6 lg:mt-0">
                <FaqAccordion items={g.items} />
              </div>
            </div>
          ))}
        </Container>
      </Section>
      <Arc from="light" to="dark" />

      {/* 문의 */}
      <Section tone="dark">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          <div>
            <div className="grid size-24 place-items-center rounded-2xl bg-night-800">
              <span className="block h-8 w-10 rounded-b-full border-4 border-white/80 border-t-0" />
            </div>
            <Display size="md" className="mt-8">
              궁금한 점이 있나요?
            </Display>
            <Lead className="mt-4">
              답을 못 찾으셨다면 문의를 남겨 주세요. {SUPPORT.hours}에는 실시간 채팅으로도 답합니다.
            </Lead>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              <Link href="/live-chat" className="inline-flex items-center gap-2 font-semibold text-sky-400 hover:underline">
                <MessageCircleIcon className="size-4" /> 실시간 채팅으로 연결
              </Link>
              <a href={`mailto:${SUPPORT.email}`} className="inline-flex items-center gap-2 text-white/70 hover:text-white">
                <MailIcon className="size-4" /> {SUPPORT.email}
              </a>
            </div>
          </div>
          <LightCard className="text-ink-900">
            <h2 className="text-xl font-bold">문의 남기기</h2>
            <p className="mt-1 text-sm text-ink-500">영업일 기준 1일 안에 이메일로 답변드립니다.</p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </LightCard>
        </Container>
      </Section>
    </>
  );
}
