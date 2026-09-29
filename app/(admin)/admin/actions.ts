"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.enum(["pending", "processing", "done", "rejected"]);

export type AdminActionState = { ok?: boolean; error?: string; message?: string } | null;

/** 요청 1건: 상태 변경 + 답변 저장 */
export async function updateRequestAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = z
    .object({ requestId: z.uuid(), status: statusSchema, note: z.string().max(2000).default("") })
    .safeParse({ requestId: formData.get("requestId"), status: formData.get("status"), note: formData.get("note") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message.includes("FORBIDDEN") ? "관리자 권한이 없습니다." : error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/requests/${parsed.data.requestId}`);
  return { ok: true, message: "저장했습니다." };
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
