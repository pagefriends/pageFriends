import Link from "next/link";
import { notFound } from "next/navigation";

import { AiBrief } from "@/components/admin/ai-brief";
import { SiteDbPanel } from "@/components/admin/site-db-panel";
import { BriefDetails } from "@/components/brief/brief-details";
import { slotStatuses } from "@/components/editor/types";
import { ProjectStatusControl } from "@/components/admin/quick-actions";
import { Badge } from "@/components/ui/card";
import { getAdminProject } from "@/lib/admin";
import { aiReadiness, reapStaleRuns } from "@/lib/ai/engine";
import { listAiRuns } from "@/lib/ai/runs";
import { designOf } from "@/lib/design-doc";
import { getSiteDatabase, siteDbConfigured, type SiteDbInfo } from "@/lib/site-db/provision";
import { createClient } from "@/lib/supabase/server";
import { listProjectPhotos, type SitePhoto } from "@/lib/photos";
import { listProjectReleases } from "@/lib/releases";
import { dueLabel, remainingLabel } from "@/config/requests";
import { RELEASE_STAGE_ADMIN, releaseStage } from "@/config/releases";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 제작 정보: 사용자가 위저드에 적은 내용 전체. 제작 담당자가 사이트를 만들 때 기준으로 본다 */
export default async function AdminProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  const data = await getAdminProject(id);
  if (!data) notFound();
  const { project, ownerEmail, pages, openRequests, requests } = data;
  // 멈춘 AI 처리를 먼저 정리하고(담당자에게 넘김) 지시서 · 실행 기록을 읽는다
  await reapStaleRuns().catch(() => 0);
  const [photos, rel, runs, readiness, template, siteDb] = await Promise.all([
    project.brief.site ? listProjectPhotos(project.id) : Promise.resolve<Record<string, SitePhoto[]>>({}),
    listProjectReleases(project.id),
    listAiRuns({ projectId: project.id }),
    aiReadiness(),
    projectTemplate(project.template_id),
    getSiteDatabase(project.id).catch((e): SiteDbInfo | null => {
      console.error("[admin] site db", e);
      return null;
    }),
  ]);

  return (
    <div>
      <Link href={`/admin?project=${project.id}&status=all`} className="text-sm text-ink-500 hover:text-ink-900">
        ← 이 사이트의 요청
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.name} · 제작 정보</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
        <span>요청자 {ownerEmail ?? project.user_id}</span>
        <span>만든 시각 {formatDateTime(project.created_at)}</span>
        {project.brief.site ? (
          <span className={project.brief.site.builder === "expert" ? "font-medium text-sky-600" : undefined}>
            {project.brief.site.builder === "expert"
              ? `전문가 제작 · 첫 완성본 ${dueLabel(project.created_at)}${project.status === "building" || project.status === "brief" ? ` (${remainingLabel(project.created_at).text.replace("답변 기한 ", "")})` : ""}`
              : "AI 제작 (바로)"}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-2">
          프로젝트 상태 <ProjectStatusControl projectId={project.id} status={project.status} />
        </span>
        <Link href={`/admin?project=${project.id}&status=all`} className="font-medium text-brand-600 hover:underline">
          수정 요청 (진행 중 {openRequests}건)
        </Link>
        <Link href={`/admin/messages/${project.id}`} className="font-medium text-brand-600 hover:underline">
          사이트 메시지
        </Link>
      </div>
      {rel.available ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm">
          <span className="font-semibold">웹사이트</span>
          {rel.lastLive?.production_url ? (
            <a href={rel.lastLive.production_url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 hover:underline">
              {rel.lastLive.production_url}
            </a>
          ) : (
            <span className="text-ink-500">아직 공개 전</span>
          )}
          {rel.active ? (
            <Link href={`/admin/releases/${rel.active.id}`} className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:underline">
              {rel.active.seq}번째 적용 <Badge tone={RELEASE_STAGE_ADMIN[releaseStage(rel.active)].tone}>{RELEASE_STAGE_ADMIN[releaseStage(rel.active)].label}</Badge>
            </Link>
          ) : null}
          <span className="text-ink-500">적용 대기 수정 {rel.waiting}건</span>
          {rel.releases.length > 0 ? (
            <Link href={`/admin/releases?project=${project.id}&tab=all`} className="text-xs text-ink-500 underline hover:text-ink-900">
              적용 기록 {rel.releases.length}건
            </Link>
          ) : null}
        </div>
      ) : null}
      {project.brief.site && siteDb ? (
        <div className="mt-4">
          <SiteDbPanel projectId={project.id} info={{ ...siteDb, missing: siteDbConfigured().missing }} collections={designOf(project.brief).collections ?? []} />
        </div>
      ) : null}
      <div className="mt-6">
        <AiBrief projectId={project.id} brief={project.brief} template={template} runs={runs} readiness={readiness} />
      </div>
      <div className="mt-6">
        <BriefDetails
          brief={project.brief}
          pages={pages}
          slotStatus={project.brief.site ? slotStatuses(pages, requests) : undefined}
          projectId={project.brief.site ? project.id : undefined}
          photos={Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, v.map((p) => ({ name: p.name, url: p.url }))]))}
        />
      </div>
    </div>
  );
}

/** 시작 템플릿 (지시서의 템플릿 스킬) */
async function projectTemplate(templateId: string | null): Promise<{ slug: string; name: string } | null> {
  if (!templateId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("templates").select("slug, name").eq("id", templateId).maybeSingle();
  return (data as { slug: string; name: string } | null) ?? null;
}
