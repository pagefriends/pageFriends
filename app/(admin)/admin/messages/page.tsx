import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/messages/auto-refresh";
import { Alert, Badge } from "@/components/ui/card";
import { PROJECT_STATUS } from "@/config/requests";
import { listAdminConversations } from "@/lib/admin";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "사이트 메시지" };
export const dynamic = "force-dynamic";

/**
 * 사이트 메시지함: 네모와 상관없이 사용자와 주고받는 대화 (진행 상황 문의, 자료 전달, 안내 등).
 * 한 줄 = 사이트 하나. 사용자의 새 글이 있는 사이트가 위에 온다.
 */
export default async function AdminMessagesPage() {
  const { available, items } = await listAdminConversations();
  const unread = items.filter((c) => c.unread > 0).length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">사이트 메시지</h1>
      <p className="mt-1 text-sm text-ink-500">
        네모와 상관없이 사용자와 주고받는 대화입니다. 답을 기다리는 사이트 {unread}곳. 먼저 말을 걸려면 요청 상세의 &lsquo;사이트 메시지 열기&rsquo; 로 들어가세요.
      </p>

      {!available ? (
        <Alert tone="gray" className="mt-6">
          메시지 기능은 <code>supabase/migrations/0006_messages.sql</code> 을 적용해야 켜집니다.
        </Alert>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">아직 주고받은 메시지가 없습니다.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink-100 rounded-md border border-ink-200 bg-surface">
          {items.map((c) => (
            <li key={c.project.id}>
              <Link href={`/admin/messages/${c.project.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{c.project.name}</span>
                    <Badge tone={PROJECT_STATUS[c.project.status].tone}>{PROJECT_STATUS[c.project.status].label}</Badge>
                    {c.ownerEmail ? <span className="text-xs text-ink-500">{c.ownerEmail}</span> : null}
                  </div>
                  <p className="mt-1 line-clamp-1 text-[13px] text-ink-500">
                    <span className="font-medium text-ink-700">{c.last.author_role === "user" ? "사용자" : "담당자"}</span> {c.last.body}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-ink-400">{formatDateTime(c.last.created_at)}</span>
                  {c.unread > 0 ? <span className="rounded-sm bg-sky-400 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-night-950">새 글 {c.unread}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AutoRefresh seconds={45} />
    </div>
  );
}
