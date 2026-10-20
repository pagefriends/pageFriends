import "server-only";

import type { Plan } from "@/config/plans";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 수정 요청 묶음 제출(DB 함수 submit_change_requests). 플랜의 월 토큰 · 월 전문가 한도를 넘긴다.
 * 0009 전 DB 는 전문가 한도 인자 이름이 p_weekly_expert 라서, 함수를 찾지 못하면(PGRST202) 그 이름으로 한 번 더 부른다.
 */
export async function submitChangeRequests(supabase: Supabase, projectId: string, items: unknown[], plan: Plan) {
  const args = { p_project_id: projectId, p_items: items, p_monthly_ai_tokens: plan.monthlyAiTokens };
  const res = await supabase.rpc("submit_change_requests", { ...args, p_monthly_expert: plan.monthlyExpert });
  if (res.error?.code === "PGRST202") return supabase.rpc("submit_change_requests", { ...args, p_weekly_expert: plan.monthlyExpert });
  return res;
}
