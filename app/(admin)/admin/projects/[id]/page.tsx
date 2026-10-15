import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefDetails } from "@/components/brief/brief-details";
import { slotStatuses } from "@/components/editor/types";
import { ProjectStatusSelect } from "@/components/admin/quick-actions";
import { getAdminProject } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 제작 정보: 사용자가 위저드에 적은 내용 전체. 제작 담당자가 사이트를 만들 때 기준으로 본다 */
export default async function AdminProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  const { id } = await params;
  const data = await getAdminProject(id);
  if (!data) notFound();
  const { project, ownerEmail, pages, openRequests, requests } = data;

  return (
    <div>
      <Link href={`/admin?project=${project.id}&status=all`} className="text-sm text-ink-500 hover:text-ink-900">
        ← 이 사이트의 요청
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.name} · 제작 정보</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
        <span>요청자 {ownerEmail ?? project.user_id}</span>
        <span>만든 시각 {formatDateTime(project.created_at)}</span>
        <span className="inline-flex items-center gap-2">
          프로젝트 상태 <ProjectStatusSelect projectId={project.id} status={project.status} />
        </span>
        <Link href={`/admin?project=${project.id}&status=all`} className="font-medium text-brand-600 hover:underline">
          수정 요청 (진행 중 {openRequests}건)
        </Link>
        <Link href={`/admin/messages/${project.id}`} className="font-medium text-brand-600 hover:underline">
          사이트 메시지
        </Link>
      </div>
      <div className="mt-6">
        <BriefDetails brief={project.brief} pages={pages} slotStatus={project.brief.site ? slotStatuses(pages, requests) : undefined} />
      </div>
    </div>
  );
}
