import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TemplateRow } from "@/lib/types/db";

export type TemplateListResult = { templates: TemplateRow[]; error: string | null };

/** 공개 템플릿 목록. Supabase 설정이 없거나 테이블이 없으면 빈 목록 + 오류 메시지를 돌려 페이지가 죽지 않게 한다. */
export async function listTemplates(kind?: "demo" | "live"): Promise<TemplateListResult> {
  try {
    const supabase = await createClient();
    let q = supabase.from("templates").select("*").eq("is_published", true).order("kind", { ascending: true }).order("created_at", { ascending: true });
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return { templates: [], error: error.message };
    return { templates: (data as TemplateRow[]) ?? [], error: null };
  } catch (e) {
    return { templates: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getTemplateBySlug(slug: string): Promise<TemplateRow | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("templates").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
    return (data as TemplateRow | null) ?? null;
  } catch {
    return null;
  }
}

/** 로그인 사용자가 구매한 템플릿 id 목록 */
export async function listPurchasedTemplateIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("template_purchases").select("template_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.template_id as string));
}
