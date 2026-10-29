"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { SITE_DB_BUILD_WAIT_MS } from "@/config/site-db";
import { requireAdmin } from "@/lib/auth/session";
import { designOf } from "@/lib/design-doc";
import { ensureSiteDatabase, siteDbConfigured, syncSiteSchema } from "@/lib/site-db/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectBrief } from "@/lib/types/db";

export type SiteDbActionState = { ok: boolean; message: string } | null;

/**
 * 담당자: 사이트 전용 Supabase 프로젝트를 만들거나(없을 때) 다시 시도한다(실패했을 때). 플랜과 상관없이 만든다 — 매달 비용이 드니 필요한 사이트에만.
 * 몇 분 걸리므로 바로 돌려주고 뒤에서 기다린다.
 */
export async function startSiteDbAction(projectId: string): Promise<SiteDbActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(projectId).success) return { ok: false, message: "잘못된 요청입니다." };
  const cfg = siteDbConfigured();
  if (!cfg.ok) return { ok: false, message: `설정이 없습니다: ${cfg.missing.join(", ") || "SITE_DB=off"}` };
  after(() => ensureSiteDatabase(projectId, { waitMs: SITE_DB_BUILD_WAIT_MS }).then(() => undefined));
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, message: "만들고 있어요. 1~3분 뒤 새로 고쳐 보세요." };
}

/** 담당자: 디자인 문서의 관리자 목록에 맞게 사이트 DB 의 표 · 칸을 다시 맞춘다 (없는 것만 만든다) */
export async function syncSiteDbAction(projectId: string): Promise<SiteDbActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(projectId).success) return { ok: false, message: "잘못된 요청입니다." };
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("brief").eq("id", projectId).maybeSingle();
  if (!data) return { ok: false, message: "사이트를 찾을 수 없습니다." };
  const collections = designOf(data.brief as ProjectBrief).collections ?? [];
  if (!collections.length) return { ok: false, message: "관리자 목록이 없습니다." };
  const res = await syncSiteSchema(projectId, collections, { source: "admin" });
  revalidatePath(`/admin/projects/${projectId}`);
  return res.ok ? { ok: true, message: res.changed ? "표를 맞췄어요." : "이미 맞아요 (바꿀 것 없음)." } : { ok: false, message: res.reason };
}
