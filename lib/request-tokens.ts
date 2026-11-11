import "server-only";

import { formatTokens } from "@/config/plans";
import { planOfUser } from "@/lib/quota";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * "반영 불가" 로 처리한 AI 반영 요청의 토큰을 모두 돌려준다 — AI 가 쓴 토큰 · 담당자 작업 토큰 · 이미지 요청 토큰 모두
 * (토큰은 요청마다 바로 깎이므로, 해 드리지 못한 요청은 돌려준다. config/plans.ts 사용량 모델).
 * 관리자 세션으로 부른다 (record_ai_usage 는 관리자 · service role 만). 지금 상태가 반영 불가이고 남은 토큰 기록이 있을 때만 돌려주므로
 * 다시 불러도 두 번 돌려주지 않는다. 돌려준 요청마다 사용자 대화에 한 줄 남긴다.
 */
export async function refundRejectedRequests(supabase: Supabase, requestIds: string[]): Promise<{ refunded: number; tokens: number; failed: number }> {
  const result = { refunded: 0, tokens: 0, failed: 0 };
  if (!requestIds.length) return result;
  const { data } = await supabase.from("change_requests").select("id, kind, status, tokens_used, created_at, project:projects(user_id)").in("id", requestIds);
  const rows = (data as unknown as { id: string; kind: string; status: string; tokens_used: number; created_at: string; project: { user_id: string } | null }[] | null) ?? [];
  // 주인마다: 플랜 월 한도 · 이번 사용 기간 시작
  const ownerInfo = new Map<string, { monthly: number | null; hasPlan: boolean; windowStart: number }>();
  for (const r of rows) {
    if (r.kind !== "ai" || r.status !== "rejected" || !(r.tokens_used > 0) || !r.project) continue;
    const owner = r.project.user_id;
    if (!ownerInfo.has(owner)) {
      const plan = await planOfUser(supabase, owner);
      const { data: win } = await supabase.rpc("ai_token_usage", { p_user_id: owner });
      const start = (win as { period_start: string }[] | null)?.[0]?.period_start;
      ownerInfo.set(owner, { monthly: plan ? plan.monthlyAiTokens : null, hasPlan: Boolean(plan), windowStart: start ? Date.parse(start) : 0 });
    }
    const info = ownerInfo.get(owner)!;
    // 크레딧 정산은 지금 플랜이 있고 이번 사용 기간에 만든 요청일 때만. 그 밖(플랜 없음 · 지난 달 요청)은 사용 기록만 0 으로 —
    // 지난 기간의 사용을 이번 기간 기준으로 정산하거나, 한도에서 쓴 토큰을 만료 없는 크레딧으로 바꿔 주지 않게
    const settle = info.hasPlan && Date.parse(r.created_at) >= info.windowStart;
    const { error } = await supabase.rpc("record_ai_usage", { p_request_id: r.id, p_tokens: 0, p_monthly_ai_tokens: settle ? info.monthly : null });
    if (error) {
      console.error("[tokens] refund", error.message);
      result.failed += 1;
      continue;
    }
    result.refunded += 1;
    result.tokens += r.tokens_used;
    // 상태는 그대로(반영 불가) 두고 글만 남긴다
    const { error: noteErr } = await supabase.rpc("admin_reply_request", {
      p_request_id: r.id,
      p_status: "rejected",
      p_body: `이 요청에 쓴 토큰(${formatTokens(r.tokens_used)})은 돌려드렸어요.`,
      p_awaiting_user: false,
    });
    if (noteErr) console.error("[tokens] refund note", noteErr.message);
  }
  return result;
}
