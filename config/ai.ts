/**
 * AI 엔진 설정 — 모델 · 노력 수준 · 비용 · 하루 한도. 바꿀 때는 여기만 고친다.
 *
 * 1단계는 Claude API + 시스템 프롬프트 + 하네스(lib/ai). 나중에 자체 모델을 붙이면 MODEL 을 바꾸거나
 * lib/ai/claude.ts 의 호출부를 갈아 끼우면 된다 — 하네스(지시서 조립) · 출력 형식 · 검사 · 기록은 그대로 쓴다.
 */

/** 모델. 더 싼 모델(claude-sonnet-5-5 · claude-haiku-5-5)로 바꾸는 건 품질을 보고 정할 일 */
export const AI_MODEL = "claude-opus-5-5";

/** 생각을 얼마나 깊게 할지 (low · medium · high · xhigh · max). Opus 5.5 의 기본은 medium */
export const AI_EFFORT = { build: "medium", edit: "medium" } as const;

/** 답의 최대 길이 (생각 포함). 넘치면 사람에게 넘긴다 */
export const AI_MAX_TOKENS = { build: 32_000, edit: 16_000 } as const;

/**
 * 지시서 버전. 하네스 · 스킬 문구를 바꾸면 올린다 — 실행 기록(ai_runs)에 남아 어떤 지시서로 만든 결과인지 구분된다.
 * 형식: 날짜.순번
 */
export const PROMPT_VERSION = "2026-10-29.1";

/** 편집기 "AI 작업 중" 화면이 진행 상황을 확인하는 간격 (밀리초) */
export const AI_LIVE_POLL_MS = 1000;

/** Claude Opus 5.5 가격 (USD / 100만 토큰). 캐시 쓰기는 5분 보관 기준 */
export const AI_PRICE_PER_MTOK = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };

/** 관리자 화면의 원화 환산 (대략) */
export const USD_TO_KRW = 1_400;

/**
 * 사용자 토큰에서 차감할 양 = 실제 비용을 "입력 토큰" 단위로 바꾼 값.
 * 입력 1 · 캐시 쓰기 1.25 · 캐시 읽기 0.05 · 출력(생각 포함) 5 — 같은 지시문을 다시 쓰는 캐시 이득은 고객에게 돌려주고,
 * 길게 생각하고 길게 쓴 요청은 그만큼 더 쓴다. 수정 1건은 보통 1만 안팎이다 (APPROX_TOKENS_PER_AI_REQUEST).
 */
export function billableTokens(u: { input: number; output: number; cacheWrite: number; cacheRead: number }): number {
  return Math.max(1, Math.round(u.input + u.cacheWrite * 1.25 + u.cacheRead * 0.05 + u.output * 5));
}

export function costUsd(u: { input: number; output: number; cacheWrite: number; cacheRead: number }): number {
  const p = AI_PRICE_PER_MTOK;
  return (u.input * p.input + u.output * p.output + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1_000_000;
}

/** 무료 첫 제작은 사용자마다 하루 이만큼만 (사이트를 지웠다 다시 만들어 무료 제작을 반복하지 않게) */
export const AI_BUILDS_PER_USER_PER_DAY = 2;

/** 하루 전체 AI 비용 상한 (USD). 넘으면 AI 처리를 멈추고 담당자에게 넘긴다. 환경변수 AI_DAILY_BUDGET_USD 로 바꾼다 */
export const AI_DAILY_BUDGET_USD_DEFAULT = 30;

/** 한 요청에 AI 가 사용자에게 되묻는 횟수 상한. 넘으면 담당자에게 넘긴다 */
export const AI_MAX_QUESTIONS = 2;

/** 이 시간이 지나도 끝나지 않은 AI 처리는 멈춘 것으로 보고 담당자에게 넘긴다 */
export const AI_STALE_MINUTES = 10;

/**
 * 요청하고 이 시간이 지나도 AI 가 한 번도 손대지 않은 AI 반영 요청은 담당자에게 넘긴다
 * (키가 없던 때 들어온 요청 · 서버가 다시 켜져 처리가 시작되지 못한 요청 · 아주 긴 대기열). 편집기의 "AI 반영 중" 도 이 시간까지만 센다.
 */
export const AI_QUEUE_MINUTES = 30;
