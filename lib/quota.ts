import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlan, type Plan, type PlanCode } from "@/config/plans";
import { effectiveSubscription } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import type { CreditRow, SubscriptionRow } from "@/lib/types/db";

/**
 * 남은 토큰 한눈에: 이번 달 한도 · 쓴 토큰 · 토큰 크레딧 · 남은 토큰(무제한 플랜이면 null).
 * 남은 토큰 = 한도에서 남은 것(0 아래로는 내려가지 않는다) + 크레딧. 한도를 넘은 사용은 record_ai_usage 가 그때그때 크레딧에서 이미 뺐으므로
 * "한도 - 사용 + 크레딧" 으로 계산하면 넘은 만큼을 두 번 빼게 된다.
 */
export type TokenBalance = { monthly: number | null; used: number; credits: number; left: number | null };

/** 그 사용자가 지금 쓸 수 있는 플랜 (결제 상태까지 본다). db = service role 또는 본인 세션 */
export async function planOfUser(db: SupabaseClient, userId: string): Promise<Plan | null> {
  const { data } = await db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const sub = (data as SubscriptionRow | null) ?? null;
  return effectiveSubscription(sub).usable ? getPlan(sub?.plan_code as PlanCode | undefined) : null;
}

/**
 * 남은 토큰. AI 엔진(담당자에게 넘기기 전 확인) · 편집기 "AI 작업 중" 화면(바로 줄어드는 토큰)이 쓴다.
 * db = service role 또는 본인 세션 (ai_token_usage 가 본인 · 관리자 · service role 만 허락한다). 플랜이 없으면 한도 0.
 */
export async function tokenBalance(db: SupabaseClient, userId: string, plan: Plan | null): Promise<TokenBalance> {
  const [{ data: usage }, { data: credit }] = await Promise.all([
    db.rpc("ai_token_usage", { p_user_id: userId }),
    db.from("credits").select("balance").eq("user_id", userId).eq("kind", "ai").maybeSingle(),
  ]);
  const used = Number((usage as { used: number | string }[] | null)?.[0]?.used ?? 0);
  const credits = Number((credit as { balance: number } | null)?.balance ?? 0);
  const monthly = plan ? plan.monthlyAiTokens : 0;
  return { monthly, used, credits, left: monthly === null ? null : Math.max(0, monthly - used) + credits };
}

/**
 * 사용량 요약. 편집기 오른쪽 패널과 결제 페이지가 쓴다.
 * - 기간: 결제일부터 한 달씩 (연간 결제도 매달 다시 채워진다 — DB 의 usage_window). 구독이 없으면 이번 달.
 * - ai: 이번 기간의 토큰 사용량 + 월 한도 + 토큰 크레딧
 * - expert: 이번 기간의 횟수 + 월 한도 + 횟수 크레딧
 * - bug(오류 신고)는 무료라 여기 없다.
 */
export type QuotaInfo = {
  ai: {
    /** 월 토큰 한도. null = 무제한 */
    monthly: number | null;
    used: number;
    /** 한도에서 남은 토큰 (크레딧 제외). 무제한이면 null */
    remaining: number | null;
    /** 토큰 크레딧 잔액 */
    credits: number;
    /** 이번 기간이 끝나고 한도가 다시 채워지는 때 */
    periodEnd: string;
  };
  expert: { monthly: number | null; used: number; remaining: number | null; credits: number };
};

export async function getQuota(userId: string, plan: Plan | null): Promise<QuotaInfo> {
  const supabase = await createClient();
  const [{ data: tokenRows }, requests, { data: credits }] = await Promise.all([
    supabase.rpc("ai_token_usage", { p_user_id: userId }),
    requestUsage(supabase, userId),
    supabase.from("credits").select("*").eq("user_id", userId),
  ]);

  const token = ((tokenRows as { period_start: string; period_end: string; used: number }[] | null) ?? [])[0];
  const usedTokens = Number(token?.used ?? 0);
  let usedExpert = 0;
  for (const row of requests) if (row.kind === "expert") usedExpert = Number(row.used);
  const credit = { ai: 0, expert: 0 };
  for (const row of (credits as CreditRow[] | null) ?? []) credit[row.kind] = row.balance;

  const monthly = plan ? plan.monthlyAiTokens : 0;
  const monthlyExpert = plan ? plan.monthlyExpert : 0;
  return {
    ai: {
      monthly,
      used: usedTokens,
      remaining: monthly === null ? null : Math.max(0, monthly - usedTokens),
      credits: credit.ai,
      periodEnd: token?.period_end ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
    expert: {
      monthly: monthlyExpert,
      used: usedExpert,
      remaining: monthlyExpert === null ? null : Math.max(0, monthlyExpert - usedExpert),
      credits: credit.expert,
    },
  };
}

/** 이번 기간의 요청 수. 0009 전 DB 에는 request_usage 가 없어 예전 주간 집계를 쓴다 */
async function requestUsage(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<{ kind: string; used: number }[]> {
  const { data, error } = await supabase.rpc("request_usage", { p_user_id: userId });
  if (!error) return (data as { kind: string; used: number }[] | null) ?? [];
  const { data: weekly } = await supabase.rpc("weekly_request_usage", { p_user_id: userId });
  return (weekly as { kind: string; used: number }[] | null) ?? [];
}
