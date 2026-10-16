"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/session";
import { isMissingSchema } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

/**
 * 웹사이트 적용 (관리자). 실제 배포는 담당자가 평소 쓰는 방법으로 하고, 여기서는 단계마다 기록한다:
 *   ① 개발 서버에 배포 → ② 개발 서버에서 확인 목록 체크 (문제가 있으면 다시 고치기) → ③ 운영에 배포.
 * 순서와 확인 목록은 DB 함수(admin_release_*)가 지킨다 — 개발 서버를 거치지 않으면 운영 배포가 거절된다.
 */
export type ReleaseActionResult = { ok: true; message?: string } | { ok: false; error: string };

const ERRORS: [string, string][] = [
  ["FORBIDDEN", "관리자 권한이 없습니다."],
  ["INVALID_URL", "http:// 또는 https:// 로 시작하는 주소를 넣어 주세요."],
  ["NOT_STAGED", "개발 서버에 먼저 배포하고 확인해야 합니다. 화면을 새로 고쳐 단계를 확인해 주세요."],
  ["INVALID_STATE", "지금 단계에서는 할 수 없습니다. 화면을 새로 고쳐 주세요."],
  ["NOTE_REQUIRED", "어떤 문제가 있었는지 적어 주세요."],
  ["RELEASE_NOT_FOUND", "적용 요청을 찾을 수 없습니다."],
  ["INVALID_KEY", "잘못된 확인 항목입니다."],
];

function fail(error: { message: string; code?: string }): ReleaseActionResult {
  if (isMissingSchema(error)) return { ok: false, error: "웹사이트 적용을 쓰려면 supabase/migrations/0007_releases.sql 을 먼저 적용하세요." };
  const left = error.message.match(/CHECKS_INCOMPLETE:(\d+)/);
  if (left) return { ok: false, error: `개발 서버 확인이 ${left[1]}개 남았습니다. 모두 체크해야 운영에 배포할 수 있습니다.` };
  return { ok: false, error: ERRORS.find(([code]) => error.message.includes(code))?.[1] ?? error.message };
}

function isWebUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

const urlSchema = z.string().trim().min(1, "주소를 넣어 주세요.").max(500).refine(isWebUrl, "http:// 또는 https:// 로 시작하는 주소를 넣어 주세요.");

function done(releaseId: string) {
  revalidatePath("/admin/releases");
  revalidatePath(`/admin/releases/${releaseId}`);
}

/** ① 개발 서버에 배포했다 (처음이면 사용자에게 "점검 중" 알림). 다시 배포하면 확인 목록은 처음부터 */
export async function stageReleaseAction(releaseId: string, url: string): Promise<ReleaseActionResult> {
  await requireAdmin();
  const parsed = z.object({ releaseId: z.uuid(), url: urlSchema }).safeParse({ releaseId, url });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_staging", { p_release_id: parsed.data.releaseId, p_url: parsed.data.url });
  if (error) return fail(error);
  done(parsed.data.releaseId);
  return { ok: true, message: "개발 서버 배포를 기록했습니다. 이제 개발 서버에서 하나씩 확인해 주세요." };
}

/** ② 확인 목록 한 칸 */
export async function setReleaseCheckAction(releaseId: string, key: string, value: boolean): Promise<ReleaseActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ releaseId: z.uuid(), key: z.string().regex(/^(site|screens|db_dev|db_prod|req:[0-9a-f-]{36})$/), value: z.boolean() })
    .safeParse({ releaseId, key, value });
  if (!parsed.success) return { ok: false, error: "잘못된 확인 항목입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_check", { p_release_id: parsed.data.releaseId, p_key: parsed.data.key, p_value: parsed.data.value });
  if (error) return fail(error);
  done(parsed.data.releaseId);
  return { ok: true };
}

/** ② 폼·DB 구조 변경 포함 여부 (켜면 개발 DB · 운영 DB 확인이 더해진다) */
export async function setReleaseDbChangeAction(releaseId: string, value: boolean): Promise<ReleaseActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(releaseId).success) return { ok: false, error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_db_change", { p_release_id: releaseId, p_value: value });
  if (error) return fail(error);
  done(releaseId);
  return { ok: true };
}

/** ② 개발 서버에서 문제를 찾았다 → 다시 고치기 (고친 뒤 개발 서버에 다시 배포) */
export async function reportReleaseIssueAction(releaseId: string, note: string): Promise<ReleaseActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ releaseId: z.uuid(), note: z.string().trim().min(1, "어떤 문제가 있었는지 적어 주세요.").max(1000, "1,000자까지 적을 수 있습니다.") })
    .safeParse({ releaseId, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_issue", { p_release_id: parsed.data.releaseId, p_note: parsed.data.note });
  if (error) return fail(error);
  done(parsed.data.releaseId);
  return { ok: true, message: "다시 고치기로 돌렸습니다. 고친 뒤 개발 서버에 다시 배포해 주세요." };
}

/** ③ 운영에 배포했다. 개발 서버 확인을 모두 마쳤을 때만 (DB 가 다시 검사). 사용자에게 웹사이트 주소와 함께 알린다 */
export async function publishReleaseAction(releaseId: string, url: string): Promise<ReleaseActionResult> {
  await requireAdmin();
  const parsed = z.object({ releaseId: z.uuid(), url: urlSchema }).safeParse({ releaseId, url });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_live", { p_release_id: parsed.data.releaseId, p_url: parsed.data.url });
  if (error) return fail(error);
  done(parsed.data.releaseId);
  revalidatePath("/admin");
  return { ok: true, message: "운영 배포를 기록하고 사용자에게 알렸습니다." };
}

/** 적용 취소 (운영 반영 전). 실렸던 수정은 다시 "적용 대기" 가 되고 사용자에게 알림이 간다 */
export async function cancelReleaseByAdminAction(releaseId: string, note: string): Promise<ReleaseActionResult> {
  await requireAdmin();
  const parsed = z.object({ releaseId: z.uuid(), note: z.string().trim().max(500, "500자까지 적을 수 있습니다.") }).safeParse({ releaseId, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_release_cancel", { p_release_id: parsed.data.releaseId, p_note: parsed.data.note });
  if (error) return fail(error);
  done(parsed.data.releaseId);
  return { ok: true, message: "적용 요청을 취소하고 사용자에게 알렸습니다." };
}
