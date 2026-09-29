import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  ClockIcon,
  CreditCardIcon,
  LayoutTemplateIcon,
  MinusIcon,
  MonitorSmartphoneIcon,
  SquareDashedMousePointerIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PlanGrid } from "@/components/pricing/plan-grid";
import { buttonClass } from "@/components/ui/button";
import { CREDIT_PACKS, DELIVERY_DAYS, PLANS, TEMPLATE_PRICE_KRW, formatKrw, formatTokens } from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * 메인 페이지. 디자인 피클(designpickle.com) 홈의 섹션 구성을 그대로 따르고 색만 페이지프렌즈로 바꿨다.
 *   히어로(어두움) → 신뢰 띠 → 특징 6카드(어두움) → 숫자 통계(흰) → 카테고리+해시태그(어두움)
 *   → 4단계 커맨드 센터 → 비교표(흰) → 요금제(어두움) → FAQ → CTA
 * 숫자는 전부 실제 상품 조건(가격·기간·한도)만 쓴다. 고객 수·후기 같은 검증 안 된 수치는 넣지 않는다.
 */

const HERO_CARDS = [
  { src: "/samples/tpl-shop.svg", label: "쇼핑몰" },
  { src: "/samples/tpl-cafe.svg", label: "카페 · 매장" },
  { src: "/samples/tpl-clinic.svg", label: "병원 · 클리닉" },
  { src: "/samples/tpl-portfolio.svg", label: "포트폴리오" },
];

const FEATURES = [
  { icon: LayoutTemplateIcon, title: "템플릿 또는 프롬프트", body: "완성된 디자인의 데모 사이트, 소유자 동의를 받은 운영 사이트 중에 고르거나, 템플릿 없이 글로만 설명해도 됩니다." },
  { icon: ClockIcon, title: `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 완성`, body: "필수 정보 입력이 끝나면 첫 완성본이 올라옵니다. 기다리는 동안 대시보드에서 진행 상태를 봅니다." },
  { icon: SquareDashedMousePointerIcon, title: "네모 그려서 수정 요청", body: "완성 화면 캡처를 드래그·줌으로 살펴보고, 고칠 곳에 빨간 네모를 그린 뒤 번호별로 요청을 적습니다." },
  { icon: BotIcon, title: "AI 반영, 전문가 수정", body: "기본은 AI 가 바로 반영합니다. 사진 교체나 구조 변경처럼 사람이 필요한 건 전문가 요청으로 보냅니다." },
  { icon: MonitorSmartphoneIcon, title: "모바일 · 태블릿 · 웹", body: "화면별로 따로 확인하고 따로 수정 요청합니다. 페이지도 홈·안내·리뷰·상품·관리자까지 탭으로 오갑니다." },
  { icon: CreditCardIcon, title: "투명한 월 요금", body: `월 ${formatKrw(PLANS[0].priceKrw)}부터. AI 토큰을 다 쓰면 ${formatTokens(CREDIT_PACKS[0].amount)} 토큰 ${formatKrw(CREDIT_PACKS[0].priceKrw)}부터 추가할 수 있습니다.` },
];

const STATS = [
  { value: `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일`, body: "필수 정보 입력 후 첫 완성본까지 걸리는 시간. 에이전시 견적·미팅 없이 바로 시작합니다." },
  { value: formatKrw(PLANS[0].priceKrw), body: `가장 작은 플랜의 월 요금. 사이트 1개, 3~5페이지에 AI 토큰 월 ${formatTokens(PLANS[0].monthlyAiTokens ?? 0)}이 포함됩니다.` },
  { value: formatKrw(TEMPLATE_PRICE_KRW.demo), body: "완성 디자인 템플릿 1개 가격. 실제 운영 중인 사이트 템플릿은 8,900원입니다." },
  { value: "4개 플랜", body: "소개 사이트부터 쇼핑몰, 개인 앱까지. 규모가 커지면 플랜만 올리면 됩니다." },
];

const CATEGORIES = [
  { title: "홈페이지 · 소개", tags: ["#회사소개", "#포트폴리오", "#랜딩페이지", "#브랜드"] },
  { title: "매장 · 예약", tags: ["#카페", "#미용실", "#병원", "#학원", "#예약폼"] },
  { title: "쇼핑몰", tags: ["#상품목록", "#장바구니", "#결제연동", "#관리자페이지"] },
  { title: "콘텐츠 · 커뮤니티", tags: ["#블로그", "#공지사항", "#게시판", "#리뷰"] },
  { title: "기능형 사이트", tags: ["#회원가입", "#로그인", "#문의폼", "#지도"] },
  { title: "개인 앱", tags: ["#모바일앱", "#엔터프라이즈", "#맞춤제작"] },
];

const STEPS = [
  { n: "1", title: "필수 정보 입력", body: "사이트 목적, 업종, 디자인 톤, 페이지 구성처럼 제작에 꼭 필요한 것만 묻습니다. 참고 사이트와 프롬프트도 함께." },
  { n: "2", title: "제작 진행 확인", body: "대시보드에서 상태를 봅니다. 완성되면 페이지별·디바이스별 캡처가 올라옵니다." },
  { n: "3", title: "네모로 수정 요청", body: "캡처 위에 빨간 네모를 그리고 번호별로 요청을 적은 뒤 한 번에 보냅니다. AI 반영 또는 전문가 요청." },
  { n: "4", title: "반영 확인, 운영 시작", body: "요청 내역에서 접수 · 처리중 · 반영 완료를 확인합니다. 답변도 같은 화면에 달립니다." },
];

type Mark = "good" | "mid" | "bad";
const COMPARE: { label: string; rows: Record<string, Mark> }[] = [
  { label: "시작까지 걸리는 시간", rows: { pf: "good", diy: "mid", freelancer: "mid", agency: "bad" } },
  { label: "완성 속도", rows: { pf: "good", diy: "mid", freelancer: "mid", agency: "bad" } },
  { label: "디자인 품질", rows: { pf: "good", diy: "bad", freelancer: "mid", agency: "good" } },
  { label: "수정 요청 방식", rows: { pf: "good", diy: "bad", freelancer: "mid", agency: "mid" } },
  { label: "월 비용", rows: { pf: "good", diy: "good", freelancer: "mid", agency: "bad" } },
  { label: "운영 중 지원", rows: { pf: "good", diy: "bad", freelancer: "bad", agency: "mid" } },
];
const COMPARE_COLS = [
  { key: "pf", label: "페이지프렌즈", body: "템플릿·프롬프트로 시작해 며칠 안에 완성. 수정은 네모 그려서 요청." },
  { key: "diy", label: "직접 제작 (노코드)", body: "빠르지만 결과물이 어설프고, 완성까지 손이 많이 갑니다." },
  { key: "freelancer", label: "프리랜서", body: "사람마다 편차가 크고, 매번 찾고 관리해야 합니다." },
  { key: "agency", label: "에이전시", body: "품질은 좋지만 견적·미팅·긴 일정과 높은 비용." },
];

const FAQ = [
  { q: "템플릿 없이도 만들 수 있나요?", a: "네. 원하는 사이트를 글로 설명하면 처음부터 디자인합니다. 템플릿은 완성된 구조를 빨리 가져오고 싶을 때만 고르면 됩니다." },
  { q: "수정 요청은 어떻게 하나요?", a: "완성 화면 캡처 위에 빨간 네모를 그리고, 오른쪽에 번호별 요청사항을 적은 뒤 '한번에 요청하기'를 누릅니다. 기본은 AI 반영, 필요하면 전문가 요청으로 바꿀 수 있습니다." },
  { q: "AI 토큰이나 전문가 요청 횟수를 다 쓰면요?", a: `추가 크레딧을 구매해 이어갑니다. AI 토큰 ${formatTokens(CREDIT_PACKS[0].amount)} ${formatKrw(CREDIT_PACKS[0].priceKrw)}, 전문가 요청 1회 ${formatKrw(CREDIT_PACKS[2].priceKrw)}부터이며 크레딧은 만료되지 않습니다.` },
  { q: "우리 쪽 실수로 생긴 오류도 요청 횟수에서 차감되나요?", a: "아니요. 네모를 그리고 종류를 '오류 신고'로 바꾸면 토큰·횟수 어디에서도 차감하지 않습니다." },
  { q: "언제든 해지할 수 있나요?", a: "네. 해지하면 현재 결제 기간이 끝날 때까지 그대로 이용하고, 그 뒤로는 결제되지 않습니다. 기간 안에는 해지를 취소할 수도 있습니다." },
];

export default function HomePage() {
  return (
    <>
      {/* 히어로 — 어두운 바탕, 눈썹 라벨, 큰 헤드라인, 알약 버튼 2개, 오른쪽 미리보기 카드 */}
      <section className="bg-night-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-24">
          <div>
            <p className="eyebrow text-sky-400">AI 웹사이트 제작 · 한국어 지원</p>
            <h1 className="display mt-4 text-[44px] sm:text-6xl lg:text-7xl">
              설명만 하면
              <br />
              웹사이트가
              <br />
              완성됩니다
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              페이지프렌즈는 템플릿 또는 프롬프트만으로 시작하는 웹사이트 제작 서비스입니다. {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본을
              받고, 화면 위에 네모를 그려 수정을 요청하면 AI 와 전문가가 반영합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass("primary", "lg")}>
                시작하기
              </Link>
              <Link href="/demo" className={buttonClass("outlineLight", "lg")}>
                어떻게 되는지 보기
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {HERO_CARDS.map((c, i) => (
                <div key={c.src} className={cn("overflow-hidden rounded-2xl border border-white/10 bg-night-900", i % 2 === 1 && "translate-y-6")}>
                  <div className="relative aspect-[4/3]">
                    <Image src={c.src} alt={c.label} fill className="object-cover" unoptimized />
                  </div>
                  <p className="px-4 py-3 text-sm font-semibold">{c.label}</p>
                </div>
              ))}
            </div>
            {/* 수정 요청 네모 예시 */}
            <div className="absolute -left-3 top-10 hidden rounded-xl border border-white/10 bg-night-900/95 p-3 text-xs shadow-xl backdrop-blur sm:block">
              <p className="font-semibold">
                <span className="mr-1.5 inline-block bg-mark px-1 text-[10px] text-white">1</span>제목을 더 짧게
              </p>
              <p className="mt-1 text-white/50">AI 반영 · 접수</p>
            </div>
          </div>
        </div>
        {/* 신뢰 띠: 만들 수 있는 사이트 종류 */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-5 text-sm text-white/50 sm:px-8">
            <span className="font-semibold text-white/80">이런 사이트를 만듭니다</span>
            {["회사 소개", "카페 · 매장", "병원 · 클리닉", "학원", "쇼핑몰", "포트폴리오", "예약 · 문의", "개인 앱"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 특징 6카드 — 어두운 카드 그리드 */}
      <section className="bg-night-950 pb-24 text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="eyebrow text-center text-sky-400">사람이 검수하는 AI 제작</p>
          <h2 className="display mx-auto mt-3 max-w-3xl text-center text-4xl sm:text-5xl">
            AI 가 만들고,
            <br />
            전문가가 마무리합니다
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-night-900 p-7">
                <span className="grid size-11 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-6 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 숫자 통계 — 흰 바탕, 큰 파란 숫자, 점선 구분 */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-brand-600">숫자로 보는 조건</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">제작부터 운영까지, 조건은 이렇습니다</h2>
          <p className="mt-3 max-w-2xl text-ink-500">추정치가 아니라 실제 상품 조건입니다. 플랜에 따라 달라지는 값은 요금제에서 확인하세요.</p>
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {STATS.map((s) => (
              <div key={s.value} className="border-b border-dotted border-ink-300 pb-8">
                <p className="text-5xl font-extrabold tracking-tight text-brand-600 sm:text-6xl">{s.value}</p>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-700">{s.body}</p>
              </div>
            ))}
          </div>
          {/* 사진 카드 3개: 큰 숫자 오버레이 */}
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { src: "/samples/home-desktop.svg", n: "3", label: "화면 크기별 확인 (모바일 · 태블릿 · 웹)" },
              { src: "/samples/products-desktop.svg", n: "10회", label: "비즈니스 플랜 주간 AI 수정 요청" },
              { src: "/samples/admin-desktop.svg", n: "무제한", label: "엔터프라이즈 플랜 AI · 전문가 요청" },
            ].map((c) => (
              <div key={c.label} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-night-900">
                <Image src={c.src} alt="" fill className="object-cover object-top opacity-50" unoptimized />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950 to-transparent p-6 text-white">
                  <p className="text-5xl font-extrabold tracking-tight">{c.n}</p>
                  <p className="mt-2 text-sm text-white/70">{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 카테고리 + 해시태그 — 어두운 바탕 */}
      <section className="bg-night-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-sky-400">만드는 것</p>
              <h2 className="display mt-3 max-w-2xl text-4xl sm:text-5xl">
                소개 페이지부터
                <br />
                쇼핑몰, 앱까지 한 곳에서
              </h2>
            </div>
            <Link href="/templates" className={buttonClass("primary", "md")}>
              템플릿 보기
            </Link>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c.title} className="rounded-2xl border border-white/10 bg-night-900 p-6">
                <h3 className="text-lg font-bold">{c.title}</h3>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase text-white/70">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 커맨드 센터 — 4단계 + 편집 화면 */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-center text-brand-600">입력. 확인. 네모. 완료.</p>
          <h2 className="display mx-auto mt-3 max-w-3xl text-center text-4xl sm:text-5xl">내 사이트의 컨트롤 타워</h2>
          <div className="mt-8 flex justify-center">
            <Link href="/demo" className={buttonClass("dark", "md")}>
              편집 화면 체험 <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <div className="mt-12 overflow-hidden rounded-2xl border border-ink-200 bg-ink-50">
            <div className="flex h-9 items-center gap-1.5 border-b border-ink-200 bg-white px-4">
              <span className="size-2.5 rounded-full bg-ink-300" />
              <span className="size-2.5 rounded-full bg-ink-300" />
              <span className="size-2.5 rounded-full bg-ink-300" />
              <span className="ml-3 text-xs text-ink-400">pagefriends.kr/projects/데일리샵</span>
            </div>
            <div className="relative aspect-[16/8] overflow-hidden">
              <Image src="/samples/home-desktop.svg" alt="편집 화면" fill className="object-cover object-top" unoptimized />
              <div className="absolute left-[6%] top-[22%] h-[26%] w-[36%] border-2 border-mark">
                <span className="absolute -left-0.5 -top-5 bg-mark px-1.5 text-[11px] font-semibold text-white">1</span>
              </div>
              <div className="absolute right-[8%] top-[16%] h-[42%] w-[34%] border-2 border-mark">
                <span className="absolute -left-0.5 -top-5 bg-mark px-1.5 text-[11px] font-semibold text-white">2</span>
              </div>
              <div className="absolute bottom-4 right-4 w-64 rounded-xl border border-ink-200 bg-white p-3 text-xs shadow-lg">
                <p className="font-semibold">
                  <span className="mr-1.5 inline-block bg-mark px-1 text-[10px] text-white">1</span>제목 문구를 더 짧게
                </p>
                <p className="mt-1 text-ink-500">AI 반영 · 접수</p>
                <p className="mt-2 font-semibold">
                  <span className="mr-1.5 inline-block bg-mark px-1 text-[10px] text-white">2</span>실제 상품 사진으로 교체
                </p>
                <p className="mt-1 text-ink-500">전문가 요청 · 처리중</p>
              </div>
            </div>
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n}>
                <p className="text-sm font-bold text-brand-600">{s.n}.</p>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 비교표 — 왜 페이지프렌즈인가 */}
      <section className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="eyebrow text-brand-600">당신을 위해 만들었습니다</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">왜 페이지프렌즈인가</h2>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-44 pb-4 text-left align-bottom text-xs font-semibold text-ink-500">항목</th>
                  {COMPARE_COLS.map((c) => (
                    <th key={c.key} className={cn("pb-4 text-left align-bottom", c.key === "pf" && "text-brand-700")}>
                      <p className="text-base font-bold">{c.label}</p>
                      <p className="mt-1 max-w-[180px] text-xs font-normal leading-relaxed text-ink-500">{c.body}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label}>
                    <td className="border-t border-ink-200 py-3.5 font-medium">{row.label}</td>
                    {COMPARE_COLS.map((c) => (
                      <td key={c.key} className={cn("border-t border-ink-200 py-3.5", c.key === "pf" && "bg-brand-50/60")}>
                        <MarkIcon mark={row.rows[c.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex gap-5 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <MarkIcon mark="good" /> 강점
            </span>
            <span className="inline-flex items-center gap-1">
              <MarkIcon mark="mid" /> 경우에 따라
            </span>
            <span className="inline-flex items-center gap-1">
              <MarkIcon mark="bad" /> 약점
            </span>
          </div>
        </div>
      </section>

      {/* 요금제 — 어두운 바탕 카드 */}
      <section className="bg-night-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-sky-400">투명한 요금</p>
              <h2 className="display mt-3 text-4xl sm:text-5xl">플랜은 4개, 숨은 비용은 없습니다</h2>
              <p className="mt-3 max-w-2xl text-white/60">월 단위 결제, 언제든 상위 플랜으로. AI 는 실제 사용한 토큰만큼만 차감되고, 한도를 넘으면 토큰 크레딧으로 이어갈 수 있습니다.</p>
            </div>
            <Link href="/pricing" className="text-sm font-semibold text-sky-300 hover:text-sky-200">
              요금제 자세히 →
            </Link>
          </div>
          <div className="mt-12">
            <PlanGrid tone="dark" ctaHref={(code) => `/signup?plan=${code}`} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:grid lg:grid-cols-[1fr_2fr] lg:gap-16">
          <div>
            <p className="eyebrow text-brand-600">자주 묻는 질문</p>
            <h2 className="display mt-3 text-4xl">궁금한 것</h2>
          </div>
          <dl className="mt-8 divide-y divide-ink-200 lg:mt-0">
            {FAQ.map((f) => (
              <div key={f.q} className="py-6">
                <dt className="text-lg font-bold">{f.q}</dt>
                <dd className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-sky-400 text-night-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-20 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="display text-4xl sm:text-5xl">이번 주 안에 첫 화면을 받아보세요</h2>
            <p className="mt-3 max-w-xl text-night-950/70">회원가입 후 플랜을 고르면 바로 제작이 시작됩니다. 템플릿은 선택 사항입니다.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass("dark", "lg")}>
              무료로 시작하기
            </Link>
            <Link href="/pricing" className={buttonClass("outline", "lg", "border-night-950/30 bg-transparent text-night-950 hover:border-night-950 hover:bg-transparent")}>
              요금제 보기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "good")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white">
        <CheckIcon className="size-3.5" />
      </span>
    );
  if (mark === "mid")
    return (
      <span className="grid size-6 place-items-center rounded-full bg-ink-200 text-ink-600">
        <MinusIcon className="size-3.5" />
      </span>
    );
  return (
    <span className="grid size-6 place-items-center rounded-full bg-ink-100 text-ink-400">
      <XIcon className="size-3.5" />
    </span>
  );
}
