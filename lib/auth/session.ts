import "server-only";

import { redirect } from "next/navigation";

import { getPlan, type Plan, type PlanCode } from "@/config/plans";
import { effectiveSubscription, type SubscriptionState } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionRow } from "@/lib/types/db";

export type SessionUser = { id: string; email: string };

/**
 * 서버에서 현재 사용자를 확인한다. getUser 는 Auth 서버에 토큰을 검증하므로 쿠키 위조에 안전하다.
 * (getSession 은 검증 없이 JWT 를 파싱하므로 보호 판단에 쓰지 않는다.)
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** 관리자 여부 (profiles.role). 운영자·전문가 화면 접근 판단에 쓴다. */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

/** 관리자가 아니면 대시보드로 보낸다. 실제 데이터 보호는 RLS + admin_* RPC 가 하므로 이건 UX 용 1차 방어선이다. */
export async function requireAdmin(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!(await isAdmin(user.id))) redirect("/dashboard");
  return user;
}

export type SubscriptionInfo = {
  subscription: SubscriptionRow | null;
  /** 지금 사용 가능한 플랜. 만료·해지·유예 초과면 null */
  plan: Plan | null;
  state: SubscriptionState;
  graceUntil: Date | null;
};

/**
 * 구독 행 + 유효 상태 + 플랜 상수. 크론 없이 만료를 판정하므로 "DB status 가 active" 가 아니라
 * effectiveSubscription 의 usable 로 플랜 사용 가능 여부를 정한다.
 */
export async function getSubscription(userId: string): Promise<SubscriptionInfo> {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  const sub = (data as SubscriptionRow | null) ?? null;
  const eff = effectiveSubscription(sub);
  return { subscription: sub, plan: eff.usable ? getPlan(sub?.plan_code as PlanCode | undefined) : null, state: eff.state, graceUntil: eff.graceUntil };
}
