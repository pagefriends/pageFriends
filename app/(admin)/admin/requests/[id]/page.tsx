import Link from "next/link";
import { notFound } from "next/navigation";

import { markRequestCheckedAction, markUserMessagesReadAction } from "@/app/(admin)/admin/actions";
import { AiRerunButton, AiRunList } from "@/components/admin/ai-runs";
import { AutoCheck } from "@/components/admin/auto-check";
import { ProjectStatusControl } from "@/components/admin/quick-actions";
import { RegionPreview } from "@/components/admin/region-preview";
import { RequestForm } from "@/components/admin/request-form";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { MarkRead } from "@/components/messages/mark-read";
import { Thread } from "@/components/messages/thread";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, formatTokens, getPlan } from "@/config/plans";
import { REQUEST_KIND_TONE, dueLabel, isImageRequest, isOpenStatus, needsPerson, remainingLabel, requestStatus } from "@/config/requests";
import { APPLY_STATE, RELEASE_STAGE_ADMIN, applyState, releaseStage } from "@/config/releases";
import { STYLE_BY_ID, normalizeStyles } from "@/config/design-styles";
import { getAdminRequest } from "@/lib/admin";
import { aiConfigured } from "@/lib/ai/claude";
import { reapStaleRuns } from "@/lib/ai/engine";
import { listAiRuns } from "@/lib/ai/runs";
import { getSubscription } from "@/lib/auth/session";
import { listProjectReleases } from "@/lib/releases";
import { FEATURE_LABEL } from "@/lib/site-plan";
import { listTemplates } from "@/lib/templates";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminRequestDetailPage({ params }: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  const data = await getAdminRequest(id);
  if (!data) notFound();
  const { request, project, page, ownerEmail, siblings, thread } = data;
  const shot = page.screenshots[request.device];
  const brief = project.brief;
  // 요청 소유자의 플랜 (AI 토큰 한도 안내). 만료된 플랜이어도 코드가 있으면 이름은 보여준다.
  const owner = await getSubscription(project.user_id);
  const ownerPlan = owner.plan ?? getPlan(owner.subscription?.plan_code);
  const awaiting = Boolean(request.awaiting_user) && isOpenStatus(request.status);
  const st = requestStatus(request.kind, request.status);
  // 사람이 답하는 요청의 기한: 전문가 요청 72시간 · 오류 신고 24시간 (config/requests.ts dueHours)
  const due = needsPerson(request.kind) && isOpenStatus(request.status) ? remainingLabel(request.created_at, request.kind) : null;
  const builder = brief.site?.builder ?? null;
  const unreadIds = thread.messages.filter((m) => m.author_role === "user" && !m.read_at).map((m) => m.id);
  // 끝난 수정이면 실제 웹사이트에 올라갔는지 (적용 대기 · n번째 적용의 어느 단계)
  const rel = request.status === "done" ? await listProjectReleases(project.id) : null;
  const apply = rel?.available ? applyState(request, rel.byId) : null;
  const release = request.release_id ? rel?.byId.get(request.release_id) : undefined;
  // AI 반영 요청: 멈춘 처리를 정리하고 실행 기록을 읽는다
  if (request.kind === "ai" || request.kind === "bug") await reapStaleRuns().catch(() => 0);
  const runs = request.kind === "ai" || request.kind === "bug" ? await listAiRuns({ requestId: request.id }, 10) : null;
  const imageRequest = isImageRequest(request.message);
  const reqStyles = normalizeStyles(request.options?.styles ?? []);
  const refTemplateId = request.options?.templateId;
  const refTemplate = refTemplateId ? (await listTemplates()).templates.find((t) => t.id === refTemplateId) : undefined;

  return (
    <div>
      <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-900">
        ← 요청 목록
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {project.name} · {page.name} · {request.seq}번 네모
        </h1>
        <Badge tone={st.tone}>{st.label}</Badge>
        <Badge tone={REQUEST_KIND_TONE[request.kind]}>{REQUEST_KIND_LABEL[request.kind]}</Badge>
        {due ? <span className={due.late ? "text-xs font-semibold text-mark" : "text-xs text-ink-500"}>{due.text}</span> : null}
        {awaiting ? <Badge tone="sky">사용자 답 대기</Badge> : null}
        {request.kind === "bug" ? <span className="text-xs text-ink-500">무료 · 사용자 한도에서 차감하지 않음</span> : null}
        {request.kind === "ai" && request.tokens_used > 0 ? <span className="text-xs tabular-nums text-ink-500">사용 토큰 {formatTokens(request.tokens_used)}</span> : null}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {DEVICE_LABEL[request.device]} 화면 · {page.path} · {formatDateTime(request.created_at)} · 요청자 {ownerEmail ?? project.user_id}
      </p>
      {apply ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-500">웹사이트</span>
          <Badge tone={APPLY_STATE[apply].tone}>{APPLY_STATE[apply].label}</Badge>
          {release ? (
            <Link href={`/admin/releases/${release.id}`} className="text-xs font-medium text-brand-600 hover:underline">
              {release.seq}번째 적용 · {RELEASE_STAGE_ADMIN[releaseStage(release)].label} →
            </Link>
          ) : (
            <span className="text-xs text-ink-500">사용자가 &lsquo;웹사이트에 적용 요청&rsquo; 을 누르면 실제 웹사이트에 올라갑니다</span>
          )}
        </p>
      ) : null}

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

          <Card>
            <CardHeader>
              <CardTitle>대화</CardTitle>
            </CardHeader>
            <CardBody>
              {thread.available ? (
                thread.messages.length > 0 ? (
                  <Thread entries={thread.messages} viewer="admin" kind={request.kind} />
                ) : (
                  <p className="text-sm text-ink-500">아직 주고받은 글이 없습니다. 오른쪽에서 상태를 바꾸거나 글을 보내면 여기에 쌓입니다.</p>
                )
              ) : (
                <>
                  {request.resolution_note ? <p className="whitespace-pre-wrap text-sm">답변: {request.resolution_note}</p> : <p className="text-sm text-ink-500">아직 답변이 없습니다.</p>}
                  <Alert tone="gray" className="mt-3 text-xs">
                    사용자와 글을 주고받으려면 <code>supabase/migrations/0006_messages.sql</code> 을 적용하세요. 그 전에는 답변 한 줄만 저장됩니다.
                  </Alert>
                </>
              )}
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
                          <Badge tone={REQUEST_KIND_TONE[s.kind]}>{REQUEST_KIND_LABEL[s.kind]}</Badge>
                          <Badge tone={requestStatus(s.kind, s.status).tone}>{requestStatus(s.kind, s.status).label}</Badge>
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
          {request.kind === "ai" || request.kind === "bug" ? (
            <Card>
              <CardHeader>
                <CardTitle>{request.kind === "bug" ? "AI 오류 확인" : "AI 처리"}</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3 text-sm">
                {imageRequest ? (
                  <p className="text-xs text-ink-500">AI 이미지 생성 요청은 지금은 담당자가 만들어 넣어요 (이미지 생성 API 는 다음 단계).</p>
                ) : !aiConfigured() ? (
                  <p className="text-xs text-ink-500">API 키(ANTHROPIC_API_KEY)가 없어 AI 가 처리하지 않아요. 담당자가 처리해 주세요.</p>
                ) : null}
                {reqStyles.length || refTemplateId ? (
                  <p className="text-xs text-ink-700">
                    이 네모의 옵션:{" "}
                    {[
                      reqStyles.length ? `디자인 유형 ${reqStyles.map((id, i) => `${i === 0 ? "★" : ""}${STYLE_BY_ID[id].label}`).join(" · ")}` : null,
                      refTemplateId ? `참고 템플릿 ${refTemplate?.name ?? "(목록에 없음)"}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {runs?.available ? <AiRunList runs={runs.runs} path={`/admin/requests/${request.id}`} /> : <p className="text-xs text-ink-500">0008_ai.sql 을 적용하면 AI 실행 기록이 보여요.</p>}
                {request.kind === "bug" ? (
                  <p className="text-xs text-ink-500">오류 신고는 AI 가 먼저 확인해요: 최근 AI 변경 때문이면 되돌리고, 테마 · 문구로 고칠 수 있으면 고치고, 아니면 담당자 확인 중으로 넘겨요 (24시간 안에 처리).</p>
                ) : !imageRequest ? (
                  <AiRerunButton kind="request" id={request.id} disabled={!aiConfigured() || !runs?.available} label="AI로 다시 처리" />
                ) : null}
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>상태 변경 · 사용자에게 답하기</CardTitle>
            </CardHeader>
            <CardBody>
              <RequestForm requestId={request.id} status={request.status} awaiting={awaiting} kind={request.kind} tokensUsed={request.tokens_used} messaging={thread.available} />
              {request.kind === "ai" ? (
                <p className="mt-3 text-xs text-ink-500">
                  요청자 플랜 {ownerPlan?.name ?? "없음"}
                  {ownerPlan && owner.subscription?.billing_cycle === "year" ? " (연간)" : ""} · 월 토큰 {ownerPlan ? (ownerPlan.monthlyAiTokens === null ? "무제한" : formatTokens(ownerPlan.monthlyAiTokens)) : "-"}. 사용 토큰을 저장하면
                  한도 초과분이 토큰 크레딧에서 차감됩니다.
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>프로젝트 정보</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">프로젝트 상태</span>
                <ProjectStatusControl projectId={project.id} status={project.status} />
              </div>
              {builder ? <Row k="만드는 방식" v={builder === "expert" ? `전문가에게 맡김 · 첫 완성본 ${dueLabel(project.created_at)}` : "AI로 바로 만들기"} /> : null}
              <Row k="업종" v={brief.industry} />
              {brief.business ? <Row k="한 줄 소개" v={brief.business.tagline} /> : null}
              {brief.business ? <Row k="서비스 · 상품" v={brief.business.offerings.map((o) => o.name).join(" · ")} /> : null}
              <Row k="목적" v={brief.purpose} />
              <Row k="디자인 유형" v={normalizeStyles(brief.styleTags?.length ? brief.styleTags : brief.tone).map((id, i) => `${i === 0 ? "★" : ""}${STYLE_BY_ID[id].label}`).join(" · ")} />
              <Row k="메인 색상" v={brief.primaryColor} />
              <Row k="페이지" v={brief.pages?.join(" · ")} />
              <Row k="기능" v={brief.features?.map((f) => FEATURE_LABEL[f] ?? f).join(", ")} />
              {brief.prompt ? <Row k="프롬프트" v={brief.prompt} /> : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                <Link href={`/admin/projects/${project.id}`} className="text-brand-600 hover:underline">
                  제작 정보 전체 (메뉴 · 이미지 자리)
                </Link>
                <Link href={`/admin?project=${project.id}&status=all`} className="text-brand-600 hover:underline">
                  이 프로젝트의 모든 요청 보기
                </Link>
                {thread.available ? (
                  <Link href={`/admin/messages/${project.id}`} className="text-brand-600 hover:underline">
                    사이트 메시지 열기
                  </Link>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <MarkRead ids={unreadIds} mark={markUserMessagesReadAction} />
      {/* 사람이 답하는 요청을 처음 열면 "확인 완료" 로 */}
      {request.status === "pending" && needsPerson(request.kind) ? <AutoCheck requestId={request.id} mark={markRequestCheckedAction} /> : null}
      <AutoRefresh />
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
