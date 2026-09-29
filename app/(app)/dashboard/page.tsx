import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { DELIVERY_DAYS } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/lib/types/db";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "내 프로젝트" };

const STATUS: Record<ProjectStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" }> = {
  brief: { label: "정보 입력 중", tone: "gray" },
  building: { label: "제작 중", tone: "blue" },
  review: { label: "수정 반영 중", tone: "sky" },
  live: { label: "운영 중", tone: "dark" },
};

export default async function DashboardPage() {
  const user = await requireUser();
  const [{ plan }, projects] = await Promise.all([getSubscription(user.id), listProjects(user.id)]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 프로젝트</h1>
          <p className="mt-1 text-sm text-ink-500">
            제작 중인 사이트는 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본이 올라옵니다.
          </p>
        </div>
        <Link href="/projects/new" className={buttonClass("primary", "md")}>
          <PlusIcon className="size-4" /> 새 프로젝트
        </Link>
      </div>

      {!plan ? (
        <Alert tone="blue" className="mt-6 flex items-center justify-between gap-4">
          <span>아직 플랜이 없습니다. 플랜을 선택해야 수정 요청을 보낼 수 있습니다.</span>
          <Link href="/billing" className="shrink-0 font-medium underline">
            플랜 선택
          </Link>
        </Alert>
      ) : null}

      {projects.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-10 text-center">
          <p className="font-medium">첫 프로젝트를 만들어 보세요</p>
          <p className="mt-1 text-sm text-ink-500">템플릿을 고르거나, 프롬프트만으로 시작할 수 있습니다.</p>
          <Link href="/projects/new" className={buttonClass("primary", "md", "mt-4")}>
            새 프로젝트 만들기
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.id} className="rounded-md border border-ink-200 bg-surface p-5 transition-colors hover:border-brand-400">
                <Link href={`/projects/${p.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{p.name}</p>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {p.brief.industry || "업종 미지정"} · {p.brief.pages?.length ?? 0}페이지
                  </p>
                  <p className="mt-3 line-clamp-2 text-[13px] text-ink-600">{p.brief.purpose || p.brief.prompt || "설명 없음"}</p>
                  <p className="mt-3 text-xs text-ink-400">만든 날 {formatDate(p.created_at)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
