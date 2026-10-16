import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReleaseWorkflow } from "@/components/admin/release-workflow";
import { ProjectStatusControl } from "@/components/admin/quick-actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVICE_LABEL, getPlan, type DeviceKind } from "@/config/plans";
import { RELEASE_STAGE_ADMIN, isActiveRelease, releaseRemaining, releaseStage } from "@/config/releases";
import { getSubscription } from "@/lib/auth/session";
import { getAdminRelease } from "@/lib/releases";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "웹사이트 적용" };
export const dynamic = "force-dynamic";

const DEVICE_ORDER: DeviceKind[] = ["mobile", "tablet", "desktop"];

/** 웹사이트 적용 한 건: ① 개발 서버 배포 → ② 개발 서버 확인 → ③ 운영 배포 */
export default async function AdminReleasePage({ params }: PageProps<"/admin/releases/[id]">) {
  const { id } = await params;
  const data = await getAdminRelease(id);
  if (!data) notFound();
  const { release, project, ownerEmail, pages, items, waitingOutside, history } = data;
  const stage = releaseStage(release);
  const st = RELEASE_STAGE_ADMIN[stage];
  const due = isActiveRelease(release.status) ? releaseRemaining(release.requested_at) : null;

  // 화면 확인 대상: 소유자 플랜의 화면 (플랜이 없으면 캡처가 있는 화면)
  const owner = await getSubscription(project.user_id);
  const plan = owner.plan ?? getPlan(owner.subscription?.plan_code);
  const devices = plan ? plan.devices : DEVICE_ORDER.filter((d) => pages.some((p) => p.screenshots[d]));
  const screensLabel = DEVICE_ORDER.filter((d) => devices.includes(d)).map((d) => DEVICE_LABEL[d]).join(" · ") || "모든";

  // 주소 칸 미리 채우기: 이 사이트의 지난 적용에서 쓴 주소 (최신 것)
  const others = history.filter((h) => h.id !== release.id);
  const lastStaging = others.find((h) => h.staging_url)?.staging_url ?? "";
  const lastLive = history.find((h) => h.status === "live" && h.production_url);
  const pageOf = new Map(pages.map((p) => [p.id, p]));
  const ordered = items.slice().sort((a, b) => (a.resolved_at ?? a.created_at).localeCompare(b.resolved_at ?? b.created_at) || a.seq - b.seq);

  return (
    <div>
      <Link href="/admin/releases" className="text-sm text-ink-500 hover:text-ink-900">
        ← 웹사이트 적용 목록
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {project.name} · {release.seq}번째 웹사이트 적용
        </h1>
        <Badge tone={st.tone}>{st.label}</Badge>
        {release.first_publish ? <Badge tone="blue">첫 공개</Badge> : null}
        {due ? <span className={cn("text-xs", due.late ? "font-semibold text-mark" : "text-ink-500")}>{due.text}</span> : null}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        요청 {formatDateTime(release.requested_at)} · 요청자 {ownerEmail ?? project.user_id} · 실린 수정 {items.length}건
        {release.status === "cancelled" ? ` · ${formatDateTime(release.cancelled_at ?? release.updated_at)} 취소${release.cancel_note ? ` (${release.cancel_note})` : ""}` : ""}
      </p>
      {release.note ? (
        <p className="mt-3 rounded border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm whitespace-pre-wrap text-brand-800">
          <span className="font-medium">사용자가 남긴 말</span> · {release.note}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ReleaseWorkflow
          release={release}
          items={ordered.map((r) => {
            const page = pageOf.get(r.page_id);
            return {
              id: r.id,
              seq: r.seq,
              pageName: page?.name ?? "페이지",
              pagePath: page?.path ?? "",
              device: r.device,
              kind: r.kind,
              message: r.message,
              shot: page?.screenshots[r.device] ?? null,
              region: r.region,
            };
          })}
          defaults={{ stagingUrl: lastStaging, productionUrl: lastLive?.production_url ?? "" }}
          pageCount={pages.length}
          screensLabel={screensLabel}
          waitingOutside={waitingOutside}
        />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>사이트</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink-500">제작 상태</span>
                <ProjectStatusControl projectId={project.id} status={project.status} />
              </div>
              <div>
                <p className="text-xs text-ink-500">지금 운영 주소</p>
                {lastLive?.production_url ? (
                  <a href={lastLive.production_url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 hover:underline">
                    {lastLive.production_url}
                  </a>
                ) : (
                  <p>아직 공개 전</p>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                <Link href={`/admin/projects/${project.id}`} className="text-brand-600 hover:underline">
                  제작 정보
                </Link>
                <Link href={`/admin?project=${project.id}&status=all`} className="text-brand-600 hover:underline">
                  이 사이트의 요청
                </Link>
                <Link href={`/admin/messages/${project.id}`} className="text-brand-600 hover:underline">
                  사이트 메시지
                </Link>
              </div>
            </CardBody>
          </Card>

          {others.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>이 사이트의 다른 적용</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {others.map((h) => {
                  const s = RELEASE_STAGE_ADMIN[releaseStage(h)];
                  return (
                    <li key={h.id}>
                      <Link href={`/admin/releases/${h.id}`} className="flex flex-wrap items-center gap-2 px-5 py-2.5 text-sm hover:bg-ink-50">
                        <span>{h.seq}번째</span>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        <span className="text-xs text-ink-500">{formatDateTime(h.live_at ?? h.cancelled_at ?? h.requested_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
      <AutoRefresh seconds={60} />
    </div>
  );
}
