import "server-only";

import { isMissingSchema } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import type { AiRunRow } from "@/lib/ai/run-types";

export { RUN_STATUS, type AiRunRow } from "@/lib/ai/run-types";

/** 관리자 화면용 실행 기록 (RLS: 관리자만). 0008 적용 전이면 available=false */
export async function listAiRuns(filter: { projectId?: string; requestId?: string }, limit = 30): Promise<{ available: boolean; runs: AiRunRow[] }> {
  const supabase = await createClient();
  let q = supabase.from("ai_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.requestId) q = q.eq("request_id", filter.requestId);
  const { data, error } = await q;
  if (error) return { available: !isMissingSchema(error), runs: [] };
  return { available: true, runs: (data as AiRunRow[]) ?? [] };
}
