import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getClientEnv } from "@/lib/env";

/** 비로그인으로 열 수 있는 경로. 접두어 매칭. 웹훅은 포트원 서버가 호출하므로 세션이 없다(서명 검증은 라우트가 한다). */
export const PUBLIC_PATHS = ["/", "/templates", "/pricing", "/demo", "/login", "/signup", "/auth", "/api/webhooks", "/samples"] as const;
const AUTH_ONLY_PATHS = ["/login", "/signup"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
}

/**
 * Supabase 공식 updateSession 패턴. 만료된 토큰을 갱신해 요청·응답 양쪽 쿠키에 싣고, 보호 경로는 /login 으로 보낸다.
 * getSession 은 JWT 를 검증하지 않으므로 getClaims 를 쓴다. createServerClient 와 getClaims 사이에 코드를 넣지 말 것.
 */
export async function updateSession(request: NextRequest) {
  const env = getClientEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;
  const { pathname, search } = request.nextUrl;

  if (!claims && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (claims && AUTH_ONLY_PATHS.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
