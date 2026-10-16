import { ClockIcon, ExternalLinkIcon, GlobeIcon, MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/messages/auto-refresh";
import { ApplyRequestForm, CancelReleaseButton } from "@/components/releases/apply-request";
import { ReleaseItemList, UserReleaseSteps } from "@/components/releases/release-parts";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { isOpenStatus } from "@/config/requests";
import { RELEASE_PROMISE, RELEASE_STAGE_USER, releaseDueLabel, releaseStage } from "@/config/releases";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { getProject, listProjectRequests } from "@/lib/projects";
import { listProjectReleases } from "@/lib/releases";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "웹사이트 적용" };
export const dynamic = "force-dynamic";

/**
 * 웹사이트 적용. 편집 화면에서 요청한 수정은 끝나도 바로 실제 웹사이트에 나가지 않는다 — 여기서 "웹사이트에 적용 요청" 을 누르면
 * 담당자가 확인용(개발) 서버에 먼저 올려 점검하고, 문제가 없을 때 실제 웹사이트(운영)에 올린다.
 * 사용자에게는 "배포" 라는 말 대신 "적용" 을 쓰고 단계도 셋만 보여 준다 (적용 요청 → 점검 중 → 적용 완료).
 */
export default async function ApplyPage({ params }: PageProps<"/projects/[id]/apply">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}/apply`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const { project, pages } = data;
  const [requests, rel, { plan }] = await Promise.all([listProjectRequests(id), listProjectReleases(id), getSubscription(user.id)]);

  // 끝났지만 아직 실제 웹사이트에 올라가지 않은 수정 (끝난 순서대로)
  const byResolved = (a: { resolved_at: string | null; created_at: string }, b: typeof a) => (a.resolved_at ?? a.created_at).localeCompare(b.resolved_at ?? b.created_at);
  const waiting = requests.filter((r) => r.status === "done" && !r.release_id).sort(byResolved);
  const open = requests.filter((r) => isOpenStatus(r.status)).length;
  const itemsOf = (releaseId: string) => requests.filter((r) => r.release_id === releaseId).sort(byResolved);
  const ready = project.status === "live" || project.status === "review";
  const firstPublish = !rel.lastLive;
  const active = rel.active;
  const past = rel.releases.filter((r) => r.status === "live" || r.status === "cancelled");

  const disabledReason = !ready
    ? "사이트 제작이 끝나면(담당자가 '제작 완료' 를 누르면) 웹사이트에 적용할 수 있어요."
    : !plan
      ? "플랜이 있어야 웹사이트에 적용할 수 있어요."
      : !firstPublish && waiting.length === 0
        ? "지금 적용할 수정이 없어요. 수정 요청이 끝나면 여기에서 적용을 요청하세요."
        : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← 편집 화면
        </Link>
        <div className="flex items-center gap-4 text-sm text-ink-500">
          <Link href={`/projects/${id}/requests`} className="inline-flex items-center gap-1 hover:text-ink-900">
            <ClockIcon className="size-3.5" /> 요청 내역
          </Link>
          <Link href={`/projects/${id}/messages`} className="inline-flex items-center gap-1 hover:text-ink-900">
            <MessageSquareIcon className="size-3.5" /> 메시지
          </Link>
        </div>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.name} · 웹사이트 적용</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-500">
        편집 화면에서 요청한 수정은 끝나도 바로 실제 웹사이트에 나가지 않아요. 수정이 다 끝나면 &lsquo;웹사이트에 적용 요청&rsquo; 을 눌러 주세요.
        담당자가 확인용 서버에 먼저 올려 잘 동작하는지 점검하고, 문제가 없을 때 실제 웹사이트에 적용해 드려요.
      </p>

      {!rel.available ? (
        <Alert tone="gray" className="mt-6">
          웹사이트 적용 기능을 준비하고 있어요. 그동안 적용이 필요하면{" "}
          <Link href={`/projects/${id}/messages`} className="font-medium underline">
            담당자에게 메시지
          </Link>
          로 알려 주세요.
        </Alert>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-3">
              <GlobeIcon className="size-5 shrink-0 text-ink-500" />
              {rel.lastLive?.production_url ? (
                <>
                  <span className="text-sm text-ink-500">내 웹사이트</span>
                  <a href={rel.lastLive.production_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold break-all text-brand-600 hover:underline">
                    {rel.lastLive.production_url} <ExternalLinkIcon className="size-3.5 shrink-0" />
                  </a>
                  <span className="text-xs text-ink-500">마지막 적용 {formatDateTime(rel.lastLive.live_at ?? rel.lastLive.updated_at)}</span>
                </>
              ) : (
                <span className="text-sm text-ink-700">아직 실제 웹사이트에 공개되지 않았어요. 처음 적용하면 사이트 전체가 웹사이트로 공개돼요.</span>
              )}
            </CardBody>
          </Card>

          {active ? (
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  {active.first_publish ? "웹사이트 공개" : `${active.seq}번째 적용`} 진행 중
                </CardTitle>
                <Badge tone={RELEASE_STAGE_USER[releaseStage(active)].tone}>{RELEASE_STAGE_USER[releaseStage(active)].label}</Badge>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                <UserReleaseSteps release={active} />
                <p className="text-sm text-ink-700">
                  {releaseStage(active) === "new"
                    ? `요청을 받았어요. 담당자가 ${releaseDueLabel(active.requested_at)} 확인용 서버에서 점검한 뒤 실제 웹사이트에 적용해 드려요.`
                    : "담당자가 확인용 서버에 먼저 올려 점검하고 있어요. 문제가 없으면 실제 웹사이트에 적용하고 메시지로 알려 드려요."}
                </p>
                {active.note ? (
                  <p className="rounded border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] whitespace-pre-wrap text-ink-700">
                    <span className="font-medium">남긴 말</span> · {active.note}
                  </p>
                ) : null}
                <div>
                  <p className="mb-2 text-xs font-semibold text-ink-500">이번에 올라가는 수정 {itemsOf(active.id).length}건</p>
                  <ReleaseItemList
                    items={itemsOf(active.id)}
                    pages={pages}
                    empty={active.first_publish ? "사이트 전체를 처음 공개해요." : "실린 수정이 없어요."}
                  />
                </div>
                {waiting.length > 0 ? (
                  <p className="text-xs text-ink-500">
                    {/* 담당자가 확인용 서버에 (다시) 올리면 그 사이 끝난 수정도 같이 실린다 (0007 admin_release_staging) */}
                    {active.status === "requested"
                      ? `그 뒤에 끝난 수정 ${waiting.length}건도 담당자가 확인용 서버에 올릴 때 이번 적용에 함께 실려요.`
                      : `그 뒤에 끝난 수정 ${waiting.length}건은 이번 적용이 끝나면 다음 적용 때 올릴 수 있어요.`}
                  </p>
                ) : null}
                {releaseStage(active) === "new" ? (
                  <div>
                    <CancelReleaseButton projectId={id} releaseId={active.id} />
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{firstPublish ? "웹사이트 공개 요청" : "적용할 수정"}</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-4">
                <p className="text-sm text-ink-700">
                  {firstPublish
                    ? waiting.length > 0
                      ? `처음 적용하면 지금 사이트 전체가 실제 웹사이트로 공개돼요. 그동안 끝난 수정 ${waiting.length}건도 함께 올라가요.`
                      : "처음 적용하면 지금 사이트 전체가 실제 웹사이트로 공개돼요."
                    : waiting.length > 0
                      ? `끝났지만 아직 실제 웹사이트에 올라가지 않은 수정이 ${waiting.length}건 있어요.`
                      : "지금은 적용할 수정이 없어요."}
                </p>
                <ReleaseItemList items={waiting} pages={pages} />
                {open > 0 && ready ? (
                  <Alert tone="gray" className="text-[13px]">
                    아직 진행 중인 수정이 {open}건 있어요. 지금 적용하면 끝난 수정만 올라가고, 나머지는 끝난 뒤 다음 적용 때 올릴 수 있어요.
                  </Alert>
                ) : null}
                <ApplyRequestForm projectId={id} label="웹사이트에 적용 요청" disabledReason={disabledReason} />
                <p className="text-xs text-ink-500">{RELEASE_PROMISE}</p>
              </CardBody>
            </Card>
          )}

          {past.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>적용 기록</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {past.map((r) => {
                  const s = RELEASE_STAGE_USER[releaseStage(r)];
                  const n = itemsOf(r.id).length;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                      <span className="font-medium">{r.seq}번째 적용</span>
                      {r.first_publish ? <Badge tone="blue">첫 공개</Badge> : null}
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="text-xs text-ink-500">
                        {r.status === "live" ? `${formatDateTime(r.live_at ?? r.updated_at)} 적용` : `${formatDateTime(r.cancelled_at ?? r.updated_at)} 취소`}
                        {n > 0 ? ` · 수정 ${n}건` : ""}
                      </span>
                      {r.status === "cancelled" && r.cancel_note ? <span className="text-xs text-ink-500">({r.cancel_note})</span> : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
      <AutoRefresh seconds={45} />
    </div>
  );
}
