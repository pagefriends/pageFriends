import { MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BriefDetails } from "@/components/brief/brief-details";
import { Alert } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { slotStatuses, type SlotRequestState } from "@/components/editor/types";
import { listProjectPhotos, type SitePhoto } from "@/lib/photos";
import { getProject, listProjectRequests } from "@/lib/projects";
import type { ChangeRequestRow } from "@/lib/types/db";

export const metadata: Metadata = { title: "제작 정보" };

/**
 * 사이트 주인이 보는 제작 정보: 새 사이트를 만들 때 적은 내용과 메뉴 구성, 이미지 자리 목록.
 * 이미지 자리 목록은 "준비할 사진 목록" 이기도 하다 — 비어 있는 자리마다 어떤 사진이 필요한지 한 번에 본다.
 */
export default async function ProjectBriefPage({ params }: PageProps<"/projects/[id]/brief">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}/brief`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const { project, pages } = data;
  const site = project.brief.site;
  // 자리마다 지금 상태: 그 자리에 보낸 요청(위저드의 AI 생성 · 편집기의 "AI로 만들기")이 있으면 요청 상태, 없으면 빈 자리
  const [requests, uploaded]: [ChangeRequestRow[], Record<string, SitePhoto[]>] = site ? await Promise.all([listProjectRequests(id), listProjectPhotos(id)]) : [[], {}];
  const status = site ? slotStatuses(pages, requests) : new Map<string, SlotRequestState>();
  const have = (slotId: string) => uploaded[slotId]?.length ?? 0;
  // 아직 비어 있는 자리: 요청도 없고 사진도 다 올리지 않은 자리. 사진 수는 남은 장 수
  const empty = site ? site.images.filter((s) => !status.has(s.id) && have(s.id) < s.count) : [];
  const photos = (list: typeof empty) => list.reduce((n, s) => n + s.count - have(s.id), 0);
  const emptyReal = empty.filter((s) => s.source === "real");
  const emptyAi = empty.filter((s) => s.source === "ai");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← 편집 화면
        </Link>
        <Link href={`/projects/${id}/messages`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <MessageSquareIcon className="size-3.5" /> 담당자에게 메시지
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.name} · 제작 정보</h1>
      <p className="mt-1 text-sm text-ink-500">새 사이트를 만들 때 적은 내용이에요. 바꾸고 싶은 점은 편집 화면에서 네모를 그려 요청하거나 담당자에게 메시지로 알려 주세요.</p>

      {empty.length > 0 ? (
        <Alert tone="blue" className="mt-5">
          비어 있는 이미지 자리가 {empty.length}곳(사진 {photos(empty)}장) 있어요.
          {emptyReal.length > 0
            ? ` 그중 실제 사진이 필요한 자리 ${emptyReal.length}곳(사진 ${photos(emptyReal)}장)은 아래 '이미지 자리' 목록에서 바로 올려 주세요.`
            : ""}
          {emptyAi.length > 0 ? ` AI로 만들 수 있는 자리 ${emptyAi.length}곳은 편집 화면의 이미지 자리에서 'AI로 만들기' 로 요청할 수 있어요.` : ""}
        </Alert>
      ) : null}

      <div className="mt-6">
        <BriefDetails
          brief={project.brief}
          pages={pages}
          viewer="owner"
          slotStatus={site ? status : undefined}
          projectId={id}
          photos={Object.fromEntries(Object.entries(uploaded).map(([k, v]) => [k, v.map((p) => ({ name: p.name, url: p.url }))]))}
        />
      </div>
    </div>
  );
}
