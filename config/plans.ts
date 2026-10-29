/**
 * 플랜·가격 상수. 가격은 여기 한 곳에서만 바꾼다 (DB 에는 plan_code · billing_cycle 만 저장).
 *
 * 왜 코드 상수인가: 가격 정책이 아직 확정 전이라 자주 바뀐다. DB 테이블로 두면 마이그레이션이 매번 필요하고
 * 서버 액션·결제 검증·UI 가 각각 다른 값을 볼 위험이 있다. 결제 금액 검증도 이 상수를 기준으로 한다.
 *
 * 요금 (2026-10-19 결정): 플랜 3개, 월간 · 연간 결제. 연간 = 월 요금 × 10 ("2개월 무료"). 금액은 부가세 포함.
 * 엔터프라이즈는 요금제에서 빼고 "별도 상담" — 예전 구독을 읽을 수 있게 코드만 남긴다 (hidden).
 *
 * 사용량 모델
 * - AI 반영: 횟수가 아니라 **토큰**. 플랜마다 월 토큰 한도가 있고, 요청이 처리될 때 실제 사용 토큰이 기록된다.
 *   한도를 넘은 만큼은 토큰 크레딧에서 차감된다. 남은 토큰이 0 이면 새 AI 요청을 보낼 수 없다.
 * - 전문가 요청: 월 횟수 한도 + 횟수 크레딧. 사람 손이 드는 일이라 낮은 가격에 맞춰 적게 준다.
 * - 한도는 결제일부터 한 달마다 다시 채워진다. 연간 결제도 매달 채워진다 (DB 의 usage_window).
 * - 오류 신고: 무료. 한도·크레딧 어디에서도 차감하지 않는다 (우리 쪽 실수는 우리가 고친다).
 * - 사이트 수: 플랜별 동시 보유 가능한 사이트(프로젝트) 수.
 */

export type PlanCode = "starter" | "business" | "pro" | "enterprise";
export type DeviceKind = "mobile" | "tablet" | "desktop";
/** 수정 요청 종류. bug(오류 신고)는 차감 없음. */
export type RequestKind = "ai" | "expert" | "bug";
/** 크레딧 종류. AI 는 토큰 단위, 전문가는 횟수 단위. */
export type CreditKind = "ai" | "expert";
/** 결제 주기 */
export type BillingCycle = "month" | "year";

export const BILLING_CYCLES: BillingCycle[] = ["month", "year"];
export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = { month: "월간", year: "연간" };
/** 가격 뒤에 붙는 단위 ("/ 월", "/ 년") */
export const BILLING_CYCLE_UNIT: Record<BillingCycle, string> = { month: "월", year: "년" };

/** 연간 결제 = 월 요금 × 이 값. 12 와의 차이(2개월)가 연간 결제 할인이다 */
export const ANNUAL_MONTHS = 10;

export type Plan = {
  code: PlanCode;
  name: string;
  tagline: string;
  /** 월간 결제 금액 (부가세 포함). 연간 결제 금액은 planPrice(plan, "year") */
  priceKrw: number;
  /** 동시에 보유할 수 있는 사이트 수. null 이면 제한 없음 */
  maxSites: number | null;
  /** 페이지 수 안내 문구 (예: "3~5페이지"). null 이면 제한 없음 */
  pageRange: { min: number; max: number } | null;
  /** 월 AI 토큰 한도. null = 무제한 */
  monthlyAiTokens: number | null;
  /** 월 전문가 요청 한도. null = 무제한 */
  monthlyExpert: number | null;
  devices: DeviceKind[];
  /** 결제 시스템(쇼핑몰 결제) 연동: none 불가 · addon 연동비를 한 번 내고 켬 · included 포함 */
  paymentSystem: "none" | "addon" | "included";
  /** 관리자 페이지(관리자 목록을 직접 올리고 고치기 · AI 가 목록을 만들기) */
  cms: boolean;
  /**
   * 사이트를 만들 때 그 사이트 전용 Supabase 프로젝트를 바로 만든다 (lib/site-db). 프로젝트마다 매달 비용이 든다
   * (Supabase Pro 조직 기준 Micro $10). false 면 만들지 않는다.
   */
  siteDatabase: boolean;
  features: string[];
  recommended?: boolean;
  /** 요금제 화면 · 새 결제에 나오지 않는 플랜 (예전 구독을 읽을 때만 쓴다) */
  hidden?: boolean;
};

/** 결제 시스템(쇼핑몰 결제) 연동비. 켤 때 한 번만 받는다 (플랜을 바꿔도 다시 받지 않는다) */
export const PAYMENT_SETUP_FEE_KRW = 200_000;

/** 플랜 금액 (결제 주기별) */
export function planPrice(plan: Pick<Plan, "priceKrw">, cycle: BillingCycle): number {
  return cycle === "year" ? plan.priceKrw * ANNUAL_MONTHS : plan.priceKrw;
}

/** 연간 결제로 아끼는 금액 (월간으로 12번 낼 때와의 차이) */
export function annualSavings(plan: Pick<Plan, "priceKrw">): number {
  return plan.priceKrw * 12 - planPrice(plan, "year");
}

/** 결제 주기의 길이 (개월) */
export function cycleMonths(cycle: BillingCycle): number {
  return cycle === "year" ? 12 : 1;
}

/**
 * "전문가에게 맡기기"(사람이 처음부터 제작)는 연간 결제에만 들어 있다.
 * 월간으로 사람이 만든 사이트를 받고 바로 해지하면 제작 비용을 돌려받을 수 없어서다. 월간은 AI 로 시작한다.
 */
export function expertBuildIncluded(cycle: BillingCycle | null | undefined): boolean {
  return cycle === "year";
}

/** 플랜 순서 (올리기 · 내리기 판단) */
export const PLAN_RANK: Record<PlanCode, number> = { starter: 1, business: 2, pro: 3, enterprise: 4 };

/** AI 요청 1건이 대략 쓰는 토큰. 안내 문구와 기존 "1회" 크레딧의 토큰 환산에만 쓴다 (강제 아님). */
export const APPROX_TOKENS_PER_AI_REQUEST = 10_000;

/**
 * AI 이미지 1장을 만드는 데 대략 쓰는 토큰. 새 사이트 위저드의 "AI로 이미지 만들기" 예상치와 남은 토큰 검사에 쓴다.
 * 글 수정 요청(약 1만)보다 훨씬 많이 든다는 걸 보여주는 값이다. 실제 차감은 다른 AI 요청처럼 처리 후 기록된 사용량 기준.
 */
export const APPROX_TOKENS_PER_IMAGE = 20_000;

const ALL_PLANS: Plan[] = [
  {
    code: "starter",
    name: "스타터",
    tagline: "소개용 홈페이지를 빠르게",
    priceKrw: 19_800,
    maxSites: 1,
    pageRange: { min: 3, max: 5 },
    monthlyAiTokens: 300_000,
    monthlyExpert: 1,
    devices: ["mobile", "desktop"],
    paymentSystem: "none",
    cms: false,
    siteDatabase: true,
    features: ["사이트 1개", "3~5 페이지", "모바일 · 웹 대응", "토큰 월 30만", "전문가 수정 요청 월 1회", "결제 시스템 · CMS 미포함"],
  },
  {
    code: "business",
    name: "비즈니스",
    tagline: "쇼핑몰 · 예약 등 기능형 사이트",
    priceKrw: 29_800,
    maxSites: 2,
    pageRange: { min: 5, max: 12 },
    monthlyAiTokens: 1_000_000,
    monthlyExpert: 2,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "addon",
    cms: true,
    siteDatabase: true,
    features: [
      "사이트 2개",
      "쇼핑몰 · 예약 등 기능형 사이트",
      "모바일 · 태블릿 · 웹 반응형",
      "토큰 월 100만",
      "전문가 수정 요청 월 2회",
      `결제 시스템 연동 시 1회 ${(PAYMENT_SETUP_FEE_KRW / 10_000).toLocaleString("ko-KR")}만 원`,
    ],
    recommended: true,
  },
  {
    code: "pro",
    name: "프로",
    tagline: "대부분의 요구사항을 구현",
    priceKrw: 49_800,
    maxSites: 5,
    pageRange: { min: 5, max: 30 },
    monthlyAiTokens: 3_000_000,
    monthlyExpert: 4,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "addon",
    cms: true,
    siteDatabase: true,
    features: [
      "사이트 5개",
      "대부분의 기능 구현 가능",
      "모바일 · 태블릿 · 웹 반응형",
      "토큰 월 300만",
      "전문가 수정 요청 월 4회",
      `CMS 포함 · 결제 시스템 연동 시 1회 ${(PAYMENT_SETUP_FEE_KRW / 10_000).toLocaleString("ko-KR")}만 원`,
    ],
  },
  {
    // 요금제에서 뺐다 (별도 상담). 예전 구독 · 관리자 화면이 읽을 수 있게만 남긴다
    code: "enterprise",
    name: "엔터프라이즈",
    tagline: "앱까지 포함한 맞춤 제작",
    priceKrw: 1_298_000,
    maxSites: 10,
    pageRange: null,
    monthlyAiTokens: null,
    monthlyExpert: null,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    siteDatabase: true,
    features: ["사이트 10개", "모든 기능 제작", "개인 앱(모바일 앱) 제작 가능", "토큰 · 전문가 요청 무제한", "전담 매니저", "결제 시스템 · CMS 포함"],
    hidden: true,
  },
];

/** 요금제 화면과 새 결제에 나오는 플랜 (스타터 · 비즈니스 · 프로) */
export const PLANS: Plan[] = ALL_PLANS.filter((p) => !p.hidden);

/** 새로 결제할 수 있는 플랜 코드 (서버 검증용) */
export const PUBLIC_PLAN_CODES = PLANS.map((p) => p.code) as [PlanCode, ...PlanCode[]];

export const PLAN_BY_CODE: Record<PlanCode, Plan> = Object.fromEntries(ALL_PLANS.map((p) => [p.code, p])) as Record<PlanCode, Plan>;

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

/**
 * 사람(전문가)이 맡는 일의 약속 시간. 전문가 수정 요청의 답변과 "전문가에게 맡기기" 로 만든 사이트의 첫 완성본에 같이 쓴다.
 * AI 가 맡는 일(AI 반영 · AI 로 바로 만들기)은 바로 진행한다.
 */
export const EXPERT_HOURS = { min: 24, max: 72 };

/**
 * 오류 신고의 약속 시간. AI 가 먼저 확인하고(최근 AI 변경이면 되돌리고 · 고칠 수 있으면 고친다),
 * 사람이 필요하면 담당자에게 메일 · 문자로 알려 이 시간 안에 고친다 (우리 쪽 실수라 전문가 요청보다 빠르게).
 */
export const BUG_HOURS = 24;

/** 제작 소요 안내 (전문가 제작 기준, 일 단위). AI 로 만들면 구성 초안이 바로 나온다 */
export const DELIVERY_DAYS = { min: EXPERT_HOURS.min / 24, max: EXPERT_HOURS.max / 24 };

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
