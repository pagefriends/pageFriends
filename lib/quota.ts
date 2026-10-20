import "server-only";

import type { Plan } from "@/config/plans";
import { createClient } from "@/lib/supabase/server";
import type { CreditRow } from "@/lib/types/db";

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
