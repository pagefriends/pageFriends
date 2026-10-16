import type { Metadata } from "next";
import { ClockIcon, GlobeIcon, ImageIcon, MessageSquareIcon, PlusIcon, RocketIcon } from "lucide-react";
import Link from "next/link";

import { AutoRefresh } from "@/components/messages/auto-refresh";
import { CountChip } from "@/components/messages/count-chip";
import { NewsList } from "@/components/messages/news-list";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { EXPERT_HOURS, PLAN_BY_CODE } from "@/config/plans";
import { PROJECT_STATUS, dueLabel } from "@/config/requests";
import { APPLY_STATE, releaseStage } from "@/config/releases";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { NO_NEWS, getMessageSummary, listNews, newsCount } from "@/lib/messages";
import { listProjects } from "@/lib/projects";
import { listProjectPhotos } from "@/lib/photos";
import { NO_RELEASE, listReleaseSummaries } from "@/lib/releases";
import { realPhotoCount } from "@/lib/site-plan";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "내 사이트" };

/**
 * 대시보드. 사이트(프로젝트) 목록과 플랜별 사이트 수 한도(스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10),
 * 그리고 담당자와 주고받은 것 중 지금 확인할 내용(답을 기다리는 요청 · 새 답변 · 새 메시지).
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const [{ plan }, projects, summary] = await Promise.all([getSubscription(user.id), listProjects(user.id), getMessageSummary()]);
  const [news, releases] = await Promise.all([
    newsCount(summary.total) > 0 ? listNews(projects.map((p) => p.id)) : Promise.resolve([]),
    listReleaseSummaries(projects.map((p) => p.id)),
  ]);
  // 고객이 직접 준비할 사진 = 실제 사진이 필요한 자리 - 이미 올린 사진 (사이트마다 저장소 목록 한 번)
  const toPrepare = new Map(
    await Promise.all(
      projects
        .filter((p) => p.brief.site && realPhotoCount(p.brief.site.images) > 0)
        .map(async (p) => {
          const uploaded = await listProjectPhotos(p.id);
          const left = p.brief.site!.images.filter((s) => s.source === "real").reduce((n, s) => n + Math.max(0, s.count - (uploaded[s.id]?.length ?? 0)), 0);
          return [p.id, left] as const;
        }),
    ),
  );
  const effective = plan ?? PLAN_BY_CODE.starter;
  const max = effective.maxSites;
  const full = max !== null && projects.length >= max;
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));
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
            AI로 만들면 구성 초안이 바로 나오고, 전문가에게 맡기면 {EXPERT_HOURS.min}~{EXPERT_HOURS.max}시간 안에 첫 완성본이 올라옵니다.
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

      {news.length > 0 ? (
        <div className="mt-6">
          <NewsList items={news} projectName={nameOf} />
        </div>
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
            const s = PROJECT_STATUS[p.status];
            const n = summary.byProject.get(p.id) ?? NO_NEWS;
            const requestNews = n.unreadRequests + n.awaiting;
            // 실제 웹사이트: 공개 전 · 공개 중(적용 대기 수정) · 적용 진행 중
            const w = releases.byProject.get(p.id) ?? NO_RELEASE;
            const ready = p.status === "live" || p.status === "review";
            const website = !releases.available
              ? null
              : w.active
                ? { text: `웹사이트 ${APPLY_STATE[releaseStage(w.active) === "new" ? "requested" : "checking"].label}`, strong: true }
                : w.lastLive
                  ? { text: w.waiting > 0 ? `웹사이트 공개 중 · 적용 대기 수정 ${w.waiting}건` : "웹사이트 공개 중", strong: w.waiting > 0 }
                  : ready
                    ? { text: "웹사이트 공개 전 · 공개를 요청해 주세요", strong: true }
                    : null;
            return (
              <li key={p.id} className="flex flex-col rounded-md border border-ink-200 bg-surface transition-colors hover:border-brand-400">
                <Link href={`/projects/${p.id}`} className="block flex-1 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 font-semibold">
                      <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-ink-900 text-[11px] font-bold text-ink-50">{letterOf.get(p.id)}</span>
                      <span className="truncate">{p.name}</span>
                    </p>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {p.brief.industry || "업종 미지정"} · {p.brief.pages?.length ?? 0}페이지
                    {p.brief.site ? ` · ${p.brief.site.builder === "expert" ? "전문가 제작" : "AI 제작"}` : ""}
                  </p>
                  {p.brief.site?.builder === "expert" && (p.status === "building" || p.status === "brief") ? (
                    <p className="mt-1 text-xs font-medium text-sky-600">첫 완성본 {dueLabel(p.created_at)}</p>
                  ) : null}
                  {website ? (
                    <p className={cn("mt-1 flex items-center gap-1 text-xs", website.strong ? "font-medium text-sky-600" : "text-ink-500")}>
                      {w.active ? <RocketIcon className="size-3.5" /> : <GlobeIcon className="size-3.5" />} {website.text}
                    </p>
                  ) : null}
                  <p className="mt-3 line-clamp-2 text-[13px] text-ink-600">{p.brief.business?.tagline || p.brief.purpose || p.brief.prompt || "설명 없음"}</p>
                  {(toPrepare.get(p.id) ?? 0) > 0 ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-500" title="대표·직원·매장·작업물처럼 실제 사진이 필요한 자리 (제작 정보에서 목록 확인)">
                      <ImageIcon className="size-3.5" /> 준비할 사진 {toPrepare.get(p.id)}장
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-ink-400">만든 날 {formatDate(p.created_at)}</p>
                </Link>
                {summary.available || releases.available ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
                    {summary.available ? (
                      <>
                        <Link href={`/projects/${p.id}/requests`} className="inline-flex items-center gap-1 hover:text-ink-900">
                          <ClockIcon className="size-3.5" /> 요청 내역
                          {requestNews > 0 ? <CountChip strong={n.awaiting > 0}>{requestNews}</CountChip> : null}
                        </Link>
                        <Link href={`/projects/${p.id}/messages`} className="inline-flex items-center gap-1 hover:text-ink-900">
                          <MessageSquareIcon className="size-3.5" /> 메시지
                          {n.unreadGeneral > 0 ? <CountChip>{n.unreadGeneral}</CountChip> : null}
                        </Link>
                      </>
                    ) : null}
                    {releases.available ? (
                      <Link href={`/projects/${p.id}/apply`} className="inline-flex items-center gap-1 hover:text-ink-900" title="끝난 수정을 실제 웹사이트에 올려 달라고 요청해요">
                        <RocketIcon className="size-3.5" /> 웹사이트 적용
                        {!w.active && ready && w.waiting > 0 ? <CountChip strong>{w.waiting}</CountChip> : null}
                      </Link>
                    ) : null}
                    {n.awaiting > 0 ? <span className="ml-auto font-medium text-sky-600">확인 필요 {n.awaiting}건</span> : null}
                  </div>
                ) : null}
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
      {summary.available ? <AutoRefresh seconds={60} /> : null}
    </div>
  );
}
