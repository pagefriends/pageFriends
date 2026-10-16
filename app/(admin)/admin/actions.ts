"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getPlan } from "@/config/plans";
import { PROJECT_STATUS } from "@/config/requests";
import { getSubscription, requireAdmin } from "@/lib/auth/session";
import { isMissingSchema } from "@/lib/messages";
import { josa } from "@/lib/site-plan";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/types/db";

const statusSchema = z.enum(["pending", "processing", "done", "rejected"]);

export type AdminActionState = { ok?: boolean; error?: string; message?: string } | null;

/**
 * 요청 1건: 상태 변경 + 사용자에게 보낼 글 + "확인 필요" 표시 (+ AI 반영이면 사용 토큰 기록).
 * 글과 상태 변경은 그 요청의 대화에 쌓이고 사용자에게 알림으로 보인다 (DB 함수 admin_reply_request).
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
      awaiting: z.boolean(),
      tokensUsed: z.number().int().min(0).max(50_000_000).nullable(),
    })
    .safeParse({
      requestId: formData.get("requestId"),
      status: formData.get("status"),
      note: formData.get("note") ?? "",
      awaiting: formData.get("awaiting") === "on",
      tokensUsed: typeof tokensRaw === "string" && tokensRaw.trim() !== "" ? Number(tokensRaw) : null,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const note = parsed.data.note.trim();

  const supabase = await createClient();
  let { error } = await supabase.rpc("admin_reply_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_body: note,
    p_awaiting_user: parsed.data.awaiting,
  });
  if (error && isMissingSchema(error)) {
    // 0006 적용 전 DB: 예전 방식(답변 한 줄 덮어쓰기). 글을 비워 보냈으면 기존 답변을 지우지 않는다.
    const { data: current } = await supabase.from("change_requests").select("resolution_note").eq("id", parsed.data.requestId).maybeSingle();
    ({ error } = await supabase.rpc("admin_update_request", {
      p_request_id: parsed.data.requestId,
      p_status: parsed.data.status,
      p_note: note || ((current?.resolution_note as string | null) ?? ""),
    }));
  }
  if (error) {
    const m = error.message;
    if (m.includes("FORBIDDEN")) return { error: "관리자 권한이 없습니다." };
    if (m.includes("MESSAGE_REQUIRED")) return { error: "사용자에게 물어볼 내용을 적어 주세요. 질문 없이 '확인 필요' 만 켤 수는 없습니다." };
    if (m.includes("REQUEST_NOT_FOUND")) return { error: "요청을 찾을 수 없습니다." };
    return { error: m };
  }

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

  const { data: owner } = await supabase.from("change_requests").select("project_id").eq("id", parsed.data.requestId).maybeSingle();
  if (owner?.project_id) await syncProjectAfterRequests(supabase, owner.project_id as string);

  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { ok: true, message: `저장했습니다.${note ? " 사용자에게 글을 보냈습니다." : ""}${tokenMessage}` };
}

/**
 * 담당자가 요청을 열어 보면 자동으로 "확인 완료" (접수 → 확인 완료). 사람이 답하는 요청(전문가 · 오류 신고)만 —
 * AI 반영은 요청하는 순간부터 "AI 진행 중" 이라 확인 단계가 없다. 상태 기록이 대화에 남아 사용자도 확인된 것을 안다.
 */
export async function markRequestCheckedAction(requestId: string): Promise<void> {
  await requireAdmin();
  if (!z.uuid().safeParse(requestId).success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("change_requests").select("status, kind, awaiting_user").eq("id", requestId).maybeSingle();
  if (!data || data.status !== "pending" || data.kind === "ai") return;
  await supabase.rpc("admin_reply_request", {
    p_request_id: requestId,
    p_status: "processing",
    p_body: "",
    p_awaiting_user: Boolean(data.awaiting_user),
  });
  revalidatePath("/admin");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 제작 완료 뒤 들어온 수정 요청(수정 반영 중)을 모두 처리하면 프로젝트를 다시 "제작 완료" 로 돌린다 */
async function syncProjectAfterRequests(supabase: Supabase, projectId: string): Promise<void> {
  const { data: p } = await supabase.from("projects").select("status").eq("id", projectId).maybeSingle();
  if (p?.status !== "review") return;
  const { count } = await supabase.from("change_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId).in("status", ["pending", "processing"]);
  if ((count ?? 0) === 0) await supabase.rpc("admin_update_project_status", { p_project_id: projectId, p_status: "live" });
}

/** 묶음 전체 상태 일괄 변경 (목록에서 "이 묶음 처리중으로" 등). 상태가 바뀐 요청마다 사용자에게 알림이 간다. */
export async function updateBatchAction(batchId: string, status: string): Promise<AdminActionState> {
  await requireAdmin();
  const s = statusSchema.safeParse(status);
  if (!s.success || !z.uuid().safeParse(batchId).success) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_update_batch", { p_batch_id: batchId, p_status: s.data });
  if (error) return { error: error.message };
  const { data: one } = await supabase.from("change_requests").select("project_id").eq("batch_id", batchId).limit(1).maybeSingle();
  if (one?.project_id) await syncProjectAfterRequests(supabase, one.project_id as string);
  revalidatePath("/admin");
  return { ok: true, message: `${data as number}건을 변경했습니다.` };
}

/**
 * 프로젝트 상태 변경 (제작 중 → 운영 중 등). 상태가 실제로 바뀌면 사이트 메시지로 사용자에게 알린다 —
 * "첫 완성본이 올라왔다" 같은 변화를 사용자가 대시보드를 들여다보지 않아도 알 수 있게.
 */
export async function updateProjectStatusAction(projectId: string, status: string): Promise<AdminActionState> {
  await requireAdmin();
  const s = z.enum(["brief", "building", "review", "live"]).safeParse(status);
  if (!s.success || !z.uuid().safeParse(projectId).success) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("projects").select("status").eq("id", projectId).maybeSingle();
  const { error } = await supabase.rpc("admin_update_project_status", { p_project_id: projectId, p_status: s.data });
  if (error) return { error: error.message };
  const old = before?.status as ProjectStatus | undefined;
  if (old && old !== s.data) {
    // 알림 실패(0006 적용 전 등)는 상태 변경을 되돌릴 이유가 아니다
    const label = PROJECT_STATUS[s.data].label;
    const body =
      s.data === "live" && (old === "building" || old === "brief")
        ? "사이트 제작을 마쳤어요. 편집 화면에서 확인해 주세요. 고칠 곳은 빨간 네모로 요청하시면 돼요. 확인이 끝나면 편집 화면 위의 '웹사이트 공개 요청' 을 눌러 주세요 — 확인용 서버에서 먼저 점검한 뒤 실제 웹사이트로 공개해 드려요."
        : `사이트 상태가 '${label}'${josa(label, "으로/로").slice(label.length)} 바뀌었습니다.`;
    await supabase.rpc("admin_post_message", { p_project_id: projectId, p_body: body });
  }
  revalidatePath("/admin");
  return { ok: true, message: "프로젝트 상태를 변경했습니다." };
}

export type AdminMessageResult = { ok: true } | { ok: false; error: string };

/** 사이트 메시지 보내기 (네모와 상관없는 안내·질문). 사용자의 "메시지" 화면과 알림에 보인다. */
export async function postProjectMessageAction(projectId: string, body: string): Promise<AdminMessageResult> {
  await requireAdmin();
  const parsed = z.object({ projectId: z.uuid(), body: z.string().trim().min(1, "내용을 입력하세요.").max(2000, "2,000자까지 보낼 수 있습니다.") }).safeParse({ projectId, body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "내용을 확인하세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_post_message", { p_project_id: parsed.data.projectId, p_body: parsed.data.body });
  if (error) {
    if (isMissingSchema(error)) return { ok: false, error: "메시지 기능을 쓰려면 supabase/migrations/0006_messages.sql 을 먼저 적용하세요." };
    if (error.message.includes("FORBIDDEN")) return { ok: false, error: "관리자 권한이 없습니다." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/messages/${parsed.data.projectId}`);
  return { ok: true };
}

/** 화면에 보여준 사용자 글을 읽음으로 표시. 다시 그리지 않는다 (이번 방문 동안 "새 글" 표시 유지). */
export async function markUserMessagesReadAction(ids: string[]): Promise<void> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.rpc("admin_mark_messages_read", { p_ids: parsed.data });
}

/**
 * 문의(inquiries) 상태 변경. 서버 컴포넌트의 <form action> 에서 직접 쓰므로 반환값 대신 리다이렉트로 결과를 알린다.
 * 폼: hidden id + select status (+ 현재 목록 필터 유지용 hidden kind).
 */
export async function updateInquiryStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["new", "contacted", "closed"]), kind: z.string().max(20).default("") })
    .safeParse({ id: formData.get("id"), status: formData.get("status"), kind: formData.get("kind") ?? "" });
  const back = (patch: Record<string, string>) => {
    const q = new URLSearchParams();
    if (parsed.success && parsed.data.kind) q.set("kind", parsed.data.kind);
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    return `/admin/inquiries?${q.toString()}`;
  };
  if (!parsed.success) redirect(back({ error: "잘못된 요청입니다." }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_inquiry", { p_id: parsed.data.id, p_status: parsed.data.status });
  if (error) redirect(back({ error: error.message.includes("FORBIDDEN") ? "관리자 권한이 없습니다." : error.message }));
  revalidatePath("/admin/inquiries");
  redirect(back({ ok: "1" }));
}
