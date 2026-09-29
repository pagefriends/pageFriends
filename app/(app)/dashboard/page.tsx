import type { Metadata } from "next";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { DELIVERY_DAYS, PLAN_BY_CODE } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/lib/types/db";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "내 사이트" };

const STATUS: Record<ProjectStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" }> = {
  brief: { label: "정보 입력 중", tone: "gray" },
  building: { label: "제작 중", tone: "blue" },
  review: { label: "수정 반영 중", tone: "sky" },
  live: { label: "운영 중", tone: "dark" },
};

/** 대시보드. 사이트(프로젝트) 목록과 플랜별 사이트 수 한도(스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10). */
export default async function DashboardPage() {
  const user = await requireUser();
  const [{ plan }, projects] = await Promise.all([getSubscription(user.id), listProjects(user.id)]);
  const effective = plan ?? PLAN_BY_CODE.starter;
  const max = effective.maxSites;
  const full = max !== null && projects.length >= max;
  // 목록은 최신순이지만 A·B·C 라벨은 만든 순서로 고정한다 (새 사이트가 생겨도 기존 라벨이 바뀌지 않게)
  const letterOf = new Map(
    [...projects].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p, i) => [p.id, String.fromCharCode(65 + (i % 26))]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 사이트</h1>
          <p className="mt-1 text-sm text-ink-500">
            제작 중인 사이트는 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 첫 완성본이 올라옵니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-ink-500">
            사이트 <span className="font-semibold text-ink-900">{projects.length}</span> / {max ?? "∞"}
            <span className="ml-1 text-xs">({effective.name})</span>
          </span>
          {full ? (
            <Link href="/billing" className={buttonClass("outline", "md")} title={`${effective.name} 플랜은 사이트 ${max}개까지`}>
              플랜 올리고 더 만들기
            </Link>
          ) : (
            <Link href="/projects/new" className={buttonClass("primary", "md")}>
              <PlusIcon className="size-4" /> 새 사이트
            </Link>
          )}
        </div>
      </div>

      {!plan ? (
        <Alert tone="blue" className="mt-6 flex items-center justify-between gap-4">
          <span>아직 플랜이 없습니다. 플랜을 선택해야 수정 요청을 보낼 수 있습니다.</span>
          <Link href="/billing" className="shrink-0 font-medium underline">
            플랜 선택
          </Link>
        </Alert>
      ) : null}
      {full ? (
        <Alert tone="gray" className="mt-6">
          {effective.name} 플랜은 사이트를 {max}개까지 만들 수 있습니다. 더 만들려면 상위 플랜으로 올려주세요 (비즈니스 2개 · 프로 5개 · 엔터프라이즈 10개).
        </Alert>
      ) : null}

      {projects.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-10 text-center">
          <p className="font-medium">첫 사이트를 만들어 보세요</p>
          <p className="mt-1 text-sm text-ink-500">템플릿을 고르거나, 프롬프트만으로 시작할 수 있습니다.</p>
          <Link href="/projects/new" className={buttonClass("primary", "md", "mt-4")}>
            새 사이트 만들기
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const s = STATUS[p.status];
            return (
              <li key={p.id} className="rounded-md border border-ink-200 bg-surface p-5 transition-colors hover:border-brand-400">
                <Link href={`/projects/${p.id}`} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 font-semibold">
                      <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-ink-900 text-[11px] font-bold text-ink-50">{letterOf.get(p.id)}</span>
                      <span className="truncate">{p.name}</span>
                    </p>
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
          {/* 남은 슬롯: 플랜에서 더 만들 수 있는 사이트 수를 눈에 보이게 */}
          {max !== null && projects.length < max
            ? Array.from({ length: max - projects.length }).map((_, i) => (
                <li key={`empty-${i}`}>
                  <Link
                    href="/projects/new"
                    className={cn("flex h-full min-h-36 items-center justify-center rounded-md border border-dashed border-ink-300 text-sm text-ink-400 hover:border-brand-400 hover:text-brand-600")}
                  >
                    <PlusIcon className="mr-1 size-4" /> 사이트 {String.fromCharCode(65 + projects.length + i)} 추가
                  </Link>
                </li>
              ))
            : null}
        </ul>
      )}
    </div>
  );
}
