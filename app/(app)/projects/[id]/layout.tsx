import { notFound } from "next/navigation";

import { ProjectEditor } from "@/components/editor/editor";
import { normalizeStyles } from "@/config/design-styles";
import { PLAN_BY_CODE } from "@/config/plans";
import { templateDesign } from "@/config/template-designs";
import { aiConfigured } from "@/lib/ai/claude";
import { designOf, isAiPending } from "@/lib/design-doc";
import { listProjectPhotos } from "@/lib/photos";
import { listPurchasedTemplateIds, listTemplates } from "@/lib/templates";
import { emptyImageCount, generatedImageCount } from "@/lib/site-plan";
import { STATUS_EVENT_TEXT, dueLabel, isAiWorking, isOpenStatus, needsPerson } from "@/config/requests";
import { APPLY_STATE, releaseStage } from "@/config/releases";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { NO_NEWS, getMessageSummary, listRequestThreads } from "@/lib/messages";
import { getProject, listProjectRequests } from "@/lib/projects";
import { getQuota } from "@/lib/quota";
import { NO_RELEASE, listReleaseSummaries } from "@/lib/releases";

export const dynamic = "force-dynamic";
// "요청하기" 뒤 AI 처리(after)가 이 시간 안에 끝나야 한다 (서버 액션은 페이지의 설정을 따른다)
export const maxDuration = 300;

/**
 * 사이트 편집 화면의 틀 (2026-11-24). 위쪽 줄 · 왼쪽 페이지 목록 · 오른쪽 수정 요청 칸은 그대로 두고,
 * 가운데만 탭(사이트 · 전문가 검수 요청 · 관리자 페이지 · 제작 정보 · 요청 내역 · 메시지 · 사이트에 올리기)에 따라 바뀐다.
 * 탭은 각자 주소가 있는 하위 페이지이고, 이 레이아웃은 탭을 옮겨도 다시 그려지지 않아 그리던 박스가 남는다.
 */
export default async function ProjectLayout({ params, children }: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}`);
  const data = await getProject(user.id, id);
  if (!data) notFound();

  const [{ plan }, requests, threads, summary, releases, catalog, purchased] = await Promise.all([
    getSubscription(user.id),
    listProjectRequests(id),
    listRequestThreads(id),
    getMessageSummary(),
    listReleaseSummaries([id]),
    listTemplates(),
    listPurchasedTemplateIds(user.id),
  ]);
  const quota = await getQuota(user.id, plan);
  // 상단 "웹사이트에 적용": 끝난 수정 중 아직 실제 웹사이트에 올라가지 않은 수 · 진행 중인 적용 단계
  const rel = releases.byProject.get(id) ?? NO_RELEASE;
  const website = releases.available
    ? {
        waiting: rel.waiting,
        active: rel.active ? APPLY_STATE[releaseStage(rel.active) === "new" ? "requested" : "checking"].label : null,
        published: Boolean(rel.lastLive),
        ready: data.project.status === "live" || data.project.status === "review",
      }
    : null;
  // 플랜이 없으면 스타터 기준 화면만 보여주고, 제출은 패널에서 막는다
  const devices = (plan ?? PLAN_BY_CODE.starter).devices;

  // 위저드로 만든 사이트: 메뉴 묶음(하위 페이지) · 이미지 자리 설명을 편집기에 넘긴다
  const site = data.project.brief.site;
  const planned = new Map((site?.pages ?? []).map((p) => [p.path, p]));
  const imageById = new Map((site?.images ?? []).map((i) => [i.id, i]));
  const photos = site ? await listProjectPhotos(id) : {};

  // 방금 만든 사이트면 첫 안내 (?created=1). 이미지 생성 요청 접수에 실패했으면 그것도 알린다 (&images=failed)
  // 누가 만드나: AI 는 바로, 전문가는 만든 시각 + 72시간 안에 첫 완성본 (예전 사이트는 AI 로 본다)
  const expertBuild = site?.builder === "expert";
  const building = data.project.status === "building" || data.project.status === "brief";
  const buildNote = !site
    ? null
    : expertBuild
      ? building
        ? `전문가가 만드는 중이에요 · 첫 완성본 ${dueLabel(data.project.created_at)}`
        : "전문가가 만든 사이트예요"
      : "AI가 만든 디자인 시안이에요. 담당자가 마무리하면 '제작 완료' 로 바뀌어요";

  // 방금 만든 사이트의 첫 안내 (?created=1 — 주소는 편집기가 읽는다). 이미지 생성 요청 접수에 실패했으면(&images=failed) failed 문장
  let welcome: { ok: string; failed: string } | null = null;
  if (site) {
    const generated = generatedImageCount(site.images);
    const emptySlots = site.images.filter((s) => !s.generate).length;
    const parts = [
      expertBuild
        ? `전문가에게 맡겼어요. ${dueLabel(data.project.created_at)} 첫 완성본을 올려 드려요. 그동안 이 디자인 시안에 빨간 박스로 의견을 미리 남겨도 돼요.`
        : "AI가 디자인 시안을 바로 만들었어요. 고칠 곳은 빨간 박스로 요청하면 AI가 바로 진행해요.",
    ];
    if (emptySlots > 0) {
      parts.push(`비어 있는 이미지 영역 ${emptySlots}곳(사진 ${emptyImageCount(site.images)}장)에는 어떤 이미지가 필요한지 적어 두었어요 — 오른쪽 '이미지 영역' 에서 확인하세요.`);
    }
    const ok = generated > 0 ? [...parts, `AI 이미지 ${generated}장 생성 요청도 접수했어요. 진행 상황은 요청 내역에서 볼 수 있어요.`] : parts;
    const failed = generated > 0 ? [...parts, "AI 이미지 생성 요청은 접수하지 못했어요. 이미지 영역에서 'AI로 만들기' 로 다시 요청해 주세요."] : parts;
    welcome = { ok: ok.join(" "), failed: failed.join(" ") };
  }

  // AI: 디자인 버전(캡처 주소의 v 와 같다) · 첫 제작 중인지 · 지금 AI 가 맡고 있는 AI 반영 네모 (config/requests.ts isAiWorking)
  const brief = data.project.brief;
  const design = designOf(brief);
  const working = requests.filter((r) => isAiWorking(r));
  const ai = site
    ? {
        enabled: aiConfigured(),
        version: design.version,
        pending: isAiPending(design),
        open: working.length,
        // AI 가 지금 처리 중인 묶음 (가장 최근). 새로 고침해도 "AI 작업 중" 화면을 이어서 보여 준다
        batchId: working[0]?.batch_id ?? null,
      }
    : null;
  const templates = catalog.templates.map((t) => ({ id: t.id, name: t.name, slug: t.slug, tags: templateDesign(t.slug)?.tags ?? [], purchased: purchased.has(t.id) }));

  return (
    <ProjectEditor
      projectId={id}
      projectName={data.project.name}
      welcome={welcome}
      buildNote={buildNote}
      siteStyles={normalizeStyles(brief.styleTags?.length ? brief.styleTags : brief.tone)}
      templates={templates}
      ai={ai}
      pages={data.pages.map((p) => {
        const pp = planned.get(p.path);
        return {
          id: p.id,
          name: p.name,
          path: p.path,
          screenshots: p.screenshots,
          label: pp?.label,
          group: pp?.group ?? null,
          // 로고 자리(있으면)는 모든 페이지의 머리 메뉴에 있다
          slots: (pp ? [...(imageById.has("logo") ? ["logo"] : []), ...pp.slotIds] : undefined)
            ?.map((sid) => imageById.get(sid))
            .filter((s) => s !== undefined)
            .map((s) => ({
              id: s.id,
              label: s.label,
              need: s.need,
              ratio: s.ratio,
              count: s.count,
              source: s.source,
              generate: s.generate,
              photos: (photos[s.id] ?? []).map((ph) => ({ name: ph.name, url: ph.url })),
            })),
        };
      })}
      allowedDevices={devices}
      existing={requests.map((r) => {
        // 담당자의 마지막 글 (글 없이 상태만 바꿨으면 그 안내 문장). 0006 적용 전에는 예전 답변 한 줄.
        const fromAdmin = (threads.byRequest.get(r.id) ?? []).filter((m) => m.author_role === "admin");
        const last = fromAdmin.at(-1);
        return {
          id: r.id,
          seq: r.seq,
          region: r.region,
          status: r.status,
          kind: r.kind,
          message: r.message,
          page_id: r.page_id,
          device: r.device,
          awaiting: Boolean(r.awaiting_user) && isOpenStatus(r.status),
          due: needsPerson(r.kind) && isOpenStatus(r.status) ? dueLabel(r.created_at, r.kind) : null,
          lastReply: last ? (last.body ?? (last.status ? STATUS_EVENT_TEXT[last.status] : null)) : r.resolution_note,
          lastReplyByAi: last?.via === "ai",
          unread: fromAdmin.some((m) => !m.read_at),
        };
      })}
      quota={quota}
      hasPlan={Boolean(plan)}
      news={summary.available ? (summary.byProject.get(id) ?? NO_NEWS) : null}
      website={website}
      siteAdmin={site ? { lists: design.collections?.length ?? 0 } : null}
    >
      {children}
    </ProjectEditor>
  );
}
