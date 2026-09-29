import type { Metadata } from "next";

import { ProjectWizard } from "@/components/wizard/project-wizard";
import { PLAN_BY_CODE } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { TemplateRow } from "@/lib/types/db";

export const metadata: Metadata = { title: "새 프로젝트" };

export default async function NewProjectPage({ searchParams }: PageProps<"/projects/new">) {
  const user = await requireUser("/projects/new");
  const sp = await searchParams;
  const preselectSlug = typeof sp.template === "string" ? sp.template : null;

  const [{ plan }, purchased] = await Promise.all([getSubscription(user.id), loadPurchasedTemplates(user.id)]);
  const effective = plan ?? PLAN_BY_CODE.starter;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">새 프로젝트</h1>
      <p className="mt-1 text-sm text-ink-500">사이트를 만들기 위해 꼭 필요한 것만 묻습니다. 5분이면 충분합니다.</p>
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
