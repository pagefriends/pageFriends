import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getClientEnv } from "@/lib/env";

/**
 * 서버 컴포넌트·Server Action·Route Handler 용 Supabase 클라이언트.
 * 요청마다 새로 만든다 — 세션은 쿠키에 있고 쿠키는 요청마다 다르므로 모듈 스코프 캐시는 사용자 세션이 섞인다.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getClientEnv();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts 가 요청 단계에서 처리한다.
        }
      },
    },
  });
}
