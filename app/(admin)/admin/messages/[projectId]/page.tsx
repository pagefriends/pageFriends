import Link from "next/link";
import { notFound } from "next/navigation";

import { markUserMessagesReadAction, postProjectMessageAction } from "@/app/(admin)/admin/actions";
import { ProjectStatusControl } from "@/components/admin/quick-actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { ChatScroll } from "@/components/messages/chat-scroll";
import { MarkRead } from "@/components/messages/mark-read";
import { ReplyForm } from "@/components/messages/reply-form";
import { Thread } from "@/components/messages/thread";
import { Alert } from "@/components/ui/card";
import { getAdminConversation } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** 자주 쓰는 안내. 누르면 입력칸에 들어가고, 고쳐서 보낼 수 있다. */
const QUICK = ["첫 완성본이 올라왔습니다. 편집 화면에서 확인해 주세요.", "확인 후 다시 안내드리겠습니다.", "고칠 곳은 편집 화면에서 네모를 그려 보내 주시면 바로 처리됩니다."];

/** 사이트 하나와의 메시지. 사용자의 "메시지" 화면과 같은 대화를 관리자 쪽에서 본다. */
export default async function AdminConversationPage({ params }: PageProps<"/admin/messages/[projectId]">) {
  const { projectId } = await params;
  const data = await getAdminConversation(projectId);
  if (!data) notFound();
  const { project, ownerEmail, available, messages, openRequests } = data;
  const unreadIds = messages.filter((m) => m.author_role === "user" && !m.read_at).map((m) => m.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/messages" className="text-sm text-ink-500 hover:text-ink-900">
        ← 메시지 목록
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.name} · 사이트 메시지</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-500">
        <span>요청자 {ownerEmail ?? project.user_id}</span>
        <span className="inline-flex items-center gap-2">
          프로젝트 상태 <ProjectStatusControl projectId={project.id} status={project.status} />
        </span>
        <Link href={`/admin?project=${project.id}&status=all`} className="font-medium text-brand-600 hover:underline">
          수정 요청 보기 (진행 중 {openRequests}건)
        </Link>
        <Link href={`/admin/projects/${project.id}`} className="font-medium text-brand-600 hover:underline">
          제작 정보
        </Link>
      </div>

      {available ? (
        <>
          <ChatScroll count={messages.length} className="mt-6 max-h-[55vh] min-h-48 rounded-md border border-ink-200 bg-surface p-4">
            {messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-500">아직 주고받은 메시지가 없습니다. 아래에서 먼저 안내를 보낼 수 있습니다.</p>
            ) : (
              <Thread entries={messages} viewer="admin" />
            )}
          </ChatScroll>
          <ReplyForm className="mt-3" send={postProjectMessageAction.bind(null, project.id)} placeholder="사용자에게 보낼 내용을 적어 주세요" quick={QUICK} />
          <p className="mt-2 text-xs text-ink-500">프로젝트 상태를 바꾸면 이 대화에 안내가 자동으로 남습니다.</p>
        </>
      ) : (
        <Alert tone="gray" className="mt-6">
          메시지 기능은 <code>supabase/migrations/0006_messages.sql</code> 을 적용해야 켜집니다.
        </Alert>
      )}

      <MarkRead ids={unreadIds} mark={markUserMessagesReadAction} />
      <AutoRefresh seconds={20} />
    </div>
  );
}
