import { NewTag } from "@/components/messages/new-tag";
import { RegionThumb } from "@/components/messages/region-thumb";
import type { SendResult } from "@/components/messages/reply-form";
import { ReplyToggle } from "@/components/messages/reply-toggle";
import { Thread } from "@/components/messages/thread";
import { Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, formatTokens } from "@/config/plans";
import { REQUEST_KIND_TONE, REQUEST_STATUS, isOpenStatus } from "@/config/requests";
import type { ChangeRequestRow, MessageRow, ProjectPageRow } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

/**
 * 사용자의 요청 내역. 한 번에 보낸 묶음(batch)별로 묶고, 요청(네모)마다 원래 요청 → 담당자 답변·상태 변경 → 내 답글이
 * 한 줄기로 이어진다. 네모 미리보기와 번호를 같이 보여 어느 네모의 대화인지 섞이지 않게 한다.
 *
 * threads 가 null 이면 대화 기능을 쓸 수 없는 DB(0006 적용 전)다. 그때는 예전처럼 답변 한 줄만 보여준다.
 */
export function RequestThreads({
  requests,
  pages,
  threads,
  replyAction,
}: {
  requests: ChangeRequestRow[];
  pages: Pick<ProjectPageRow, "id" | "name" | "screenshots">[];
  threads: Map<string, MessageRow[]> | null;
  /** 요청 id → 그 요청에 답글을 보내는 서버 액션 */
  replyAction: (requestId: string) => (body: string) => Promise<SendResult>;
}) {
  const pageOf = new Map(pages.map((p) => [p.id, p]));
  const batches = new Map<string, ChangeRequestRow[]>();
  for (const r of requests) {
    const list = batches.get(r.batch_id) ?? [];
    list.push(r);
    batches.set(r.batch_id, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...batches.entries()].map(([batchId, items]) => (
        <section key={batchId} className="rounded-md border border-ink-200 bg-surface">
          <header className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            <span>
              {formatDateTime(items[0].created_at)}에 보낸 요청 · {items.length}건
            </span>
            <span className="font-mono">{batchId.slice(0, 8)}</span>
          </header>
          <ul className="divide-y divide-ink-100">
            {items
              .slice()
              .sort((a, b) => a.seq - b.seq)
              .map((r) => {
                const s = REQUEST_STATUS[r.status];
                const page = pageOf.get(r.page_id);
                const shot = page?.screenshots[r.device];
                const entries = threads?.get(r.id) ?? [];
                const awaiting = Boolean(r.awaiting_user) && isOpenStatus(r.status);
                const unread = entries.some((m) => m.author_role === "admin" && !m.read_at);
                return (
                  <li key={r.id} id={`r-${r.id}`} className="scroll-mt-28 px-4 py-4 data-[focus]:bg-brand-50">
                    <div className="flex gap-3">
                      <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{r.seq}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                          <span className="font-medium text-ink-900">{page?.name ?? "페이지"}</span>
                          <span>{DEVICE_LABEL[r.device]}</span>
                          <Badge tone={REQUEST_KIND_TONE[r.kind]}>{REQUEST_KIND_LABEL[r.kind]}</Badge>
                          <Badge tone={s.tone}>{s.label}</Badge>
                          {awaiting ? <span className="rounded-sm bg-sky-400 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-night-950">확인 필요</span> : null}
                          {!awaiting ? <NewTag unread={unread} label="새 답변" /> : null}
                          {r.kind === "ai" && r.tokens_used > 0 ? <span className="tabular-nums">{formatTokens(r.tokens_used)} 토큰</span> : null}
                          {r.kind === "bug" ? <span>무료</span> : null}
                        </div>
                        <div className="mt-2 flex gap-3">
                          {shot ? (
                            <div className="hidden sm:block">
                              <RegionThumb shot={shot} region={r.region} />
                            </div>
                          ) : null}
                          <p className="min-w-0 flex-1 text-sm break-words whitespace-pre-wrap">{r.message}</p>
                        </div>

                        {threads ? (
                          <div className="mt-3 flex flex-col gap-3 border-l-2 border-ink-200 pl-3">
                            <Thread entries={entries} viewer="user" />
                            {awaiting ? <p className="text-xs font-medium text-sky-600">담당자가 답을 기다리고 있습니다. 답글을 보내면 작업이 이어집니다.</p> : null}
                            <ReplyToggle
                              send={replyAction(r.id)}
                              open={awaiting}
                              placeholder={awaiting ? "담당자의 질문에 답해 주세요" : "이 요청에 대해 담당자에게 남길 말을 적어 주세요"}
                            />
                          </div>
                        ) : r.resolution_note ? (
                          <p className="mt-2 text-xs text-ink-500">답변: {r.resolution_note}</p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
