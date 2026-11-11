/**
 * 플랜·가격 상수. 가격은 여기 한 곳에서만 바꾼다 (DB 에는 plan_code · billing_cycle 만 저장).
 *
 * 왜 코드 상수인가: 가격 정책이 아직 확정 전이라 자주 바뀐다. DB 테이블로 두면 마이그레이션이 매번 필요하고
 * 서버 액션·결제 검증·UI 가 각각 다른 값을 볼 위험이 있다. 결제 금액 검증도 이 상수를 기준으로 한다.
 *
 * 요금 (2026-11-11 사용자 결정): 플랜 4개 29,800 · 49,800 · 129,800 · 249,800원, 월간 · 연간 결제. 연간 = 월 요금 × 10 ("2개월 무료").
 * 금액은 부가세 포함. **모든 플랜은 사이트 1개** (사이트마다 AI · 사람 · 서버 비용이 들어서 가격을 사이트 단위로 맞췄다).
 * 네 번째 "프리미엄" 은 DB enum 을 바꾸지 않으려고 예전 숨김 플랜 코드 enterprise 를 그대로 쓴다 (이름만 바꿈).
 * 여러 사이트 · 앱 제작은 "별도 상담" (지금 구독은 계정마다 하나라, 사이트마다 따로 결제하는 기능은 아직 없다).
 * (예전: 2026-10-19 플랜 3개 19,800 · 29,800 · 49,800원, 사이트 1 · 2 · 5개)
 *
 * 사용량 모델
 * - AI 반영: 횟수가 아니라 **토큰**. 플랜마다 월 토큰 한도가 있고, 요청마다 쓴 만큼 **그 자리에서 바로** 깎인다
 *   (2026-11-11 사용자 결정: "토큰이 정해져 있고 요구하는 사항만큼 자동으로 재서 바로바로 깎는다").
 *   · AI 가 처리하면(반영 · 질문) 실제로 쓴 토큰 (config/ai.ts billableTokens)
 *   · AI 가 맡지 못해 담당자에게 넘기면 AI 가 잰 일의 크기만큼 (WORK_TOKENS). 남은 토큰이 모자라면 깎지 않고 넘기지도 않고 알린다
 *   · AI 이미지 요청은 요청하는 순간 장당 APPROX_TOKENS_PER_IMAGE
 *   · 담당자가 "반영 불가" 로 처리하면 그 요청에서 깎은 토큰을 모두 돌려준다
 *   한도를 넘은 만큼은 토큰 크레딧에서 차감된다. 남은 토큰이 0 이면 새 AI 요청을 보낼 수 없다.
 * - 전문가 요청: 월 횟수 한도 + 횟수 크레딧. 사람 손이 드는 일이라 낮은 가격에 맞춰 적게 준다 (직접 고른 전문가 요청만 — AI 가 넘긴 요청은 토큰).
 * - 한도는 결제일부터 한 달마다 다시 채워진다. 연간 결제도 매달 채워진다 (DB 의 usage_window).
 * - 오류 신고: 무료. 한도·크레딧 어디에서도 차감하지 않는다 (우리 쪽 실수는 우리가 고친다).
 * - 사이트 수: 플랜별 동시 보유 가능한 사이트(프로젝트) 수. 지금은 모든 플랜이 1개.
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
  /** 관리자 페이지(관리자 목록을 직접 올리고 고치기 · AI 가 목록을 만들기). 글은 공용 DB 에 저장한다 (lib/site-data.ts) */
  cms: boolean;
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

/**
 * AI 요청 1건이 대략 쓰는 토큰. 안내 문구와 기존 "1회" 크레딧의 토큰 환산에만 쓴다 (강제 아님).
 * 실측 (2026-11-11, 실제 Claude 수정 21건): 평균 약 8,700 · 중앙값 약 5,600 · 90% 약 1.4만 → 1만으로 둔다.
 */
export const APPROX_TOKENS_PER_AI_REQUEST = 10_000;

/**
 * AI 이미지 1장의 토큰. 새 사이트 위저드의 "AI로 이미지 만들기" 예상치 · 남은 토큰 검사와 실제 차감에 같이 쓴다.
 * 이미지 요청은 요청하는 순간 이만큼 깎인다 (lib/submit-requests.ts). 글 수정 요청(약 1만)보다 훨씬 많이 든다.
 */
export const APPROX_TOKENS_PER_IMAGE = 20_000;

/**
 * AI 가 맡지 못해 담당자에게 넘긴 AI 반영 요청의 일 크기. AI 가 넘길 때 함께 고른다 (lib/ai/schemas.ts EditOutput.workSize).
 * 숫자는 여기서만 바꾼다. 기준 글은 lib/ai/harness.ts 의 수정 요청 지시문에도 있다 (둘을 같이 고친다).
 *   small  약 10분 — 한 곳의 글 · 색 · 크기를 손으로 바꾸기, 링크 · 버튼 하나 연결
 *   medium 약 30분 — 구역 하나 고치기 · 옮기기, 폼 항목 추가, 메뉴 · 페이지 이름 바꾸기, 사진 여러 장 넣기, 지도 · 영상 같은 외부 화면 하나 넣기
 *   large  1시간 이상 — 새 구역 · 새 페이지, 예약 · 결제 · 회원가입 같은 기능 연결, 여러 페이지에 걸친 바꾸기
 *
 * 크기 정한 근거 (2026-11-11): 사람 시간은 30분 ≈ 1만 원으로 본다. 토큰 1개의 AI 원가는 약 0.0056원이라 원가대로 바꾸면
 * 30분 일이 180만 토큰이 되어 쓸 수가 없다. 그래서 토큰 크레딧 값(1만 토큰 180원 · 10만 토큰 1,400원)으로 쳐서
 * 보통 일이 전문가 요청 1회 크레딧(8,900원)과 비슷하게 50만 (= 7,000 ~ 9,000원), 작은 일은 그 절반 아래 20만, 큰 일은 두 배 100만.
 * (예전 5만 · 10만 · 20만이면 크레딧 1,400원으로 사람 30분 일을 맡길 수 있었다.)
 */
export type WorkSize = "small" | "medium" | "large";
export const WORK_SIZES: WorkSize[] = ["small", "medium", "large"];
export const WORK_TOKENS: Record<WorkSize, number> = { small: 200_000, medium: 500_000, large: 1_000_000 };
export const WORK_SIZE_LABEL: Record<WorkSize, string> = { small: "작은 일", medium: "보통", large: "큰 일" };

/**
 * 플랜별 월 토큰 (2026-11-11 정함 — 사용자 요청 "찾아봐서 플랜별로 토큰을 얼마나 줄지 정해서").
 * 토큰 1개 = Claude Opus 5.5 입력 1토큰 값 ($4 / 100만 → 약 0.0056원, config/ai.ts billableTokens).
 *
 * 한 달에 보통 쓰는 양 (실측 수정 1건 평균 약 8,700 · 이미지 2만 · 담당자 일 WORK_TOKENS, 사이트 1개)
 *   스타터   수정 25건 · 이미지 2장                      ≈ 26만  → 50만  (약 1.9배 여유, 작은 담당자 일 1건이 들어갈 자리)
 *   비즈니스 수정 70건 · 이미지 5장 · 담당자 작은 일 1건 ≈ 91만  → 150만 (약 1.6배)
 *   프로     수정 180건 · 이미지 10장 · 담당자 보통 1건  ≈ 227만 → 300만 (약 1.3배)
 *   프리미엄 프로의 두 배 가까이                           → 500만
 * 시장 (2026 하반기, AI 만 파는 서비스): Lovable Pro $25 = 요청 100번, Bolt Pro $25 = 1천만 토큰, v0 $30 = $30 어치 크레딧.
 *
 * 남는 돈 (2026-11-11 계산, 공용 DB 기준 · 부가세 · 카드 수수료 · AI · 사람 작업 30분 1만 원 · 서버비 1곳 3천 원을 뺀 값)
 *   전문가 요청을 절반 쓰면  스타터 약 1.7만 · 비즈니스 2.3만 · 프로 6.6만 · 프리미엄 12.6만 원
 *   다 쓰면                  스타터 약 1.2만 · 비즈니스 1.3만 · 프로 4.1만 · 프리미엄 7.6만 원 (모든 플랜이 남는다)
 *   100곳이면 (절반 사용) 스타터 30 · 비즈니스 40 · 프로 20 · 프리미엄 10 → 월 약 400만, 10 · 30 · 40 · 20 → 약 600만, 0 · 20 · 50 · 30 → 약 750만 원
 *   2026-11-11 관리자 목록의 글을 공용 DB 로 옮겼다 (사이트마다 Supabase 프로젝트를 만들면 비즈니스 이상에서 1곳당 약 1.4만 원씩 더 빠졌다).
 */
const MONTHLY_TOKENS = { starter: 500_000, business: 1_500_000, pro: 3_000_000, premium: 5_000_000 } as const;

const SETUP_FEE_MAN = (PAYMENT_SETUP_FEE_KRW / 10_000).toLocaleString("ko-KR");

const ALL_PLANS: Plan[] = [
  {
    code: "starter",
    name: "스타터",
    tagline: "소개용 홈페이지를 빠르게",
    priceKrw: 29_800,
    maxSites: 1,
    pageRange: { min: 3, max: 5 },
    monthlyAiTokens: MONTHLY_TOKENS.starter,
    monthlyExpert: 1,
    devices: ["mobile", "desktop"],
    paymentSystem: "none",
    cms: false,
    features: ["사이트 1개", "3~5 페이지", "모바일 · 웹 대응", `토큰 월 ${formatTokens(MONTHLY_TOKENS.starter)}`, "전문가 수정 요청 월 1회", "결제 시스템 · 관리자 페이지 미포함"],
  },
  {
    code: "business",
    name: "비즈니스",
    tagline: "공지 · 메뉴 · 상품을 직접 올리는 사이트",
    priceKrw: 49_800,
    maxSites: 1,
    pageRange: { min: 5, max: 12 },
    monthlyAiTokens: MONTHLY_TOKENS.business,
    monthlyExpert: 2,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "addon",
    cms: true,
    features: [
      "사이트 1개",
      "5~12 페이지",
      "모바일 · 태블릿 · 웹 반응형",
      `토큰 월 ${formatTokens(MONTHLY_TOKENS.business)}`,
      "전문가 수정 요청 월 2회",
      `관리자 페이지 포함 · 결제 시스템 연동 시 1회 ${SETUP_FEE_MAN}만 원`,
    ],
  },
  {
    code: "pro",
    name: "프로",
    tagline: "쇼핑몰 · 강의 · 예약까지 전문가와 함께",
    priceKrw: 129_800,
    maxSites: 1,
    pageRange: { min: 5, max: 30 },
    monthlyAiTokens: MONTHLY_TOKENS.pro,
    monthlyExpert: 5,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: [
      "사이트 1개",
      "5~30 페이지",
      "모바일 · 태블릿 · 웹 반응형",
      `토큰 월 ${formatTokens(MONTHLY_TOKENS.pro)}`,
      "전문가 수정 요청 월 5회",
      "관리자 페이지 · 결제 시스템 연동 포함",
    ],
    recommended: true,
  },
  {
    // 네 번째 플랜. DB enum(plan_code)을 바꾸지 않으려고 예전 숨김 플랜 코드 enterprise 를 그대로 쓴다 (화면 이름은 프리미엄)
    code: "enterprise",
    name: "프리미엄",
    tagline: "전담 매니저가 함께 운영",
    priceKrw: 249_800,
    maxSites: 1,
    pageRange: { min: 5, max: 50 },
    monthlyAiTokens: MONTHLY_TOKENS.premium,
    monthlyExpert: 10,
    devices: ["mobile", "tablet", "desktop"],
    paymentSystem: "included",
    cms: true,
    features: [
      "사이트 1개",
      "5~50 페이지",
      "모바일 · 태블릿 · 웹 반응형",
      `토큰 월 ${formatTokens(MONTHLY_TOKENS.premium)}`,
      "전문가 수정 요청 월 10회",
      "관리자 페이지 · 결제 시스템 연동 포함 · 전담 매니저",
    ],
  },
];

/** 요금제 화면과 새 결제에 나오는 플랜 (스타터 · 비즈니스 · 프로 · 프리미엄) */
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
