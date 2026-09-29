"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getClientEnv } from "@/lib/env";

/** 브라우저용 Supabase 클라이언트. anon 키만 쓰며 데이터 보호는 RLS 가 맡는다. 내부적으로 싱글턴. */
export function createClient() {
  const env = getClientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
