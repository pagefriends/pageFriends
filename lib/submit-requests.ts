import "server-only";

import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import type { Plan } from "@/config/plans";
import { IMAGE_REQUEST_TOKENS, isImageRequest } from "@/config/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * 수정 요청 묶음 제출(DB 함수 submit_change_requests) + AI 이미지 요청 토큰 바로 차감.
 *
 * 0012 부터는 submit_change_requests 를 서버(service role)만 부를 수 있다. 예전 함수는 로그인한 사용자 누구나 직접 부를 수 있었고
 * 플랜 한도를 부르는 쪽이 넘겼다 — 한도에 null 을 넣으면 토큰 · 전문가 한도를 건너뛸 수 있었다. 그래서 서버가 로그인 · 플랜을 확인한 뒤
 * 사용자 id 와 플랜의 월 토큰 · 월 전문가 한도를 넘긴다 (부르는 쪽은 userId 를 세션에서 얻은 값으로만 넘길 것).
 * 0012 전 DB 는 예전처럼 사용자 세션으로 부른다 (0009 전 DB 는 전문가 한도 인자 이름이 p_weekly_expert).
 */
export async function submitChangeRequests(supabase: Supabase, userId: string, projectId: string, items: unknown[], plan: Plan): Promise<PostgrestSingleResponse<unknown>> {
  const limits = { p_monthly_ai_tokens: plan.monthlyAiTokens, p_monthly_expert: plan.monthlyExpert };
  let res: PostgrestSingleResponse<unknown> | null = null;
  try {
    res = await createAdminClient().rpc("submit_change_requests", { p_user_id: userId, p_project_id: projectId, p_items: items, ...limits });
  } catch (e) {
    console.error("[requests] submit (service role)", e);
  }
  if (!res || res.error?.code === "PGRST202") {
    const args = { p_project_id: projectId, p_items: items, p_monthly_ai_tokens: plan.monthlyAiTokens };
    res = await supabase.rpc("submit_change_requests", { ...args, p_monthly_expert: plan.monthlyExpert });
    if (res.error?.code === "PGRST202") res = await supabase.rpc("submit_change_requests", { ...args, p_weekly_expert: plan.monthlyExpert });
  }
  if (!res.error && typeof res.data === "string") await chargeImageRequests(res.data, plan);
  return res;
}

/**
 * AI 이미지 요청은 요청하는 순간 장당 IMAGE_REQUEST_TOKENS 를 깎는다 (다른 AI 요청처럼 "쓴 만큼 바로").
 * 실제 이미지는 담당자가 만들어 넣고(이미지 생성 API 전), 만들 수 없어 "반영 불가" 로 처리하면 담당자 화면이 돌려준다.
 * 이미 기록된 요청은 건너뛴다 (record_ai_usage 는 누적값을 기록하므로 다시 불러도 두 번 깎이지 않는다).
 */
export async function chargeImageRequests(batchId: string, plan: Plan): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("change_requests").select("id, message, tokens_used").eq("batch_id", batchId).eq("kind", "ai");
    for (const r of (data as { id: string; message: string; tokens_used: number }[] | null) ?? []) {
      if (!isImageRequest(r.message) || r.tokens_used > 0) continue;
      const { error } = await admin.rpc("record_ai_usage", { p_request_id: r.id, p_tokens: IMAGE_REQUEST_TOKENS, p_monthly_ai_tokens: plan.monthlyAiTokens });
      if (error) console.error("[requests] image tokens", error.message);
    }
  } catch (e) {
    console.error("[requests] image tokens", e);
  }
}
