import { notFound } from "next/navigation";

import { ProjectEditor } from "@/components/editor/editor";
import { DELIVERY_DAYS, PLAN_BY_CODE } from "@/config/plans";
import { emptyImageCount, generatedImageCount } from "@/lib/site-plan";
import { STATUS_EVENT_TEXT, isOpenStatus } from "@/config/requests";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { NO_NEWS, getMessageSummary, listRequestThreads } from "@/lib/messages";
import { getProject, listProjectRequests } from "@/lib/projects";
import { getQuota } from "@/lib/quota";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/projects/${id}`);
  const data = await getProject(user.id, id);
  if (!data) notFound();

  const [{ plan }, requests, threads, summary] = await Promise.all([getSubscription(user.id), listProjectRequests(id), listRequestThreads(id), getMessageSummary()]);
  const quota = await getQuota(user.id, plan);
  // 플랜이 없으면 스타터 기준 화면만 보여주고, 제출은 패널에서 막는다
  const devices = (plan ?? PLAN_BY_CODE.starter).devices;

  // 위저드로 만든 사이트: 메뉴 묶음(하위 페이지) · 이미지 자리 설명을 편집기에 넘긴다
  const site = data.project.brief.site;
  const planned = new Map((site?.pages ?? []).map((p) => [p.path, p]));
  const imageById = new Map((site?.images ?? []).map((i) => [i.id, i]));

  // 방금 만든 사이트면 첫 안내 (?created=1). 이미지 생성 요청 접수에 실패했으면 그것도 알린다 (&images=failed)
  let welcome: { text: string; tone: "blue" | "red" } | null = null;
  if (sp.created === "1" && site) {
    const generated = generatedImageCount(site.images);
    const emptySlots = site.images.filter((s) => !s.generate).length;
    const failed = sp.images === "failed";
    const parts = [`구성 초안이 만들어졌어요. 첫 완성본은 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 올라와요.`];
    if (emptySlots > 0) {
      parts.push(`비어 있는 이미지 자리 ${emptySlots}곳(사진 ${emptyImageCount(site.images)}장)에는 어떤 이미지가 필요한지 적어 두었어요 — 오른쪽 '이미지 자리' 에서 확인하세요.`);
    }
    if (generated > 0 && !failed) parts.push(`AI 이미지 ${generated}장 생성 요청도 접수했어요. 진행 상황은 요청 내역에서 볼 수 있어요.`);
    if (generated > 0 && failed) parts.push("AI 이미지 생성 요청은 접수하지 못했어요. 이미지 자리에서 'AI로 만들기' 로 다시 요청해 주세요.");
    welcome = { text: parts.join(" "), tone: failed ? "red" : "blue" };
  }

  return (
    <ProjectEditor
      projectId={id}
      projectName={data.project.name}
      welcome={welcome}
      pages={data.pages.map((p) => {
        const pp = planned.get(p.path);
        return {
          id: p.id,
          name: p.name,
          path: p.path,
          screenshots: p.screenshots,
          label: pp?.label,
          group: pp?.group ?? null,
          slots: pp?.slotIds
            .map((sid) => imageById.get(sid))
            .filter((s) => s !== undefined)
            .map((s) => ({ id: s.id, label: s.label, need: s.need, ratio: s.ratio, count: s.count, source: s.source, generate: s.generate })),
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
          lastReply: last ? (last.body ?? (last.status ? STATUS_EVENT_TEXT[last.status] : null)) : r.resolution_note,
          unread: fromAdmin.some((m) => !m.read_at),
        };
      })}
      quota={quota}
      hasPlan={Boolean(plan)}
      news={summary.available ? (summary.byProject.get(id) ?? NO_NEWS) : null}
    />
  );
}
