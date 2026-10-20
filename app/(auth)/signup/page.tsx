import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";
import { PLAN_BY_CODE, type PlanCode } from "@/config/plans";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const plan = typeof sp.plan === "string" && sp.plan in PLAN_BY_CODE ? (sp.plan as PlanCode) : undefined;
  const cycle = sp.cycle === "year" ? "year" : undefined;
  return <AuthForm mode="signup" next={next} plan={plan} cycle={cycle} />;
}
