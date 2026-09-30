import { ArrowRightIcon, CheckCircle2Icon, CircleMinusIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { COMPARE_COLUMNS, COMPARE_ROWS, RECOMMENDED, TRUST_LOGOS, type Img } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * 공개 사이트 섹션 부품. 디자인 피클(designpickle.com)의 시각 언어를 그대로 옮긴다:
 * - 거의 검정(네이비) 바탕 ↔ 흰 바탕 섹션 교차, 큰 둥근(2xl) 카드
 * - 작은 대문자 눈썹(eyebrow) + 아주 크고 굵은 헤드라인
 * - 알약 버튼 (액센트 = 하늘색, 디자인 피클의 라임 역할)
 * - 큰 파란 숫자 + 점선 구분선, 해시태그 알약
 * 서버 컴포넌트만 (훅 없음). 상호작용 부품은 interactive.tsx.
 */

export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)} {...props} />;
}

export type Tone = "dark" | "light" | "gray";
const TONE: Record<Tone, string> = { dark: "bg-night-950 text-white", light: "bg-white text-ink-900", gray: "bg-ink-50 text-ink-900" };

export function Section({ tone = "dark", className, children, id }: { tone?: Tone; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn(TONE[tone], "py-16 sm:py-24", className)}>
      {children}
    </section>
  );
}

/** 섹션 사이 곡선 경계 (디자인 피클의 arc divider). from = 위 섹션 색, to = 아래 섹션 색 */
export function Arc({ from = "dark", to = "light" }: { from?: Tone; to?: Tone }) {
  const fill = { dark: "#0b1220", light: "#ffffff", gray: "#f8fafc" };
  return (
    <div className={cn("relative h-10 w-full overflow-hidden sm:h-16", TONE[to])} aria-hidden>
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M0,0 L1440,0 L1440,8 C1100,72 340,72 0,8 Z" fill={fill[from]} />
      </svg>
    </div>
  );
}

/** 눈썹 라벨. 어두운 바탕 = 하늘색, 흰 바탕 = 파랑 */
export function Eyebrow({ tone = "dark", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <p className={cn("eyebrow", tone === "dark" ? "text-sky-400" : "text-brand-600", className)}>{children}</p>;
}

type DisplaySize = "xl" | "lg" | "md" | "sm";
const DISPLAY: Record<DisplaySize, string> = {
  xl: "text-[44px] sm:text-6xl lg:text-7xl xl:text-[84px]",
  lg: "text-4xl sm:text-5xl lg:text-6xl",
  md: "text-3xl sm:text-4xl lg:text-5xl",
  sm: "text-2xl sm:text-3xl",
};

/** 큰 헤드라인 */
export function Display({ as: Tag = "h2", size = "lg", className, children }: { as?: "h1" | "h2" | "h3"; size?: DisplaySize; className?: string; children: React.ReactNode }) {
  return <Tag className={cn("display", DISPLAY[size], className)}>{children}</Tag>;
}

export function Lead({ tone = "dark", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <p className={cn("text-lg leading-relaxed sm:text-xl", tone === "dark" ? "text-white/70" : "text-ink-600", className)}>{children}</p>;
}

/** 알약 링크 버튼 */
export function Pill({ href, variant = "primary", size = "lg", className, children }: { href: string; variant?: "primary" | "outlineLight" | "outline" | "dark"; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/** 임시 사진. 실제 이미지가 오면 content/site.ts 의 ph() 자리만 바꾸면 된다. */
export function Photo({ img, alt = "", className, priority = false, sizes }: { img: Img; alt?: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-night-800", className)}>
      <Image src={img.src} alt={alt} fill sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"} className="object-cover" priority={priority} unoptimized />
    </div>
  );
}

/** 해시태그 알약 (#메뉴 같은 것) */
export function Tag({ tone = "dark", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide uppercase", tone === "dark" ? "border-white/20 bg-white/5 text-white/80" : "border-ink-200 bg-ink-50 text-ink-700")}>
      {children}
    </span>
  );
}

/** 어두운 카드 */
export function DarkCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl bg-night-900 p-6 sm:p-8", className)} {...props} />;
}

/** 흰 바탕 카드 */
export function LightCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-ink-200 bg-white p-6 sm:p-8", className)} {...props} />;
}

/** "샘플" 표시 — 실제 콘텐츠로 교체해야 하는 자리 */
export function SampleBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center rounded-sm border border-dashed border-current px-1.5 py-0.5 text-[10px] font-semibold tracking-wide opacity-60", className)}>샘플</span>;
}

/** 큰 파란 숫자 + 설명 + 점선 (흰 바탕) */
export function BigNumber({ value, body }: { value: string; body: string }) {
  return (
    <div className="border-b border-dotted border-ink-300 pb-6">
      <p className="text-6xl font-extrabold tracking-tight text-brand-600 sm:text-7xl lg:text-8xl">{value}</p>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-700">{body}</p>
    </div>
  );
}

/** 사진 위 큰 숫자 카드 */
export function PhotoStat({ value, label, image, accent = false }: { value: string; label: string; image: Img; accent?: boolean }) {
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-[5/6]", accent ? "bg-brand-600" : "bg-night-900")}>
      {!accent ? <Image src={image.src} alt="" fill className="object-cover opacity-70" unoptimized /> : <div className="absolute inset-6 rounded-xl border border-dashed border-white/30" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950/90 to-transparent p-6 text-white">
        <p className="text-4xl font-extrabold tracking-tight sm:text-5xl">{value}</p>
        <p className="mt-2 text-sm text-white/80">{label}</p>
      </div>
    </div>
  );
}

/** 신뢰 로고 띠 */
export function TrustStrip({ tone = "dark", title = "빠르게 성장하는 브랜드와 동네 가게가 함께 씁니다." }: { tone?: Tone; title?: string }) {
  return (
    <div>
      <p className={cn("text-[15px] font-semibold", tone === "dark" ? "text-white" : "text-ink-900")}>{title}</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-5 opacity-70">
        {TRUST_LOGOS.map((l, i) => (
          <Image key={i} src={l.src} alt={`고객 로고 ${i + 1} (임시)`} width={120} height={45} className={cn("h-7 w-auto", tone === "light" && "invert")} unoptimized />
        ))}
      </div>
      <p className={cn("mt-3 text-[11px]", tone === "dark" ? "text-white/40" : "text-ink-400")}>
        <SampleBadge className="mr-1.5" />
        로고는 임시입니다. 실제 고객 로고로 교체하세요.
      </p>
    </div>
  );
}

/** 비교표 (플랫폼 · 속도 · 품질 · 지원 · 비용) */
export function ComparisonTable() {
  const icon = (v: "yes" | "no" | "partial") =>
    v === "yes" ? <CheckCircle2Icon className="mx-auto size-5 text-brand-600" /> : v === "partial" ? <CircleMinusIcon className="mx-auto size-5 text-ink-400" /> : <XCircleIcon className="mx-auto size-5 text-ink-300" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="pb-4 text-left align-bottom text-xs font-medium text-ink-500">항목</th>
            {COMPARE_COLUMNS.map((c) => (
              <th key={c} className="pb-4 text-center align-bottom text-xs font-semibold text-ink-700">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((r, i) => (
            <tr key={r.label} className={cn(i === 0 && "bg-sky-50")}>
              <td className={cn("border-t border-ink-200 py-5 pr-6", i === 0 && "rounded-l-2xl")}>
                <p className={cn("text-base font-bold", i === 0 && "text-brand-700")}>{r.label}</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-500">{r.body}</p>
              </td>
              {r.cells.map((c, j) => (
                <td key={j} className="border-t border-l border-ink-200 px-4 py-5 text-center">
                  {icon(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex flex-wrap gap-5 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2Icon className="size-3.5 text-brand-600" /> 강점
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleMinusIcon className="size-3.5 text-ink-400" /> 경우에 따라
        </span>
        <span className="inline-flex items-center gap-1">
          <XCircleIcon className="size-3.5 text-ink-300" /> 약점
        </span>
      </p>
    </div>
  );
}

/** "궁금한 점이 있나요?" 카드 (어두운 섹션 안) */
export function QuestionsCard() {
  return (
    <DarkCard className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-night-800">
        <span className="block h-8 w-10 rounded-b-full border-4 border-white/80 border-t-0" />
      </div>
      <div className="flex-1">
        <p className="text-xl font-bold">궁금한 점이 있나요?</p>
        <p className="mt-1 text-sm text-white/60">평일 10:00~18:00 실시간 채팅으로 답합니다. 도움말 센터에서 자주 묻는 질문을 먼저 확인해 보세요.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/live-chat" className="text-sky-400 hover:underline">
            채팅으로 연결
          </Link>
          <Link href="/help" className="text-white/70 hover:text-white">
            도움말 센터
          </Link>
        </div>
      </div>
    </DarkCard>
  );
}

/** "시간 있으신가요? 추천" 3장 (흰 바탕) */
export function RecommendSection() {
  return (
    <Section tone="gray">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            <Eyebrow tone="light">시간 있으신가요?</Eyebrow>
            <Display className="mt-3">추천 읽을거리</Display>
          </div>
          <Pill href="/blog" variant="outline" size="md" className="shrink-0">
            전체 보기 <ArrowRightIcon className="size-4" />
          </Pill>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {RECOMMENDED.map((r) => (
            <Link key={r.href} href={r.href} className="group overflow-hidden rounded-2xl border border-ink-200 bg-white">
              <Photo img={r.image} className="aspect-[16/10] rounded-none" />
              <div className="p-5">
                <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{r.kind}</p>
                <p className="mt-2 text-[15px] font-semibold leading-snug group-hover:underline">{r.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** 페이지 공통 히어로 (왼쪽 정렬, 어두운 바탕) */
export function Hero({ eyebrow, title, lead, primary, secondary, image, center = false, size = "xl" }: { eyebrow: string; title: React.ReactNode; lead?: string; primary?: { href: string; label: string }; secondary?: { href: string; label: string }; image?: Img; center?: boolean; size?: DisplaySize }) {
  return (
    <section className="bg-night-950 text-white">
      <Container className={cn("pt-16 pb-14 sm:pt-24 sm:pb-20", image && "grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]", center && "text-center")}>
        <div className={cn(center && "mx-auto max-w-3xl")}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Display as="h1" size={size} className="mt-4">
            {title}
          </Display>
          {lead ? <Lead className={cn("mt-6 max-w-2xl", center && "mx-auto")}>{lead}</Lead> : null}
          {primary || secondary ? (
            <div className={cn("mt-8 flex flex-wrap gap-3", center && "justify-center")}>
              {primary ? <Pill href={primary.href}>{primary.label}</Pill> : null}
              {secondary ? (
                <Pill href={secondary.href} variant="outlineLight">
                  {secondary.label}
                </Pill>
              ) : null}
            </div>
          ) : null}
        </div>
        {image ? <Photo img={image} className="aspect-[4/3] w-full" priority /> : null}
      </Container>
    </section>
  );
}
