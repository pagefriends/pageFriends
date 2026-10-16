import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { MAX_PHOTO_BYTES, deletePhoto, isPhotoName, listProjectPhotos, sniffImage, uploadPhoto } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief } from "@/lib/types/db";

/**
 * 이미지 자리에 실제 사진 올리기.
 *   GET    /api/projects/{id}/photos              → { photos: { [자리 id]: 사진[] } }
 *   POST   /api/projects/{id}/photos  (form: slotId, file[, notify, count]) → { photo }   한 번에 한 장
 *   DELETE /api/projects/{id}/photos?name={사진 이름}
 * 사이트 주인과 관리자만 쓸 수 있다 — 프로젝트를 RLS 로 읽어 보고, 읽히면 권한이 있는 것이다.
 */

const idSchema = z.uuid();

async function access(projectId: string) {
  if (!idSchema.safeParse(projectId).success) return null;
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, user_id, brief").eq("id", projectId).maybeSingle();
  if (!data) return null;
  return { supabase, owner: data.user_id === user.id, brief: data.brief as ProjectBrief };
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[id]/photos">) {
  const { id } = await ctx.params;
  if (!(await access(id))) return apiError(404, "NOT_FOUND", "사이트를 찾을 수 없습니다.");
  return NextResponse.json({ photos: await listProjectPhotos(id) }, { headers: noStore });
}

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/photos">) {
  const { id } = await ctx.params;
  const a = await access(id);
  if (!a) return apiError(404, "NOT_FOUND", "사이트를 찾을 수 없습니다.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "BAD_REQUEST", "사진을 받지 못했습니다. 다시 올려 주세요.");
  }
  const slotId = String(form.get("slotId") ?? "");
  const file = form.get("file");
  const slot = a.brief.site?.images.find((s) => s.id === slotId);
  if (!slot) return apiError(400, "UNKNOWN_SLOT", "이미지 자리를 찾을 수 없습니다. 화면을 새로 고쳐 주세요.");
  if (!(file instanceof File) || file.size === 0) return apiError(400, "NO_FILE", "올릴 사진을 골라 주세요.");
  if (file.size > MAX_PHOTO_BYTES) return apiError(413, "TOO_LARGE", "사진이 너무 커요. 8MB 이하로 올려 주세요.");

  const already = (await listProjectPhotos(id))[slot.id]?.length ?? 0;
  if (already >= slot.count) {
    return apiError(409, "SLOT_FULL", `이 자리는 사진 ${slot.count}장까지예요. 바꾸려면 먼저 지워 주세요.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return apiError(415, "NOT_IMAGE", "JPG · PNG · WEBP 사진만 올릴 수 있어요.");

  let photo;
  try {
    photo = await uploadPhoto(id, slot.id, bytes, type);
  } catch (e) {
    console.error("[photos] upload", e);
    return apiError(500, "UPLOAD_FAILED", "사진을 저장하지 못했습니다. 잠시 후 다시 올려 주세요.");
  }

  // 사이트 주인이 여러 장을 올리면 마지막 장에서 한 번만 담당자에게 알린다 (사이트 메시지). 알림 실패는 업로드를 막지 않는다
  if (a.owner && form.get("notify") === "1") {
    const n = Math.max(1, Math.min(slot.count, Number(form.get("count")) || 1));
    await a.supabase.rpc("post_message", {
      p_project_id: id,
      p_request_id: null,
      p_body: `[사진 올림] ${slot.label} ${n}장을 올렸어요. 제작 정보의 이미지 자리에서 볼 수 있어요.`,
    });
  }
  return NextResponse.json({ photo }, { headers: noStore });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/projects/[id]/photos">) {
  const { id } = await ctx.params;
  if (!(await access(id))) return apiError(404, "NOT_FOUND", "사이트를 찾을 수 없습니다.");
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!isPhotoName(name)) return apiError(400, "BAD_NAME", "지울 사진을 찾을 수 없습니다.");
  try {
    await deletePhoto(id, name);
  } catch (e) {
    console.error("[photos] delete", e);
    return apiError(500, "DELETE_FAILED", "사진을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
