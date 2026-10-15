import type { Metadata } from "next";

import Link from "next/link";

import { ProjectWizard } from "@/components/wizard/project-wizard";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { PLAN_BY_CODE } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { countProjects } from "@/lib/projects";
import { getQuota } from "@/lib/quota";
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
  // AI 이미지 생성 예상치를 비교할 남은 토큰 (한도 + 크레딧). 플랜이 없으면 0 — 이미지 생성은 플랜이 있어야 한다
  const quota = plan ? await getQuota(user.id, plan) : null;
  const tokenBudget = quota ? (quota.ai.remaining === null ? null : quota.ai.remaining + quota.ai.credits) : 0;

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
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">새 사이트 만들기</h1>
      <p className="mt-1 text-sm text-ink-500">
        회사와 서비스를 알려 주시면 메뉴 · 페이지 구성부터 잡아 드려요. 10분 정도 걸려요. ({effective.name} 플랜 · 사이트 {count}/{effective.maxSites ?? "제한 없음"} · 홈 포함 최대{" "}
        {effective.pageRange?.max ?? 30}페이지)
      </p>
      <div className="mt-6">
        <ProjectWizard
          purchasedTemplates={purchased}
          preselectSlug={preselectSlug}
          planName={effective.name}
          hasPlan={Boolean(plan)}
          maxPages={effective.pageRange?.max ?? 30}
          paymentAllowed={effective.paymentSystem !== "none"}
          tokenBudget={tokenBudget}
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
