"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPlan } from "@/config/plans";
import { getSubscription, requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.enum(["pending", "processing", "done", "rejected"]);

export type AdminActionState = { ok?: boolean; error?: string; message?: string } | null;

/**
 * 요청 1건: 상태 변경 + 답변 저장 (+ AI 반영이면 사용 토큰 기록).
 * 사용 토큰은 record_ai_usage RPC 가 소유자 플랜 한도와 비교해 초과분을 토큰 크레딧에서 차감한다.
 * AI 파이프라인이 붙으면 같은 RPC 를 service role 로 호출하면 된다.
 */
export async function updateRequestAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const tokensRaw = formData.get("tokensUsed");
  const parsed = z
    .object({
      requestId: z.uuid(),
      status: statusSchema,
      note: z.string().max(2000).default(""),
      tokensUsed: z.number().int().min(0).max(50_000_000).nullable(),
    })
    .safeParse({
      requestId: formData.get("requestId"),
      status: formData.get("status"),
      note: formData.get("note") ?? "",
      tokensUsed: typeof tokensRaw === "string" && tokensRaw.trim() !== "" ? Number(tokensRaw) : null,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message.includes("FORBIDDEN") ? "관리자 권한이 없습니다." : error.message };

  let tokenMessage = "";
  if (parsed.data.tokensUsed !== null) {
    const { data: req } = await supabase.from("change_requests").select("kind, tokens_used, project:projects(user_id)").eq("id", parsed.data.requestId).maybeSingle();
    const r = req as unknown as { kind: string; tokens_used: number; project: { user_id: string } | null } | null;
    if (r?.kind === "ai" && r.project && r.tokens_used !== parsed.data.tokensUsed) {
      const owner = await getSubscription(r.project.user_id);
      const plan = owner.plan ?? getPlan(owner.subscription?.plan_code);
      const { data: usage, error: usageErr } = await supabase.rpc("record_ai_usage", {
        p_request_id: parsed.data.requestId,
        p_tokens: parsed.data.tokensUsed,
        p_monthly_ai_tokens: plan ? plan.monthlyAiTokens : 0,
      });
      if (usageErr) return { error: `상태는 저장했지만 토큰 기록에 실패했습니다: ${usageErr.message}` };
      const u = (usage as { tokens_used: number; period_used: number; credits_deducted: number }[] | null)?.[0];
      if (u) {
        const deducted = Number(u.credits_deducted);
        tokenMessage = ` 토큰 ${Number(u.tokens_used).toLocaleString("ko-KR")} 기록 (이번 기간 누적 ${Number(u.period_used).toLocaleString("ko-KR")}${deducted > 0 ? `, 크레딧 ${deducted.toLocaleString("ko-KR")} 차감` : ""}).`;
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { ok: true, message: `저장했습니다.${tokenMessage}` };
}

/** 묶음 전체 상태 일괄 변경 (목록에서 "이 묶음 처리중으로" 등) */
export async function updateBatchAction(batchId: string, status: string): Promise<AdminActionState> {
  await requireAdmin();
  const s = statusSchema.safeParse(status);
  if (!s.success || !z.uuid().safeParse(batchId).success) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_batch", { p_batch_id: batchId, p_status: s.data });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true, message: `${data as number}건을 변경했습니다.` };
}

/** 프로젝트 상태 변경 (제작 중 → 운영 중 등) */
export async function updateProjectStatusAction(projectId: string, status: string): Promise<AdminActionState> {
  await requireAdmin();
  const s = z.enum(["brief", "building", "review", "live"]).safeParse(status);
  if (!s.success || !z.uuid().safeParse(projectId).success) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_project_status", { p_project_id: projectId, p_status: s.data });
  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { ok: true, message: "프로젝트 상태를 변경했습니다." };
}
