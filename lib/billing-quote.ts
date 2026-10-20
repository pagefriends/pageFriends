import { PAYMENT_SETUP_FEE_KRW, PLAN_BY_CODE, PLAN_RANK, planPrice, type BillingCycle, type PlanCode } from "@/config/plans";

/**
 * 플랜 결제 · 변경 금액 계산. 결제 화면(미리 보기)과 서버(실제 결제)가 같은 함수를 쓴다 — 결제 금액은 서버가 다시 계산한다.
 *
 * 규칙
 * - 처음 시작(또는 만료 · 미납 뒤 다시 시작): 플랜 금액을 바로 결제하고 오늘부터 새 기간.
 * - 올리기(상위 플랜 · 월간 → 연간): 지금 기간의 남은 날만큼을 빼고 바로 결제, 오늘부터 새 기간.
 * - 내리기(하위 플랜) · 연간 → 월간: 지금 기간이 끝나는 날(다음 결제)부터 적용. 지금은 결제하지 않는다.
 * - 결제 시스템 연동비는 처음 켤 때 한 번만 (플랜을 바꿔도 다시 받지 않는다).
 */

/** 지금 이용 중인 구독 (이용할 수 없는 구독은 null) */
export type CurrentTerms = {
  planCode: PlanCode;
  cycle: BillingCycle;
  periodStart: string;
  periodEnd: string;
  /** 남은 기간을 넘겨줄 수 있는가 — 이용 중 · 해지 예약은 true, 결제 실패(미납)는 false */
  paidUp: boolean;
  /** 다음 결제부터 바뀌기로 예약한 플랜 */
  pending: { planCode: PlanCode; cycle: BillingCycle } | null;
};

export type ChangeMode = "new" | "now" | "later" | "addon" | "same";

export type ChangeQuote = {
  mode: ChangeMode;
  /** 새 플랜 금액 (결제 주기 기준) */
  planKrw: number;
  /** 지금 기간의 남은 날만큼 빼 주는 금액 (now) */
  creditKrw: number;
  /** 결제 시스템 연동비 (처음 켤 때) */
  setupFeeKrw: number;
  /** 지금 결제할 금액 */
  chargeKrw: number;
  /** later: 바뀌는 날 (지금 기간이 끝나는 날) */
  effectiveAt: string | null;
  /** 바뀐 뒤 결제 시스템이 켜져 있는가 */
  paymentAddon: boolean;
};

export function quoteChange(
  ctx: { current: CurrentTerms | null; hadAddon: boolean },
  input: { planCode: PlanCode; cycle: BillingCycle; paymentAddon: boolean },
  now: Date = new Date(),
): ChangeQuote {
  const plan = PLAN_BY_CODE[input.planCode];
  const planKrw = planPrice(plan, input.cycle);
  const wantsAddon = plan.paymentSystem !== "none" && input.paymentAddon;
  const setupFeeKrw = plan.paymentSystem === "addon" && wantsAddon && !ctx.hadAddon ? PAYMENT_SETUP_FEE_KRW : 0;
  const paymentAddon = ctx.hadAddon || wantsAddon;
  const { current } = ctx;

  if (!current || !current.paidUp) {
    return { mode: "new", planKrw, creditKrw: 0, setupFeeKrw, chargeKrw: planKrw + setupFeeKrw, effectiveAt: null, paymentAddon };
  }

  const samePlan = current.planCode === input.planCode;
  if (samePlan && current.cycle === input.cycle) {
    if (setupFeeKrw > 0) return { mode: "addon", planKrw, creditKrw: 0, setupFeeKrw, chargeKrw: setupFeeKrw, effectiveAt: null, paymentAddon };
    return { mode: "same", planKrw, creditKrw: 0, setupFeeKrw: 0, chargeKrw: 0, effectiveAt: null, paymentAddon: ctx.hadAddon };
  }

  const down = PLAN_RANK[input.planCode] < PLAN_RANK[current.planCode];
  const yearToMonth = current.cycle === "year" && input.cycle === "month";
  if (down || yearToMonth) {
    // 결제 시스템은 바뀐 뒤 따로 켠다 (예약 변경은 지금 결제하지 않으므로)
    return { mode: "later", planKrw, creditKrw: 0, setupFeeKrw: 0, chargeKrw: 0, effectiveAt: current.periodEnd, paymentAddon: ctx.hadAddon };
  }

  const creditKrw = remainingCredit(current, now);
  const chargeKrw = Math.max(0, planKrw - creditKrw) + setupFeeKrw;
  return { mode: "now", planKrw, creditKrw, setupFeeKrw, chargeKrw, effectiveAt: null, paymentAddon };
}

/** 지금 기간의 남은 날만큼의 금액 (10원 단위 내림) */
export function remainingCredit(current: Pick<CurrentTerms, "planCode" | "cycle" | "periodStart" | "periodEnd">, now: Date = new Date()): number {
  const start = new Date(current.periodStart).getTime();
  const end = new Date(current.periodEnd).getTime();
  if (!(end > start)) return 0;
  const ratio = Math.min(1, Math.max(0, (end - now.getTime()) / (end - start)));
  const paid = planPrice(PLAN_BY_CODE[current.planCode], current.cycle);
  return Math.floor((paid * ratio) / 10) * 10;
}
