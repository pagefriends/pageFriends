import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectStatusSelect } from "@/components/admin/quick-actions";
import { RegionPreview } from "@/components/admin/region-preview";
import { RequestForm } from "@/components/admin/request-form";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL } from "@/config/plans";
import { getAdminRequest } from "@/lib/admin";
import type { RequestStatus } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<RequestStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" | "red" }> = {
  pending: { label: "접수", tone: "blue" },
  processing: { label: "처리중", tone: "sky" },
  done: { label: "반영 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

export default async function AdminRequestDetailPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  const data = await getAdminRequest(id);
  if (!data) notFound();
  const { request, project, page, ownerEmail, siblings } = data;
  const shot = page.screenshots[request.device];
  const brief = project.brief;

  return (
    <div>
      <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-900">
        ← 요청 목록
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {project.name} · {page.name} · {request.seq}번 네모
        </h1>
        <Badge tone={STATUS[request.status].tone}>{STATUS[request.status].label}</Badge>
        <Badge tone={request.kind === "expert" ? "sky" : "gray"}>{REQUEST_KIND_LABEL[request.kind]}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {DEVICE_LABEL[request.device]} 화면 · {page.path} · {formatDateTime(request.created_at)} · 요청자 {ownerEmail ?? project.user_id}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>요청 영역</CardTitle>
            </CardHeader>
            <CardBody>
              {shot ? (
                <RegionPreview shot={shot} region={request.region} seq={request.seq} />
              ) : (
                <p className="text-sm text-ink-500">이 화면의 캡처가 없습니다.</p>
              )}
              <p className="mt-3 text-xs text-ink-400">
                영역 x {Math.round(request.region.x * 100)}% · y {Math.round(request.region.y * 100)}% · 폭 {Math.round(request.region.w * 100)}% · 높이{" "}
                {Math.round(request.region.h * 100)}%
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>요청사항</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.message}</p>
            </CardBody>
          </Card>

          {siblings.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>같은 묶음의 다른 요청 ({siblings.length})</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/requests/${s.id}`} className="flex gap-3 px-5 py-3 hover:bg-ink-50">
                      <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{s.seq}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex gap-2 text-xs text-ink-500">
                          <span>{DEVICE_LABEL[s.device]}</span>
                          <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm">{s.message}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>상태 변경 · 답변</CardTitle>
            </CardHeader>
            <CardBody>
              <RequestForm requestId={request.id} status={request.status} note={request.resolution_note} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>프로젝트 정보</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">프로젝트 상태</span>
                <ProjectStatusSelect projectId={project.id} status={project.status} />
              </div>
              <Row k="업종" v={brief.industry} />
              <Row k="목적" v={brief.purpose} />
              <Row k="디자인 톤" v={brief.tone?.join(", ")} />
              <Row k="메인 색상" v={brief.primaryColor} />
              <Row k="페이지" v={brief.pages?.join(" · ")} />
              <Row k="기능" v={brief.features?.join(", ")} />
              {brief.prompt ? <Row k="프롬프트" v={brief.prompt} /> : null}
              <Link href={`/admin?project=${project.id}&status=all`} className="text-xs font-medium text-brand-600 hover:underline">
                이 프로젝트의 모든 요청 보기
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div>
      <p className="text-xs text-ink-500">{k}</p>
      <p className="mt-0.5 whitespace-pre-wrap">{v}</p>
    </div>
  );
}
