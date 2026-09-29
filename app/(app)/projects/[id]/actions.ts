"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSubscription, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  page_id: z.uuid(),
  device: z.enum(["mobile", "tablet", "desktop"]),
  kind: z.enum(["ai", "expert", "bug"]),
  seq: z.number().int().min(1).max(999),
  region: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
  message: z.string().trim().min(1, "요청사항을 입력하세요").max(2000),
});

export type SubmitResult = { ok: true; batchId: string; count: number } | { ok: false; error: string };

/**
 * "한번에 요청하기". 네모 하나 = 요청 하나 (seq 로 번호가 붙는다). 실제 삽입·한도 검사·크레딧 차감은
 * DB 함수 submit_change_requests 가 한 트랜잭션으로 처리한다.
 * 여기서는 입력 검증, 플랜 존재 확인, 플랜 상수(월 AI 토큰·주간 전문가 한도) 전달만 한다.
 */
export async function submitRequestsAction(projectId: string, rawItems: unknown): Promise<SubmitResult> {
  const user = await requireUser();
  const parsed = z.array(itemSchema).min(1).max(100).safeParse(rawItems);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "요청 내용을 확인하세요." };

  const { plan } = await getSubscription(user.id);
  if (!plan) return { ok: false, error: "플랜이 있어야 요청을 보낼 수 있습니다. 플랜을 먼저 선택하세요." };

  // 플랜이 허용하지 않는 디바이스 요청은 거부 (UI 우회 방지)
  if (parsed.data.some((i) => !plan.devices.includes(i.device))) {
    return { ok: false, error: `${plan.name} 플랜에서 지원하지 않는 화면이 포함되어 있습니다.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_change_requests", {
    p_project_id: projectId,
    p_items: parsed.data,
    p_monthly_ai_tokens: plan.monthlyAiTokens,
    p_weekly_expert: plan.weeklyExpert,
  });

  if (error) {
    const m = error.message;
    if (m.includes("AI_TOKENS_EXHAUSTED")) return { ok: false, error: "이번 달 AI 토큰을 모두 썼습니다. 토큰 크레딧을 구매하거나 다음 결제 기간에 다시 요청하세요." };
    if (m.includes("QUOTA_EXCEEDED_EXPERT")) return { ok: false, error: `전문가 요청 주간 한도를 넘었고 크레딧이 ${m.split(":")[1] ?? ""}건 부족합니다.` };
    if (m.includes("PROJECT_NOT_FOUND")) return { ok: false, error: "프로젝트를 찾을 수 없습니다." };
    return { ok: false, error: m };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true, batchId: data as string, count: parsed.data.length };
}
