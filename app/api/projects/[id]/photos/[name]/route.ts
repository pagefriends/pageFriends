import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { isPhotoName, signedPhotoUrl } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

/**
 * 올린 사진 보기: 사이트 주인·관리자인지 확인한 뒤 1시간짜리 저장소 주소로 넘겨준다.
 * 화면은 이 고정 주소(<img src>)만 쓰므로 저장소 주소가 만료돼도 다시 열면 새 주소를 받는다.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[id]/photos/[name]">) {
  const { id, name } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !isPhotoName(name)) return apiError(404, "NOT_FOUND", "사진을 찾을 수 없습니다.");
  const user = await getSessionUser();
  if (!user) return apiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (!data) return apiError(404, "NOT_FOUND", "사진을 찾을 수 없습니다.");

  const url = await signedPhotoUrl(id, name);
  if (!url) return apiError(404, "NOT_FOUND", "사진을 찾을 수 없습니다.");
  const res = NextResponse.redirect(url, 302);
  // 저장소 주소는 1시간 유효 — 그보다 짧게만 기억해 두게 한다
  res.headers.set("Cache-Control", "private, max-age=1800");
  return res;
}
