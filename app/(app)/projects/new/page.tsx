import type { Metadata } from "next";

import Link from "next/link";

import { ProjectWizard } from "@/components/wizard/project-wizard";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { PLAN_BY_CODE } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { countProjects } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";
import type { TemplateRow } from "@/lib/types/db";

export const metadata: Metadata = { title: "새 사이트" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const user = await requireUser("/projects/new");
  const sp = await searchParams;
  const preselectSlug = typeof sp.template === "string" ? sp.template : null;

  const [{ plan }, purchased, count] = await Promise.all([getSubscription(user.id), loadPurchasedTemplates(user.id), countProjects(user.id)]);
  const effective = plan ?? PLAN_BY_CODE.starter;
  const full = effective.maxSites !== null && count >= effective.maxSites;

  if (full) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">새 사이트</h1>
        <Alert tone="gray" className="mt-6">
          {effective.name} 플랜은 사이트를 {effective.maxSites}개까지 만들 수 있고, 지금 {count}개를 보유 중입니다. 더 만들려면 상위 플랜으로 올려주세요.
        </Alert>
        <div className="mt-4 flex gap-2">
          <Link href="/billing" className={buttonClass("primary", "md")}>
            플랜 올리기
          </Link>
          <Link href="/dashboard" className={buttonClass("outline", "md")}>
            내 사이트로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">새 사이트</h1>
      <p className="mt-1 text-sm text-ink-500">
        사이트를 만들기 위해 꼭 필요한 것만 묻습니다. 5분이면 충분합니다. ({effective.name} 플랜 · 사이트 {count}/{effective.maxSites ?? "제한 없음"})
      </p>
      <div className="mt-6">
        <ProjectWizard
          purchasedTemplates={purchased}
          preselectSlug={preselectSlug}
          planName={effective.name}
          hasPlan={Boolean(plan)}
          maxPages={effective.pageRange?.max ?? 30}
          paymentAllowed={effective.paymentSystem !== "none"}
        />
      </div>
    </div>
  );
}

async function loadPurchasedTemplates(userId: string): Promise<TemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("template_purchases").select("template:templates(*)").eq("user_id", userId);
  return ((data ?? []) as unknown as { template: TemplateRow | null }[]).map((r) => r.template).filter((t): t is TemplateRow => Boolean(t));
}
