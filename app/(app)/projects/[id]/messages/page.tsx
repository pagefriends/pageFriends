import { ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markMessagesReadAction, postMessageAction } from "@/app/(app)/projects/[id]/actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { ChatScroll } from "@/components/messages/chat-scroll";
import { MarkRead } from "@/components/messages/mark-read";
import { ReplyForm } from "@/components/messages/reply-form";
import { Thread } from "@/components/messages/thread";
import { Alert } from "@/components/ui/card";
import { SUPPORT } from "@/content/site";
import { requireUser } from "@/lib/auth/session";
import { listGeneralThread } from "@/lib/messages";
import { getProject } from "@/lib/projects";

export const metadata: Metadata = { title: "메시지" };
export const dynamic = "force-dynamic";

/**
 * 사이트 메시지: 네모와 상관없는 질문·전달 사항을 담당자와 주고받는 곳 (진행 상황, 자료 전달, 계정·결제 문의 등).
 * 화면을 고쳐 달라는 요청은 여기가 아니라 편집 화면에서 네모로 보내야 처리·기록된다.
 */
export default async function MessagesPage({ params }: PageProps<"/projects/[id]/messages">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}/messages`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const thread = await listGeneralThread(id);
  const unreadIds = thread.messages.filter((m) => m.author_role === "admin" && !m.read_at).map((m) => m.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← 편집 화면
        </Link>
        <Link href={`/projects/${id}/requests`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <ClockIcon className="size-3.5" /> 요청 내역
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.project.name} · 메시지</h1>
      <p className="mt-1 text-sm text-ink-500">
        진행 상황이 궁금하거나 전할 내용이 있을 때 담당자에게 남기는 곳입니다. {SUPPORT.hours}에 답합니다. 화면을 고쳐 달라는 요청은{" "}
        <Link href={`/projects/${id}`} className="font-medium text-brand-600 hover:underline">
          편집 화면
        </Link>
        에서 네모를 그려 보내야 처리됩니다.
      </p>

      {thread.available ? (
        <>
          <ChatScroll count={thread.messages.length} className="mt-6 max-h-[55vh] min-h-48 rounded-md border border-ink-200 bg-surface p-4">
            {thread.messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-500">아직 주고받은 메시지가 없습니다. 궁금한 점을 먼저 남겨 보세요.</p>
            ) : (
              <Thread entries={thread.messages} viewer="user" />
            )}
          </ChatScroll>
          <ReplyForm className="mt-3" send={postMessageAction.bind(null, id, null)} placeholder="담당자에게 보낼 내용을 적어 주세요" />
        </>
      ) : (
        <Alert tone="gray" className="mt-6">
          메시지 기능을 준비하고 있습니다. 그때까지는{" "}
          <a href={`mailto:${SUPPORT.email}`} className="font-medium underline">
            {SUPPORT.email}
          </a>{" "}
          로 문의해 주세요.
        </Alert>
      )}

      <MarkRead ids={unreadIds} mark={markMessagesReadAction} />
      <AutoRefresh seconds={20} />
    </div>
  );
}
