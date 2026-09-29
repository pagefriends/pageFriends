import "server-only";

import type { Plan, RequestKind } from "@/config/plans";
import { createClient } from "@/lib/supabase/server";
import type { CreditRow } from "@/lib/types/db";

export type QuotaInfo = {
  ai: { weekly: number | null; used: number; remaining: number | null; credits: number };
  expert: { weekly: number | null; used: number; remaining: number | null; credits: number };
};

/** 이번 주 사용량 + 남은 한도 + 보유 크레딧. 편집기 오른쪽 패널과 결제 페이지가 쓴다. */
export async function getQuota(userId: string, plan: Plan | null): Promise<QuotaInfo> {
  const supabase = await createClient();
  const [{ data: usage }, { data: credits }] = await Promise.all([
    supabase.rpc("weekly_request_usage", { p_user_id: userId }),
    supabase.from("credits").select("*").eq("user_id", userId),
  ]);
  const used: Record<RequestKind, number> = { ai: 0, expert: 0 };
  for (const row of (usage as { kind: RequestKind; used: number }[] | null) ?? []) used[row.kind] = Number(row.used);
  const credit: Record<RequestKind, number> = { ai: 0, expert: 0 };
  for (const row of (credits as CreditRow[] | null) ?? []) credit[row.kind] = row.balance;

  const build = (kind: RequestKind) => {
    const weekly = plan ? (kind === "ai" ? plan.weeklyAi : plan.weeklyExpert) : 0;
    return { weekly, used: used[kind], remaining: weekly === null ? null : Math.max(0, weekly - used[kind]), credits: credit[kind] };
  };
  return { ai: build("ai"), expert: build("expert") };
}
