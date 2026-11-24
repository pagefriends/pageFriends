import "server-only";

import { FREE_BETA } from "@/config/beta";
import { getServerEnv } from "@/lib/env";
import { isMissingSchema } from "@/lib/messages";
import { effectiveSubscription } from "@/lib/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionRow } from "@/lib/types/db";

/**
 * 무료 베타 (config/beta.ts · 0014_free_beta.sql). 사업자등록 전이라 결제 없이 정해진 플랜을 몇 달 동안 연다.
 * 무료 베타 구독은 해지 예약 상태(cancel_at_period_end)로 만들어 기간이 끝나면 저절로 만료된다 — 자동 결제 · 갱신 예약이 없다.
 * 한 사람당 한 번 (beta_started_at 은 지우지 않는다), 선착순 FREE_BETA.seats 자리.
 * 쓰기는 service role 만 한다.
 */

export function betaEnabled(): boolean {
  return getServerEnv().FREE_BETA === "on";
}

export type BetaStatus = {
  /** 무료 베타를 받는 중인지 (FREE_BETA=on · 0014 실행) */
  open: boolean;
  seatsLeft: number;
  /** 이 사용자가 지금 무료로 시작할 수 있는지 (플랜 없음 · 처음 · 자리 있음) */
  canStart: boolean;
  /** 이미 무료 베타를 받은 적이 있음 */
  used: boolean;
};

async function usedSeats(): Promise<number | null> {
  const { count, error } = await createAdminClient().from("subscriptions").select("id", { count: "exact" }).not("beta_started_at", "is", null).limit(1);
  if (error) {
    if (!isMissingSchema(error)) console.error("[beta] seats", error.message);
    return null;
  }
  return count ?? 0;
}

export async function getBetaStatus(sub: SubscriptionRow | null): Promise<BetaStatus> {
  if (!betaEnabled()) return { open: false, seatsLeft: 0, canStart: false, used: false };
  const used = await usedSeats();
  if (used === null) return { open: false, seatsLeft: 0, canStart: false, used: false };
  const seatsLeft = Math.max(0, FREE_BETA.seats - used);
  const already = Boolean(sub?.beta_started_at);
  const hasPlan = effectiveSubscription(sub).usable;
  return { open: true, seatsLeft, canStart: seatsLeft > 0 && !already && !hasPlan, used: already };
}

export class BetaError extends Error {}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** 무료 베타 시작: 결제 없이 FREE_BETA.planCode 를 FREE_BETA.months 개월 연다 */
export async function startBeta(userId: string): Promise<{ until: string }> {
  if (!betaEnabled()) throw new BetaError("지금은 무료 베타를 받고 있지 않아요.");
  const admin = createAdminClient();
  const { data, error } = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  const sub = (data as SubscriptionRow | null) ?? null;
  const status = await getBetaStatus(sub);
  if (!status.open) throw new BetaError("지금은 무료 베타를 받고 있지 않아요.");
  if (status.used) throw new BetaError("무료 베타는 한 번만 받을 수 있어요.");
  if (effectiveSubscription(sub).usable) throw new BetaError("이미 플랜을 쓰고 있어요.");
  if (status.seatsLeft <= 0) throw new BetaError("무료 베타 자리가 모두 찼어요.");

  const now = new Date();
  const until = addMonths(now, FREE_BETA.months);
  const row = {
    plan_code: FREE_BETA.planCode,
    status: "active",
    payment_addon: false,
    billing_cycle: "month",
    current_period_start: now.toISOString(),
    current_period_end: until.toISOString(),
    // 기간이 끝나면 저절로 만료 (자동 결제 없음)
    cancel_at_period_end: true,
    cancelled_at: null,
    next_payment_id: null,
    portone_schedule_id: null,
    next_payment_at: null,
    failed_attempts: 0,
    last_failure_at: null,
    last_failure_reason: null,
    pending_plan_code: null,
    pending_billing_cycle: null,
    beta: true,
    beta_started_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const res = sub
    ? await admin.from("subscriptions").update(row).eq("id", sub.id).is("beta_started_at", null)
    : await admin.from("subscriptions").insert({ ...row, user_id: userId });
  if (res.error) {
    if (res.error.code === "23505") throw new BetaError("무료 베타는 한 번만 받을 수 있어요.");
    throw new Error(res.error.message);
  }
  return { until: until.toISOString() };
}
