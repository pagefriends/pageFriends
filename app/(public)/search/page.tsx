import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container, Display, Eyebrow, Section } from "@/components/marketing/primitives";
import { HELP_FAQ, POSTS, RESOURCES, SOLUTIONS, STORIES } from "@/content/site";

export const metadata: Metadata = { title: "검색" };

/**
 * 사이트 검색. 검색 엔진 없이 content/site.ts 의 정적 콘텐츠를 부분 문자열로 찾는다.
 * 콘텐츠가 DB 로 옮겨가면 여기서 인덱스 생성만 바꾸면 된다.
 */
type Entry = { type: string; title: string; excerpt: string; href: string; haystack: string };

const TYPE_ORDER = ["페이지", "솔루션", "도움말", "블로그", "고객 사례", "리소스"];

const FIXED_PAGES: { title: string; excerpt: string; href: string }[] = [
  { title: "플랫폼", excerpt: "대시보드 · 편집기 · 네모 수정 요청. 페이지프렌즈가 돌아가는 방식", href: "/platform" },
  { title: "요금제", excerpt: "스타터 · 비즈니스 · 프로 · 엔터프라이즈 4개 플랜과 크레딧, 템플릿 가격", href: "/pricing" },
  { title: "템플릿", excerpt: "완성 디자인 데모 사이트와 운영 중인 사이트 템플릿", href: "/templates" },
  { title: "이용 방법", excerpt: "필수 정보 입력 → 제작 → 네모로 수정 요청 → 운영", href: "/how-it-works" },
  { title: "회사 소개", excerpt: "페이지프렌즈는 누구이고 무엇을 약속하는가", href: "/about" },
  { title: "채용", excerpt: "채용 중인 포지션과 일하는 방식, 제공하는 것", href: "/careers" },
  { title: "상담 신청", excerpt: "30분 무료 통화로 맞는 플랜과 페이지 구성을 정리", href: "/consultation" },
];

function buildIndex(): Entry[] {
  const entries: Entry[] = [];
  const add = (type: string, title: string, excerpt: string, href: string, extra = "") => entries.push({ type, title, excerpt, href, haystack: `${title} ${excerpt} ${extra}`.toLowerCase() });
  for (const p of FIXED_PAGES) add("페이지", p.title, p.excerpt, p.href);
  for (const s of SOLUTIONS) add("솔루션", s.name, s.short, `/solutions/${s.slug}`, `${s.intro} ${s.tags.join(" ")} ${s.hashtags.join(" ")}`);
  for (const g of HELP_FAQ) for (const it of g.items) add("도움말", it.q, it.a, `/help#${encodeURIComponent(g.group)}`, g.group);
  for (const p of POSTS) add("블로그", p.title, p.excerpt, `/blog/${p.slug}`, p.category);
  for (const s of STORIES) add("고객 사례", s.headline, s.summary, `/customer-stories/${s.slug}`, s.company);
  for (const r of RESOURCES) add("리소스", r.title, r.excerpt, r.href);
  return entries;
}

const INDEX = buildIndex();

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const needle = q.toLowerCase();
  const hits = needle ? INDEX.filter((e) => e.haystack.includes(needle)) : [];
  const groups = TYPE_ORDER.map((type) => ({ type, items: hits.filter((h) => h.type === type) })).filter((g) => g.items.length > 0);

  return (
    <>
      <section className="bg-night-950 text-white">
        <Container className="pt-16 pb-14 sm:pt-24 sm:pb-16">
          <Eyebrow>검색</Eyebrow>
          <Display as="h1" size="lg" className="mt-4">
            {q ? `“${q}” 검색 결과` : "무엇을 찾으세요?"}
          </Display>
          <form action="/search" method="get" role="search" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-white/20 bg-white/5 p-1.5 pl-5 focus-within:border-sky-400">
            <SearchIcon className="size-5 shrink-0 text-white/50" aria-hidden />
            <input type="search" name="q" defaultValue={q} required placeholder="예: 쇼핑몰, 토큰, 해지" aria-label="검색어" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none" />
            <button type="submit" className="h-10 shrink-0 rounded-full bg-sky-400 px-5 text-sm font-semibold text-night-950 hover:bg-sky-300">
              검색
            </button>
          </form>
          {q ? <p className="mt-4 text-sm text-white/50">{hits.length}건</p> : null}
        </Container>
      </section>

      <Section tone="light" className="min-h-[40vh]">
        <Container>
          {!q ? (
            <p className="text-sm text-ink-500">검색어를 입력하세요. 솔루션, 도움말, 블로그, 고객 사례, 리소스, 주요 페이지에서 찾습니다.</p>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-10 text-center">
              <p className="text-lg font-bold">“{q}” 에 맞는 결과가 없습니다</p>
              <p className="mt-2 text-sm text-ink-500">다른 단어로 다시 찾거나, 도움말 센터와 실시간 채팅을 이용해 보세요.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold">
                <Link href="/help" className="text-brand-600 hover:underline">
                  도움말 센터
                </Link>
                <Link href="/live-chat" className="text-brand-600 hover:underline">
                  실시간 채팅
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map((g) => (
                <div key={g.type}>
                  <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    {g.type} · {g.items.length}
                  </h2>
                  <ul className="mt-3 divide-y divide-ink-200 border-y border-ink-200">
                    {g.items.map((it) => (
                      <li key={`${it.type}-${it.href}-${it.title}`}>
                        <Link href={it.href} className="block py-4 hover:bg-ink-50">
                          <p className="text-base font-bold">{it.title}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-ink-600">{it.excerpt}</p>
                          <p className="mt-1 text-xs text-ink-400">{it.href}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
