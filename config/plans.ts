/**
 * 플랜·가격 상수. 가격은 여기 한 곳에서만 바꾼다 (DB 에는 plan_code 만 저장).
 *
 * 왜 코드 상수인가: 가격 정책이 아직 확정 전이라 자주 바뀐다. DB 테이블로 두면 마이그레이션이 매번 필요하고
 * 서버 액션·결제 검증·UI 가 각각 다른 값을 볼 위험이 있다. 결제 금액 검증도 이 상수를 기준으로 한다.
 *
 * 사용량 모델
 * - AI 반영: 횟수가 아니라 **토큰**. 플랜마다 월 토큰 한도가 있고, 요청이 처리될 때 실제 사용 토큰이 기록된다.
 *   한도를 넘은 만큼은 토큰 크레딧에서 차감된다. 남은 토큰이 0 이면 새 AI 요청을 보낼 수 없다.
 * - 전문가 요청: 주간 횟수 한도 + 횟수 크레딧.
 * - 오류 신고: 무료. 한도·크레딧 어디에서도 차감하지 않는다 (우리 쪽 실수는 우리가 고친다).
 * - 사이트 수: 플랜별 동시 보유 가능한 사이트(프로젝트) 수.
 */

export type PlanCode = "starter" | "business" | "pro" | "enterprise";
export type DeviceKind = "mobile" | "tablet" | "desktop";
/** 수정 요청 종류. bug(오류 신고)는 차감 없음. */
export type RequestKind = "ai" | "expert" | "bug";
/** 크레딧 종류. AI 는 토큰 단위, 전문가는 횟수 단위. */
export type CreditKind = "ai" | "expert";

export type Plan = {
  code: PlanCode;
  name: string;
  tagline: string;
  priceKrw: number;
  /** 동시에 보유할 수 있는 사이트 수. null 이면 제한 없음 */
  maxSites: number | null;
  /** 페이지 수 안내 문구 (예: "3~5페이지"). null 이면 제한 없음 */
  pageRange: { min: number; max: number } | null;
  /** 월 AI 토큰 한도. null = 무제한 */
  monthlyAiTokens: number | null;
  /** 주간 전문가 요청 한도. null = 무제한 */
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

/** AI 요청 1건이 대략 쓰는 토큰. 안내 문구와 기존 "1회" 크레딧의 토큰 환산에만 쓴다 (강제 아님). */
export const APPROX_TOKENS_PER_AI_REQUEST = 10_000;

export const PLANS: Plan[] = [
  {
    code: "starter",
    name: "스타터",
    tagline: "소개용 홈페이지를 빠르게",
    priceKrw: 29_000,
    maxSites: 1,
    pageRange: { min: 3, max: 5 },
    monthlyAiTokens: 300_000,
    weeklyExpert: 1,
    devices: ["mobile", "desktop"],
    paymentSystem: "none",
    cms: false,
    features: ["사이트 1개", "3~5 페이지", "모바일 · 웹 대응", "AI 토큰 월 30만", "전문가 수정 요청 주 1회", "결제 시스템 · CMS 미포함"],
  },
  {
    code: "business",
    name: "비즈니스",
    tagline: "쇼핑몰 · 예약 등 기능형 사이트",
    priceKrw: 89_000,
    maxSites: 2,
    pageRange: { min: 5, max: 12 },
    monthlyAiTokens: 1_000_000,
    weeklyExpert: 3,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "addon",
    cms: true,
    features: [
      "사이트 2개",
      "쇼핑몰 · 예약 등 기능형 사이트",
      "모바일 · 태블릿 · 웹 반응형",
      "AI 토큰 월 100만",
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
    maxSites: 5,
    pageRange: { min: 5, max: 30 },
    monthlyAiTokens: 3_000_000,
    weeklyExpert: 10,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: ["사이트 5개", "대부분의 기능 구현 가능", "모바일 · 태블릿 · 웹 반응형", "AI 토큰 월 300만", "전문가 수정 요청 주 10회", "결제 시스템 · CMS 포함"],
  },
  {
    code: "enterprise",
    name: "엔터프라이즈",
    tagline: "앱까지 포함한 맞춤 제작",
    priceKrw: 1_298_000,
    maxSites: 10,
    pageRange: null,
    monthlyAiTokens: null,
    weeklyExpert: null,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: ["사이트 10개", "모든 기능 제작", "개인 앱(모바일 앱) 제작 가능", "AI 토큰 · 전문가 요청 무제한", "전담 매니저", "결제 시스템 · CMS 포함"],
  },
];

export const PLAN_BY_CODE: Record<PlanCode, Plan> = Object.fromEntries(PLANS.map((p) => [p.code, p])) as Record<PlanCode, Plan>;

export function getPlan(code: PlanCode | null | undefined): Plan | null {
  return code ? (PLAN_BY_CODE[code] ?? null) : null;
}

/**
 * 추가 크레딧 팩. 플랜 한도를 다 쓰면 여기서 산 크레딧이 차감된다. 만료 없음.
 * AI 팩은 토큰(amount = 토큰 수), 전문가 팩은 횟수(amount = 회).
 * AI 가격은 "1회 180원 / 10회 1,400원" 을 1회 ≈ 1만 토큰으로 환산한 것.
 */
export type CreditPack = { code: string; kind: CreditKind; amount: number; priceKrw: number };

export const CREDIT_PACKS: CreditPack[] = [
  { code: "ai_10k", kind: "ai", amount: 10_000, priceKrw: 180 },
  { code: "ai_100k", kind: "ai", amount: 100_000, priceKrw: 1_400 },
  { code: "expert_1", kind: "expert", amount: 1, priceKrw: 8_900 },
  { code: "expert_10", kind: "expert", amount: 10, priceKrw: 64_900 },
];

export const CREDIT_PACK_BY_CODE: Record<string, CreditPack> = Object.fromEntries(CREDIT_PACKS.map((p) => [p.code, p]));

/** 크레딧 팩 수량 문구: AI 는 "1만 토큰", 전문가는 "1회" */
export function creditAmountLabel(pack: Pick<CreditPack, "kind" | "amount">): string {
  return pack.kind === "ai" ? `${formatTokens(pack.amount)} 토큰` : `${pack.amount}회`;
}

/** 템플릿 가격. demo = 완성 디자인 임시 사이트, live = 실제 운영 중인 사이트(소유자 동의). */
export const TEMPLATE_PRICE_KRW: Record<"demo" | "live", number> = { demo: 1_000, live: 8_900 };

/** 제작 소요 안내 */
export const DELIVERY_DAYS = { min: 3, max: 7 };

export const DEVICE_LABEL: Record<DeviceKind, string> = { mobile: "모바일", tablet: "태블릿", desktop: "웹" };
export const REQUEST_KIND_LABEL: Record<RequestKind, string> = { ai: "AI 반영", expert: "전문가 요청", bug: "오류 신고" };
/** 캔버스 네모 라벨처럼 짧게 써야 할 때 */
export const REQUEST_KIND_SHORT: Record<RequestKind, string> = { ai: "AI", expert: "전문가", bug: "오류" };

export function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 토큰 수를 한국식 단위로. 300000 → "30만", 1234567 → "123.5만", 9500 → "9,500" */
export function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
  return n.toLocaleString("ko-KR");
}
