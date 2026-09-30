import { ArrowRightIcon, ClockIcon, ShieldCheckIcon, SquareDashedMousePointerIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Arc, ComparisonTable, Container, Display, Eyebrow, Hero, Lead, LightCard, Pill, Section } from "@/components/marketing/primitives";
import { Closing } from "@/components/marketing/sections";
import { DELIVERY_DAYS, PLANS, formatKrw } from "@/config/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "제작 방식 비교 — 선택지를 나란히" };

/**
 * 비교 페이지. 디자인 피클 /comparison 구성:
 * 히어로 → 요약 비교표 → 상세 표(비용 · 적합 · 시간 · 산출물 · 진행) → "제작 화력" 3카드 → 다른 구독형 서비스 8카드 → 질문 → 추천
 */

const DETAIL_COLUMNS = ["비용", "적합한 경우", "소요 시간", "산출물", "진행 방식"];
const DETAIL_ROWS: { label: string; cells: string[] }[] = [
  {
    label: "페이지프렌즈",
    cells: [`월 ${formatKrw(PLANS[0].priceKrw)}부터, 4개 플랜. 템플릿은 1회 1,000원 · 8,900원`, "빨리 시작하고, 만든 뒤에도 계속 고쳐야 하는 소상공인 · 스타트업 · 에이전시", `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 첫 완성본, AI 수정은 통상 24시간`, "반응형 사이트 + 페이지 · 디바이스별 캡처 + 관리자 페이지(플랜에 따라)", "위저드 입력 → 대시보드 확인 → 네모로 수정 요청 → 반영 확인"],
  },
  { label: "프리랜서 마켓", cells: ["건당 수십만 원부터. 수정은 별도 견적", "요구사항이 명확하고 한 번 만들면 끝나는 작은 사이트", "매칭 1~2주 + 제작 2~4주. 사람마다 편차 큼", "정적 사이트 또는 노코드 결과물. 소스 · 계정 인수 여부 확인 필요", "채팅 · 문서로 요구사항 전달, 시안 확인, 수정 협의"] },
  { label: "개인 외주", cells: ["100만~500만 원 안팎. 유지보수는 별도 계약", "믿을 만한 개발자를 이미 알고 있고 관계로 관리할 수 있는 경우", "4~8주. 상대의 일정에 좌우", "커스텀 사이트. 이후 수정은 같은 사람에게만 의존", "미팅 · 이메일. 요청 내역이 흩어지기 쉬움"] },
  { label: "인하우스", cells: ["디자이너 · 개발자 인건비 월 수백만 원 이상", "사이트가 사업의 핵심이고 매일 바뀌어야 하는 회사", "채용까지 1~3개월, 이후 즉시", "원하는 모든 것. 대신 유지 비용도 전부 부담", "내부 프로세스에 따름"] },
  { label: "에이전시", cells: ["500만 원 이상. 리뉴얼 · 추가 페이지마다 재견적", "브랜드 규모가 크고 기획 · 촬영 · 개발을 한 번에 맡길 때", "견적 · 미팅 2~4주 + 제작 6~12주", "높은 완성도의 커스텀 사이트와 기획 문서", "킥오프 · 중간 보고 · 검수 미팅"] },
  { label: "노코드 툴", cells: ["월 1만~5만 원. 템플릿 · 플러그인 별도", "직접 만들 시간이 있고 어설픈 결과물도 감수할 수 있는 경우", "직접 만드는 만큼. 보통 수 주", "템플릿 기반 사이트. 디자인 편차 큼", "혼자 배우고 혼자 만들기"] },
  { label: "AI 생성 툴", cells: ["월 2만~5만 원 안팎", "빠른 초안이 필요하고 마무리는 스스로 할 수 있는 경우", "초안은 몇 분, 완성까지는 직접 손봐야 함", "AI 초안. 사람 검수 · 결제 · 관리자 페이지는 없음", "프롬프트 반복. 세부 수정은 직접"] },
];

const FIREPOWER: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ClockIcon, title: "속도", body: `견적 · 미팅 없이 5분 안에 시작하고 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 첫 완성본. AI 수정은 통상 24시간 안에 반영됩니다.` },
  { icon: ShieldCheckIcon, title: "품질", body: "AI 초안을 사람 전문가가 구조 · 문구 · 반응형까지 검수합니다. 우리 쪽 오류는 무료로 고칩니다." },
  { icon: SquareDashedMousePointerIcon, title: "수정 방식", body: "완성 화면 위에 네모를 그리고 번호별로 적으면 끝. 전화 · 이메일로 설명할 필요가 없습니다." },
];

const SUBSCRIPTIONS = [
  { name: "구독형 A", body: "디자인만 구독. 개발 · 배포는 별도로 맡겨야 합니다." },
  { name: "구독형 B", body: "요청 횟수 제한. 토큰이 아니라 건당 차감입니다." },
  { name: "구독형 C", body: "해외 서비스. 한국어 지원과 국내 결제 연동이 약합니다." },
  { name: "구독형 D", body: "사이트 1개 고정. 여러 사이트는 계정을 따로 만들어야 합니다." },
  { name: "구독형 E", body: "AI 만 제공. 사람 검수 단계가 없습니다." },
  { name: "구독형 F", body: "수정 요청을 문서 · 채팅으로. 화면 위 표시가 안 됩니다." },
  { name: "구독형 G", body: "연 단위 계약. 월 단위 해지가 어렵습니다." },
  { name: "구독형 H", body: "결제 · 관리자 페이지는 추가 개발 견적입니다." },
];

export default function ComparisonPage() {
  return (
    <>
      <Hero eyebrow="제작 방식 비교" title="선택지를 나란히" lead="직접 만들기, 프리랜서, 외주, 인하우스, 에이전시, 노코드, AI 생성 툴. 비용 · 속도 · 품질 · 수정 방식을 기준으로 정직하게 비교했습니다." primary={{ href: "/signup", label: "시작하기" }} secondary={{ href: "/pricing", label: "요금제 보기" }} size="lg" />

      <Arc from="dark" to="light" />

      {/* 1. 요약 비교표 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">한눈에</Eyebrow>
          <Display className="mt-3">플랫폼 · 속도 · 품질 · 지원 · 비용</Display>
          <LightCard className="mt-10">
            <ComparisonTable />
          </LightCard>
        </Container>
      </Section>

      {/* 2. 상세 표 */}
      <Section tone="gray">
        <Container>
          <Eyebrow tone="light">자세히</Eyebrow>
          <Display className="mt-3 max-w-3xl">비용부터 진행 방식까지</Display>
          <Lead tone="light" className="mt-3 max-w-2xl">
            다른 방식의 비용 · 기간은 시장에서 흔히 보이는 범위이며, 업체와 범위에 따라 달라집니다.
          </Lead>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-ink-200 bg-white">
            <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-ink-50 text-left text-xs text-ink-500">
                  <th className="px-5 py-3 font-medium">방식</th>
                  {DETAIL_COLUMNS.map((c) => (
                    <th key={c} className="px-5 py-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DETAIL_ROWS.map((r, i) => (
                  <tr key={r.label} className={cn(i === 0 && "bg-sky-50")}>
                    <td className={cn("border-t border-ink-200 px-5 py-4 align-top font-bold whitespace-nowrap", i === 0 && "text-brand-700")}>{r.label}</td>
                    {r.cells.map((c, j) => (
                      <td key={j} className="border-t border-l border-ink-200 px-5 py-4 align-top text-[13px] leading-relaxed text-ink-700">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </Section>

      {/* 3. 제작 화력 */}
      <Section tone="light">
        <Container>
          <Eyebrow tone="light">당신을 위해</Eyebrow>
          <Display className="mt-3">제작 화력</Display>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {FIREPOWER.map((f) => (
              <LightCard key={f.title}>
                <span className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <f.icon className="size-6" />
                </span>
                <h3 className="mt-6 text-2xl font-bold">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{f.body}</p>
              </LightCard>
            ))}
          </div>
        </Container>
      </Section>

      <Arc from="light" to="dark" />

      {/* 4. 다른 구독형 서비스 */}
      <Section tone="dark">
        <Container>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>다른 구독형 서비스와</Eyebrow>
              <Display className="mt-3 max-w-3xl">구독형 제작끼리 비교하면</Display>
              <Lead className="mt-3 max-w-2xl">특정 서비스를 지칭하지 않습니다. 구독형 제작을 고를 때 흔히 마주치는 차이점을 정리했습니다. 구체적인 비교가 필요하면 상담에서 함께 봅니다.</Lead>
            </div>
            <Pill href="/consultation" variant="outlineLight" size="md" className="shrink-0 self-start lg:self-auto">
              상담 신청 <ArrowRightIcon className="size-4" />
            </Pill>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SUBSCRIPTIONS.map((s) => (
              <Link key={s.name} href="/consultation" className="group rounded-2xl bg-night-900 p-6 transition-colors hover:bg-night-800">
                <p className="text-lg font-bold">
                  {s.name} <span className="text-white/40">vs</span> 페이지프렌즈
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">{s.body}</p>
                <p className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky-400">
                  상담에서 비교 <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      <Closing />
    </>
  );
}
