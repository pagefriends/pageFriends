import {
  ActivityIcon,
  BellIcon,
  BotIcon,
  ChartBarIcon,
  CheckIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  CreditCardIcon,
  DatabaseIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  HistoryIcon,
  ImageIcon,
  LayersIcon,
  LayoutTemplateIcon,
  ListChecksIcon,
  MapPinIcon,
  MessageSquareIcon,
  MonitorSmartphoneIcon,
  PaletteIcon,
  PenLineIcon,
  ReceiptIcon,
  RefreshCwIcon,
  Share2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareDashedMousePointerIcon,
  StoreIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { Tabs } from "@/components/marketing/interactive";
import { Arc, Container, DarkCard, Display, Eyebrow, Hero, Lead, Photo, Pill, Section, TrustStrip } from "@/components/marketing/primitives";
import { Closing, TestimonialCarousel } from "@/components/marketing/sections";
import { DELIVERY_DAYS } from "@/config/plans";
import { ph } from "@/content/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "플랫폼 — 협업을 위해 만든 제작 허브" };

/**
 * 플랫폼 페이지. 디자인 피클 /platform 구성:
 * 가운데 히어로 → 4개 기둥(만들기 · 연결 · 협업 · 관리) 아이콘 타일 → 신뢰 띠 → 탭 → 기능 행 4개 → 후기 → 질문 → 추천
 */

type Tile = { icon: LucideIcon; label: string };
const PILLARS: { n: string; title: string; body: string; tiles: Tile[] }[] = [
  {
    n: "01",
    title: "만들기",
    body: "템플릿 또는 프롬프트로 시작합니다. 위저드가 필수 정보만 묻고, AI 가 초안을 만듭니다.",
    tiles: [
      { icon: LayoutTemplateIcon, label: "템플릿" },
      { icon: SparklesIcon, label: "프롬프트" },
      { icon: PenLineIcon, label: "위저드" },
      { icon: PaletteIcon, label: "디자인 톤" },
      { icon: FileTextIcon, label: "페이지 구성" },
      { icon: BotIcon, label: "AI 초안" },
    ],
  },
  {
    n: "02",
    title: "연결",
    body: "결제, 예약, 지도, SNS. 사이트가 실제로 일하게 만드는 연결을 붙입니다.",
    tiles: [
      { icon: CreditCardIcon, label: "결제 연동" },
      { icon: StoreIcon, label: "쇼핑몰" },
      { icon: MapPinIcon, label: "지도" },
      { icon: Share2Icon, label: "SNS" },
      { icon: DatabaseIcon, label: "CMS" },
      { icon: GlobeIcon, label: "도메인" },
    ],
  },
  {
    n: "03",
    title: "협업",
    body: "네모 하나에 요청 하나. AI 반영 · 전문가 요청 · 오류 신고를 네모마다 고르고 한 번에 보냅니다.",
    tiles: [
      { icon: SquareDashedMousePointerIcon, label: "네모 요청" },
      { icon: MonitorSmartphoneIcon, label: "화면별 확인" },
      { icon: MessageSquareIcon, label: "답변" },
      { icon: UsersIcon, label: "전문가" },
      { icon: ImageIcon, label: "사진 교체" },
      { icon: BellIcon, label: "알림" },
    ],
  },
  {
    n: "04",
    title: "관리",
    body: "사이트 여러 개를 대시보드 하나로. 요청 내역, 토큰 사용량, 결제까지 한 곳에서 봅니다.",
    tiles: [
      { icon: FolderIcon, label: "사이트 목록" },
      { icon: ListChecksIcon, label: "요청 내역" },
      { icon: CoinsIcon, label: "토큰 사용량" },
      { icon: ReceiptIcon, label: "결제 내역" },
      { icon: HistoryIcon, label: "버전 기록" },
      { icon: ChartBarIcon, label: "현황" },
    ],
  },
];

const TAB_CONTENT: { key: string; label: string; image: ReturnType<typeof ph>; points: string[] }[] = [
  { key: "make", label: "만들기", image: ph("wide", 1), points: ["템플릿(데모 · 운영 사이트) 또는 프롬프트만으로 시작", "위저드가 업종 · 목적 · 페이지 구성 · 톤만 묻습니다", `필수 정보 입력 후 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 첫 완성본`] },
  { key: "connect", label: "연결", image: ph("wide", 2), points: ["포트원(토스페이먼츠) 결제 연동 — 비즈니스 플랜 옵션", "예약 폼 · 문의 폼 · 카카오톡 채널 · 지도", "비즈니스 플랜부터 게시판 · 공지 등 CMS"] },
  { key: "collab", label: "협업", image: ph("wide", 3), points: ["캡처 위에 빨간 네모를 그리고 번호별로 요청", "AI 반영(토큰) · 전문가 요청(횟수) · 오류 신고(무료)", "접수 · 처리중 · 반영 완료와 답변을 같은 화면에서"] },
  { key: "manage", label: "관리", image: ph("wide", 4), points: ["플랜별 사이트 수 1 · 2 · 5 · 10개를 대시보드 하나로", "AI 토큰 사용량과 남은 한도를 실시간으로", "월 단위 결제, 언제든 플랜 변경 · 해지"] },
];

const FEATURE_ROWS: { eyebrow: string; title: string; body: string; bullets: string[]; image: ReturnType<typeof ph> }[] = [
  { eyebrow: "템플릿 · 프롬프트", title: "모든 시작 방식", body: "완성 디자인이 적용된 데모 사이트, 소유자 동의를 받은 운영 사이트 템플릿, 또는 글로만 설명하는 프롬프트. 어느 쪽이든 5분 안에 시작합니다.", bullets: ["데모 템플릿 1,000원 · 운영 사이트 8,900원", "템플릿 없이 프롬프트만으로도 가능", "참고 사이트 · 로고 첨부"], image: ph("wide", 5) },
  { eyebrow: "위저드", title: "안내형 입력 위저드", body: "사이트 이름, 업종, 목적, 페이지 구성, 디자인 톤. 제작에 꼭 필요한 것만 순서대로 묻습니다. 디자인 지식이 없어도 됩니다.", bullets: ["필수 항목만 5단계", "중간 저장 · 이어서 입력", "입력이 끝나면 바로 제작 시작"], image: ph("wide", 6) },
  { eyebrow: "모바일 · 태블릿 · 웹", title: "화면별로 확인", body: "완성본은 디바이스별 캡처로 올라옵니다. 화면마다 따로 보고, 따로 네모를 그려 요청합니다. 페이지도 탭으로 오갑니다.", bullets: ["스타터는 모바일 · 웹, 비즈니스부터 태블릿까지", "드래그 · 줌으로 세부 확인", "페이지 · 디바이스 상관없이 한 번에 요청"], image: ph("wide", 7) },
  { eyebrow: "AI 토큰제", title: "AI 토큰으로 투명하게", body: "AI 반영은 횟수가 아니라 실제 쓴 토큰만큼만 차감됩니다. 한도를 넘으면 크레딧으로 이어가고, 우리 쪽 오류 신고는 어디에서도 차감하지 않습니다.", bullets: ["플랜별 월 토큰 한도, 결제 기간마다 초기화", "크레딧은 만료 없음", "오류 신고 무료"], image: ph("wide", 8) },
];

export default function PlatformPage() {
  return (
    <>
      <Hero center size="lg" eyebrow="당신의 제작 허브" title="협업을 위해 만든 제작 허브" lead="만들기 · 연결 · 협업 · 관리. 사이트를 만들고 고치고 운영하는 모든 일이 대시보드 하나에서 일어납니다." primary={{ href: "/signup", label: "시작하기" }} secondary={{ href: "/demo", label: "편집 화면 체험" }} />

      {/* 4개 기둥 */}
      <Section tone="dark" className="pt-0 sm:pt-0">
        <Container>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PILLARS.map((p) => (
              <DarkCard key={p.n} className="flex flex-col">
                <p className="text-sm font-bold text-sky-400">{p.n}</p>
                <h2 className="mt-2 text-2xl font-bold">{p.title}</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-white/60">{p.body}</p>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {p.tiles.map((t) => (
                    <div key={t.label} className="flex flex-col items-center gap-2 rounded-xl bg-night-800 px-2 py-3 text-center">
                      <t.icon className="size-5 text-sky-300" />
                      <span className="text-[11px] font-semibold text-white/80">{t.label}</span>
                    </div>
                  ))}
                </div>
              </DarkCard>
            ))}
          </div>
          <div className="mt-16">
            <TrustStrip />
          </div>
        </Container>
      </Section>

      {/* 탭 */}
      <Section tone="dark" className="border-t border-white/10">
        <Container>
          <Eyebrow>당신을 위해</Eyebrow>
          <Display className="mt-3 max-w-3xl">필요한 기능, 필요한 순서로</Display>
          <div className="mt-10">
            <Tabs
              tabs={TAB_CONTENT.map((t) => ({
                key: t.key,
                label: t.label,
                content: (
                  <div className="grid items-center gap-8 lg:grid-cols-2">
                    <Photo img={t.image} alt="" className="aspect-[16/10]" />
                    <ul className="space-y-4">
                      {t.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-3 text-base leading-relaxed sm:text-lg">
                          <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-sky-400 text-night-950">
                            <CheckIcon className="size-3.5" />
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              }))}
            />
          </div>
        </Container>
      </Section>

      <Arc from="dark" to="light" />

      {/* 기능 행 4개, 좌우 교차 */}
      <Section tone="light">
        <Container className="space-y-20 sm:space-y-28">
          {FEATURE_ROWS.map((f, i) => (
            <div key={f.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <Photo img={f.image} alt="" className={cn("aspect-[4/3]", i % 2 === 1 && "lg:order-2")} />
              <div>
                <Eyebrow tone="light">{f.eyebrow}</Eyebrow>
                <Display size="md" className="mt-3">
                  {f.title}
                </Display>
                <Lead tone="light" className="mt-4">
                  {f.body}
                </Lead>
                <ul className="mt-6 space-y-2.5 text-[15px] text-ink-700">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5">
                      <CheckIcon className="mt-1 size-4 shrink-0 text-brand-600" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Pill href="/signup" size="md">
                    시작하기
                  </Pill>
                </div>
              </div>
            </div>
          ))}
        </Container>
      </Section>

      {/* 작은 신뢰 요소 3개 */}
      <Section tone="gray" className="py-12 sm:py-16">
        <Container className="grid gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheckIcon, title: "사람이 검수", body: "AI 초안을 전문가가 구조 · 문구 · 반응형까지 확인합니다." },
            { icon: ActivityIcon, title: "24시간 안에", body: "AI 반영 요청은 통상 24시간 안에 처리됩니다." },
            { icon: RefreshCwIcon, title: "언제든 변경", body: "규모가 커지면 플랜만 올리면 됩니다. 해지도 언제든." },
            { icon: LayersIcon, title: "사이트 여러 개", body: "플랜별 1 · 2 · 5 · 10개 사이트를 대시보드 하나로." },
            { icon: ClipboardCheckIcon, title: "요청 내역", body: "접수 · 처리중 · 반영 완료와 답변을 한 화면에서." },
            { icon: CoinsIcon, title: "숨은 비용 없음", body: "플랜 · 토큰 · 크레딧 · 템플릿, 모든 가격 공개." },
          ].map((c) => (
            <div key={c.title} className="flex items-start gap-4 rounded-2xl border border-ink-200 bg-white p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="font-bold">{c.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{c.body}</p>
              </div>
            </div>
          ))}
        </Container>
      </Section>

      <TestimonialCarousel tone="light" />

      <Closing arcFrom="light" />
    </>
  );
}
