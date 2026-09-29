import "server-only";

import type { Plan } from "@/config/plans";
import { createClient } from "@/lib/supabase/server";
import type { CreditRow } from "@/lib/types/db";

/**
 * 사용량 요약. 편집기 오른쪽 패널과 결제 페이지가 쓴다.
 * - ai: 이번 결제 기간(구독 없으면 이번 달)의 토큰 사용량 + 월 한도 + 토큰 크레딧
 * - expert: 이번 주 횟수 + 주간 한도 + 횟수 크레딧
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
    periodEnd: string;
  };
  expert: { weekly: number | null; used: number; remaining: number | null; credits: number };
};

export async function getQuota(userId: string, plan: Plan | null): Promise<QuotaInfo> {
  const supabase = await createClient();
  const [{ data: tokenRows }, { data: weekly }, { data: credits }] = await Promise.all([
    supabase.rpc("ai_token_usage", { p_user_id: userId }),
    supabase.rpc("weekly_request_usage", { p_user_id: userId }),
    supabase.from("credits").select("*").eq("user_id", userId),
  ]);

  const token = ((tokenRows as { period_start: string; period_end: string; used: number }[] | null) ?? [])[0];
  const usedTokens = Number(token?.used ?? 0);
  let usedExpert = 0;
  for (const row of (weekly as { kind: string; used: number }[] | null) ?? []) if (row.kind === "expert") usedExpert = Number(row.used);
  const credit = { ai: 0, expert: 0 };
  for (const row of (credits as CreditRow[] | null) ?? []) credit[row.kind] = row.balance;

  const monthly = plan ? plan.monthlyAiTokens : 0;
  const weeklyExpert = plan ? plan.weeklyExpert : 0;
  return {
    ai: {
      monthly,
      used: usedTokens,
      remaining: monthly === null ? null : Math.max(0, monthly - usedTokens),
      credits: credit.ai,
      periodEnd: token?.period_end ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
    },
    expert: {
      weekly: weeklyExpert,
      used: usedExpert,
      remaining: weeklyExpert === null ? null : Math.max(0, weeklyExpert - usedExpert),
      credits: credit.expert,
    },
  };
}
