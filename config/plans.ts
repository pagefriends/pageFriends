/**
 * 플랜·가격 상수. 가격은 여기 한 곳에서만 바꾼다 (DB 에는 plan_code 만 저장).
 *
 * 왜 코드 상수인가: 가격 정책이 아직 확정 전이라 자주 바뀐다. DB 테이블로 두면 마이그레이션이 매번 필요하고
 * 서버 액션·결제 검증·UI 가 각각 다른 값을 볼 위험이 있다. 결제 금액 검증도 이 상수를 기준으로 한다.
 */

export type PlanCode = "starter" | "business" | "pro" | "enterprise";
export type DeviceKind = "mobile" | "tablet" | "desktop";
export type RequestKind = "ai" | "expert";

export type Plan = {
  code: PlanCode;
  name: string;
  tagline: string;
  priceKrw: number;
  /** 페이지 수 안내 문구 (예: "3~5페이지"). null 이면 제한 없음 */
  pageRange: { min: number; max: number } | null;
  /** 주간 요청 한도. null = 무제한 */
  weeklyAi: number | null;
  weeklyExpert: number | null;
  devices: DeviceKind[];
  /** 결제 시스템(쇼핑몰 결제) 연동 가능 여부 */
  paymentSystem: "none" | "addon" | "included";
  cms: boolean;
  features: string[];
  recommended?: boolean;
};

/** 비즈니스 플랜에서 결제 시스템을 켜면 첫 달에만 청구되는 금액 (이후 월 89,000원). */
export const BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW = 289_000;

export const PLANS: Plan[] = [
  {
    code: "starter",
    name: "스타터",
    tagline: "소개용 홈페이지를 빠르게",
    priceKrw: 29_000,
    pageRange: { min: 3, max: 5 },
    weeklyAi: 3,
    weeklyExpert: 1,
    devices: ["mobile", "desktop"],
    paymentSystem: "none",
    cms: false,
    features: ["3~5 페이지", "모바일 · 웹 대응", "AI 수정 요청 주 3회", "전문가 수정 요청 주 1회", "결제 시스템 · CMS 미포함"],
  },
  {
    code: "business",
    name: "비즈니스",
    tagline: "쇼핑몰 · 예약 등 기능형 사이트",
    priceKrw: 89_000,
    pageRange: { min: 5, max: 12 },
    weeklyAi: 10,
    weeklyExpert: 3,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "addon",
    cms: true,
    features: [
      "쇼핑몰 · 예약 등 기능형 사이트",
      "모바일 · 태블릿 · 웹 반응형",
      "AI 수정 요청 주 10회",
      "전문가 수정 요청 주 3회",
      "결제 시스템 선택 시 첫 달 289,000원 (이후 89,000원)",
    ],
    recommended: true,
  },
  {
    code: "pro",
    name: "프로",
    tagline: "대부분의 요구사항을 구현",
    priceKrw: 348_000,
    pageRange: { min: 5, max: 30 },
    weeklyAi: 30,
    weeklyExpert: 10,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: ["대부분의 기능 구현 가능", "모바일 · 태블릿 · 웹 반응형", "AI 수정 요청 주 30회", "전문가 수정 요청 주 10회", "결제 시스템 · CMS 포함"],
  },
  {
    code: "enterprise",
    name: "엔터프라이즈",
    tagline: "앱까지 포함한 맞춤 제작",
    priceKrw: 1_298_000,
    pageRange: null,
    weeklyAi: null,
    weeklyExpert: null,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: ["모든 기능 제작", "개인 앱(모바일 앱) 제작 가능", "AI · 전문가 요청 무제한", "전담 매니저", "결제 시스템 · CMS 포함"],
  },
];

export const PLAN_BY_CODE: Record<PlanCode, Plan> = Object.fromEntries(PLANS.map((p) => [p.code, p])) as Record<PlanCode, Plan>;

export function getPlan(code: PlanCode | null | undefined): Plan | null {
  return code ? (PLAN_BY_CODE[code] ?? null) : null;
}

/** 추가 요청 크레딧 팩. 주간 한도를 다 쓰면 여기서 산 크레딧이 차감된다. 만료 없음. */
export type CreditPack = { code: string; kind: RequestKind; count: number; priceKrw: number };

export const CREDIT_PACKS: CreditPack[] = [
  { code: "ai_1", kind: "ai", count: 1, priceKrw: 180 },
  { code: "ai_10", kind: "ai", count: 10, priceKrw: 1_400 },
  { code: "expert_1", kind: "expert", count: 1, priceKrw: 8_900 },
  { code: "expert_10", kind: "expert", count: 10, priceKrw: 64_900 },
];

export const CREDIT_PACK_BY_CODE: Record<string, CreditPack> = Object.fromEntries(CREDIT_PACKS.map((p) => [p.code, p]));

/** 템플릿 가격. demo = 완성 디자인 임시 사이트, live = 실제 운영 중인 사이트(소유자 동의). */
export const TEMPLATE_PRICE_KRW: Record<"demo" | "live", number> = { demo: 1_000, live: 8_900 };

/** 제작 소요 안내 */
export const DELIVERY_DAYS = { min: 3, max: 7 };

export const DEVICE_LABEL: Record<DeviceKind, string> = { mobile: "모바일", tablet: "태블릿", desktop: "웹" };
export const REQUEST_KIND_LABEL: Record<RequestKind, string> = { ai: "AI 반영", expert: "전문가 요청" };

export function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
