import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env";

/**
 * 서비스 롤 클라이언트 (RLS 우회). 결제 확정·웹훅처럼 "사용자 세션이 없거나, 사용자가 직접 써서는 안 되는 테이블"에만 쓴다.
 * 절대 브라우저로 내보내지 않는다.
 */
export function createAdminClient(): SupabaseClient {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다. 결제 확정·웹훅 처리에 필요합니다 (.env.local).");
  }
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
