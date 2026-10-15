import { NewTag } from "@/components/messages/new-tag";
import { Badge } from "@/components/ui/card";
import { REQUEST_STATUS, STATUS_EVENT_TEXT } from "@/config/requests";
import type { MessageRole, MessageRow } from "@/lib/types/db";
import { cn, formatDateTime } from "@/lib/utils";

/** 보는 사람(viewer) 기준으로 글쓴이를 부르는 말 */
const NAME: Record<MessageRole, Record<MessageRole, string>> = {
  user: { user: "나", admin: "담당자" },
  admin: { user: "사용자", admin: "담당자" },
};

/**
 * 대화 한 줄기. 내 글은 오른쪽, 상대 글은 왼쪽. 담당자가 상태를 바꾼 기록은 글 안에 상태 배지로 함께 보인다.
 * 상대 글 중 아직 안 읽은 것에는 "새 글", 내 글 중 상대가 읽은 것에는 "읽음" 이 붙는다.
 */
export function Thread({ entries, viewer, className }: { entries: MessageRow[]; viewer: MessageRole; className?: string }) {
  if (entries.length === 0) return null;
  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {entries.map((m) => {
        const mine = m.author_role === viewer;
        return (
          <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-500">
              <span className="font-medium text-ink-700">{NAME[viewer][m.author_role]}</span>
              <span>{formatDateTime(m.created_at)}</span>
              <NewTag unread={!mine && !m.read_at} />
            </div>
            <div className={cn("max-w-[88%] rounded-lg border px-3 py-2 text-sm", mine ? "border-brand-200 bg-brand-50 text-brand-800" : "border-ink-200 bg-ink-100 text-ink-900")}>
              {m.status ? (
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone={REQUEST_STATUS[m.status].tone}>{REQUEST_STATUS[m.status].label}</Badge>
                  {STATUS_EVENT_TEXT[m.status]}
                </p>
              ) : null}
              {m.body ? <p className={cn("break-words whitespace-pre-wrap", m.status && "mt-1.5")}>{m.body}</p> : null}
            </div>
            {mine && m.read_at ? <span className="mt-0.5 text-[10px] text-ink-400">읽음</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
