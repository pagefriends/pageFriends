import { z } from "zod";

/**
 * 환경변수 파싱. 호출 시점에 검증(lazy) — `next build` 프리렌더 중에는 .env 가 없을 수 있어서 모듈 로드 시 파싱하면 죽는다.
 * 브라우저 번들에는 `process.env.NEXT_PUBLIC_X` 를 글자 그대로 참조한 값만 인라인된다 (동적 키 접근 불가).
 */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL 이 유효한 URL 이 아닙니다" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다"),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  // 포트원 V2 (PG: 토스페이먼츠). 서버 전용 키에는 NEXT_PUBLIC_ 을 붙이지 않는다.
  PORTONE_API_SECRET: optionalString,
  PORTONE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_PORTONE_STORE_ID: optionalString,
  NEXT_PUBLIC_PORTONE_CHANNEL_KEY: optionalString,
  /** 빌링키 암호화 키 (32자 이상). 없으면 정기결제 비활성 */
  APP_ENCRYPTION_KEY: optionalString,
  /** "true" 면 포트원을 호출하지 않고 결제를 성공 처리한다. 로컬 개발 전용 — 운영에서는 반드시 비운다. */
  PAYMENTS_MOCK: optionalString,

  APP_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:3000")),

  // AI (Claude API). 키가 없으면 AI 를 부르지 않고 담당자가 처리한다 (lib/ai/claude.ts aiConfigured). SDK 가 직접 읽는다
  ANTHROPIC_API_KEY: optionalString,
  /** 하루 전체 AI 비용 상한 (USD). 비우면 config/ai.ts 의 기본값 */
  AI_DAILY_BUDGET_USD: optionalString,
  /** "off" 면 키가 있어도 AI 를 부르지 않는다 */
  AI_ENGINE: optionalString,

  // 사이트마다 따로 만드는 Supabase 프로젝트 (lib/site-db). 관리 API 토큰이 없으면 만들지 않는다
  /** Supabase 관리 API 토큰 (대시보드 > Account > Access Tokens). 서버 전용 */
  SUPABASE_ACCESS_TOKEN: optionalString,
  /** 사이트 프로젝트를 만들 조직 slug. 비우면 앱 메인 프로젝트가 있는 조직 (못 찾으면 토큰이 볼 수 있는 첫 조직) */
  SUPABASE_SITES_ORG: optionalString,
  /** 사이트 프로젝트 지역. 비우면 서울(ap-northeast-2) */
  SUPABASE_SITES_REGION: optionalString,
  /** "off" 면 토큰이 있어도 사이트 프로젝트를 만들지 않는다 */
  SITE_DB: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    const r = serverEnvSchema.safeParse(process.env);
    if (!r.success) {
      const lines = r.error.issues.map((i) => `  - ${i.path.join(".") || "(전체)"}: ${i.message}`).join("\n");
      throw new Error(`환경변수가 올바르지 않습니다. .env.example 을 복사해 .env.local 을 만드세요.\n${lines}`);
    }
    cached = r.data;
  }
  return cached;
}

/** 브라우저/서버 공용 값. */
export function getClientEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다 (.env.local).");
  return {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    NEXT_PUBLIC_PORTONE_STORE_ID: process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "",
    NEXT_PUBLIC_PORTONE_CHANNEL_KEY: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "",
  };
}

export function isPaymentsMock(): boolean {
  const env = getServerEnv();
  return env.PAYMENTS_MOCK === "true" && env.NODE_ENV !== "production";
}

/** 실제 포트원 결제가 가능한 상태인지. mock 이면 항상 true. */
export function paymentsAvailable(): { enabled: boolean; mock: boolean; missing: string[] } {
  const env = getServerEnv();
  if (isPaymentsMock()) return { enabled: true, mock: true, missing: [] };
  const missing = (
    [
      ["PORTONE_API_SECRET", env.PORTONE_API_SECRET],
      ["NEXT_PUBLIC_PORTONE_STORE_ID", env.NEXT_PUBLIC_PORTONE_STORE_ID],
      ["NEXT_PUBLIC_PORTONE_CHANNEL_KEY", env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return { enabled: missing.length === 0, mock: false, missing };
}
