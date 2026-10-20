import type { StyleId } from "@/config/design-styles";
import type { ThemePreset } from "@/lib/design-doc";

/**
 * 템플릿의 디자인 정보 (supabase/seed.sql 의 slug 기준). DB 템플릿 행에는 썸네일과 페이지 이름뿐이라
 * AI 가 "이 템플릿처럼" 만들 수 있게 디자인 유형 · 테마 · 페이지 구성을 여기에 적어 둔다.
 *
 * - 위저드에서 템플릿을 고르면: 디자인 유형이 미리 채워지고, 테마가 이 값으로 시작하고, AI 지시서에 구성이 들어간다.
 * - 편집기에서 네모에 "참고 템플릿" 을 붙이면: 그 부분을 이 템플릿의 느낌으로 고친다.
 * 새 템플릿을 시드에 넣으면 여기에도 같은 slug 로 넣는다 (없으면 태그 없이 동작한다).
 */
export type TemplateDesign = {
  slug: string;
  tags: StyleId[];
  /** 템플릿이 쓰는 메인 색. 위저드에서 템플릿을 고르면 이 색이 먼저 골라진다 (고객이 바꿀 수 있다) */
  primaryColor: string;
  theme: ThemePreset;
  /** 한 줄 디자인 설명 */
  summary: string;
  /** 페이지별 구성 메모 (AI 지시서) */
  structure: string[];
};

export const TEMPLATE_DESIGNS: TemplateDesign[] = [
  {
    slug: "cafe-daily",
    tags: ["warm", "natural", "photo"],
    primaryColor: "#9a5b34",
    theme: { temperature: "warm", radius: "lg", heroLayout: "wide", cardStyle: "flat", buttonStyle: "pill" },
    summary: "크림 바탕에 매장 사진을 크게 쓰는 따뜻한 카페 홈페이지",
    structure: ["홈: 매장 사진을 화면 폭 가득 → 대표 메뉴 카드 3개 → 매장 이야기 → 인스타그램 사진 격자 → 오시는 길", "안내: 영업시간 · 주차 · 단체석 안내", "리뷰: 손님 후기 카드", "문의: 단체 · 대관 문의 폼"],
  },
  {
    slug: "clinic-care",
    tags: ["trust", "modern", "calm"],
    primaryColor: "#0f766e",
    theme: { temperature: "cool", radius: "md", heroLayout: "split", cardStyle: "line", buttonStyle: "rounded" },
    summary: "청록 포인트의 단정한 의료기관 홈페이지 — 진료 안내와 예약 문의가 먼저 보인다",
    structure: ["홈: 한 줄 소개 + 예약 버튼과 진료 사진 나란히 → 진료 과목 카드 → 의료진 소개 → 진료 시간표 → 오시는 길", "안내: 진료 시간 · 휴진 안내 · 주차", "리뷰: 치료 후기(실제 후기만)", "문의: 예약 문의 폼"],
  },
  {
    slug: "folio-minimal",
    tags: ["minimal", "editorial"],
    primaryColor: "#111827",
    theme: { temperature: "neutral", saturation: "muted", radius: "none", heroLayout: "center", cardStyle: "line", buttonStyle: "square", density: "airy" },
    summary: "흰 바탕 · 검정 글자 · 큰 작업물 격자의 개인 포트폴리오",
    structure: ["홈: 가운데 큰 이름과 한 줄 소개 → 작업물 큰 격자", "작업: 프로젝트마다 큰 사진 + 짧은 설명", "소개: 이력 · 연락처", "문의: 간단한 문의 폼"],
  },
  {
    slug: "shop-basic",
    tags: ["modern", "friendly"],
    primaryColor: "#2563eb",
    theme: { temperature: "neutral", radius: "lg", heroLayout: "split", cardStyle: "shadow", buttonStyle: "pill" },
    summary: "상품 카드 중심의 밝고 친근한 기본 쇼핑몰",
    structure: ["홈: 이번 주 추천 상품 배너 → 카테고리 → 상품 카드 격자 → 후기", "상품: 상품 목록과 정렬", "리뷰: 구매 후기", "관리자페이지: 주문 · 상품 관리"],
  },
  {
    slug: "academy-plus",
    tags: ["trust", "friendly", "vivid"],
    primaryColor: "#1d4ed8",
    theme: { temperature: "cool", radius: "lg", heroLayout: "split", cardStyle: "shadow", buttonStyle: "pill" },
    summary: "네이비와 밝은 포인트의 학원 홈페이지 — 커리큘럼과 상담 신청이 중심",
    structure: ["홈: 한 줄 소개 + 상담 신청 버튼 → 과정 카드 → 강사 소개 → 수강 후기 → 상담 신청 띠", "안내: 교습비 · 시간표 (교습비는 실제 금액만)", "리뷰: 수강 후기", "문의: 상담 신청 폼"],
  },
  {
    slug: "space-interior",
    tags: ["modern", "luxury", "photo"],
    primaryColor: "#57534e",
    theme: { temperature: "warm", saturation: "muted", radius: "none", heroLayout: "wide", cardStyle: "flat", buttonStyle: "outline" },
    summary: "웜 그레이 톤에 시공 사진을 크게 보여 주는 인테리어 업체 홈페이지",
    structure: ["홈: 시공 사진을 화면 폭 가득 → 시공 분야 → 대표 사례 격자 → 진행 과정 → 견적 문의 띠", "사례: 시공 전후 사진 갤러리", "안내: 진행 과정 · 보증", "문의: 견적 문의 폼"],
  },
  {
    slug: "fit-studio",
    tags: ["bold", "vivid", "dark"],
    primaryColor: "#f97316",
    theme: { mode: "dark", temperature: "neutral", radius: "sm", heroLayout: "center", cardStyle: "flat", buttonStyle: "square" },
    summary: "어두운 바탕에 오렌지 포인트, 큰 제목의 피트니스 홈페이지 (모바일 우선)",
    structure: ["홈: 큰 구호 제목 + 체험 신청 버튼 → 프로그램 카드 → 트레이너 → 회원권 안내 → 후기", "프로그램: 프로그램별 시간 · 대상", "리뷰: 회원 후기", "문의: 체험 · 상담 신청"],
  },
  {
    slug: "table-restaurant",
    tags: ["luxury", "classic", "photo"],
    primaryColor: "#14532d",
    theme: { temperature: "warm", radius: "none", heroLayout: "wide", cardStyle: "line", buttonStyle: "outline" },
    summary: "딥그린과 명조 제목, 요리 사진을 크게 쓰는 레스토랑 홈페이지",
    structure: ["홈: 요리 사진을 화면 폭 가득 → 셰프 소개 → 대표 메뉴 → 매장 분위기 사진 → 예약 띠", "메뉴: 코스 · 단품 메뉴판", "안내: 영업시간 · 오시는 길", "예약: 날짜 · 인원 예약 폼"],
  },
  {
    slug: "law-office-live",
    tags: ["trust", "classic"],
    primaryColor: "#1e3a8a",
    theme: { temperature: "cool", radius: "sm", heroLayout: "split", cardStyle: "line", buttonStyle: "rounded" },
    summary: "네이비와 명조 제목의 정중한 법률사무소 홈페이지 (실제 운영 사이트 구조)",
    structure: ["홈: 한 줄 소개 + 상담 신청 → 업무 분야 → 구성원 → 상담 절차 → 상담 신청 띠", "업무분야: 분야별 설명", "구성원: 변호사 소개(실제 경력만)", "문의: 상담 신청 폼"],
  },
  {
    slug: "beauty-salon-live",
    tags: ["warm", "luxury"],
    primaryColor: "#be7c6d",
    theme: { temperature: "warm", radius: "lg", heroLayout: "split", cardStyle: "shadow", buttonStyle: "pill" },
    summary: "로즈 브라운 톤의 부드러운 뷰티살롱 홈페이지 (실제 운영 사이트 구조)",
    structure: ["홈: 시술 사진과 예약 버튼 → 시술 메뉴 → 디자이너 → 시술 갤러리 → 예약 띠", "시술: 시술별 가격 · 소요 시간 (실제 가격만)", "리뷰: 고객 후기", "예약: 예약 문의 폼"],
  },
];

export const TEMPLATE_DESIGN_BY_SLUG: Record<string, TemplateDesign> = Object.fromEntries(TEMPLATE_DESIGNS.map((t) => [t.slug, t]));

export function templateDesign(slug: string | null | undefined): TemplateDesign | null {
  return slug ? (TEMPLATE_DESIGN_BY_SLUG[slug] ?? null) : null;
}
