import { MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markMessagesReadAction, postMessageAction } from "@/app/(app)/projects/[id]/actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { HashFocus } from "@/components/messages/hash-focus";
import { MarkRead } from "@/components/messages/mark-read";
import { RequestThreads } from "@/components/messages/request-threads";
import { Alert } from "@/components/ui/card";
import { DEVICE_LABEL } from "@/config/plans";
import { isOpenStatus } from "@/config/requests";
import { requireUser } from "@/lib/auth/session";
import { listRequestThreads } from "@/lib/messages";
import { getProject, listProjectRequests } from "@/lib/projects";

export const metadata: Metadata = { title: "요청 내역" };
export const dynamic = "force-dynamic";

/**
 * 요청 내역 + 요청별 대화. 담당자의 답변·상태 변경이 요청마다 이어지고, 여기서 바로 답글을 보낸다.
 * 화면에 뜬 담당자 글은 읽음으로 표시된다 (이번 방문 동안은 "새 답변" 표시가 남는다).
 */
export default async function RequestsPage({ params }: PageProps<"/projects/[id]/requests">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}/requests`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const [requests, threads] = await Promise.all([listProjectRequests(id), listRequestThreads(id)]);
  const pageName = new Map(data.pages.map((p) => [p.id, p.name]));

  const open = requests.filter((r) => isOpenStatus(r.status)).length;
  const awaiting = requests.filter((r) => r.awaiting_user && isOpenStatus(r.status));
  const unreadIds = [...threads.byRequest.values()].flat().filter((m) => m.author_role === "admin" && !m.read_at).map((m) => m.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← 편집 화면
        </Link>
        {threads.available ? (
          <Link href={`/projects/${id}/messages`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
            <MessageSquareIcon className="size-3.5" /> 담당자에게 메시지
          </Link>
        ) : null}
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.project.name} · 요청 내역</h1>
      <p className="mt-1 text-sm text-ink-500">
        총 {requests.length}건 · 진행 중 {open}건. AI 반영은 보통 몇 시간, 전문가 요청은 1~2 영업일 안에 처리됩니다. 오류 신고는 무료입니다.
        {threads.available ? " 담당자의 답변에는 요청마다 바로 답글을 달 수 있고, 답글은 토큰이나 횟수를 쓰지 않습니다." : null}
      </p>

      {awaiting.length > 0 ? (
        <Alert tone="blue" className="mt-5">
          <p className="font-medium">담당자가 답을 기다리는 요청이 {awaiting.length}건 있습니다.</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {awaiting.map((r) => (
              <li key={r.id}>
                <a href={`#r-${r.id}`} className="underline">
                  {pageName.get(r.page_id) ?? "페이지"} · {DEVICE_LABEL[r.device]} · {r.seq}번
                </a>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {requests.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">
          아직 보낸 요청이 없습니다. 편집 화면에서 고칠 곳에 네모를 그려 요청해 보세요.
        </p>
      ) : (
        <div className="mt-6">
          <RequestThreads requests={requests} pages={data.pages} threads={threads.available ? threads.byRequest : null} replyAction={(requestId) => postMessageAction.bind(null, id, requestId)} />
        </div>
      )}

      <MarkRead ids={unreadIds} mark={markMessagesReadAction} />
      <HashFocus />
      <AutoRefresh />
    </div>
  );
}
