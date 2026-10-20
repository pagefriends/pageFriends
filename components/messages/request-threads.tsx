import { NewTag } from "@/components/messages/new-tag";
import { RegionThumb } from "@/components/messages/region-thumb";
import type { SendResult } from "@/components/messages/reply-form";
import { ReplyToggle } from "@/components/messages/reply-toggle";
import { Thread } from "@/components/messages/thread";
import { Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, formatTokens } from "@/config/plans";
import { REQUEST_KIND_TONE, dueLabel, isOpenStatus, needsPerson, requestStatus } from "@/config/requests";
import { APPLY_STATE, type ApplyState } from "@/config/releases";
import type { ChangeRequestRow, MessageRow, ProjectPageRow } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

/**
 * 사용자의 요청 내역. 한 번에 보낸 묶음(batch)별로 묶고, 요청(네모)마다 원래 요청 → 담당자 답변·상태 변경 → 내 답글이
 * 한 줄기로 이어진다. 네모 미리보기와 번호를 같이 보여 어느 네모의 대화인지 섞이지 않게 한다.
 *
 * threads 가 null 이면 대화 기능을 쓸 수 없는 DB(0006 적용 전)다. 그때는 예전처럼 답변 한 줄만 보여준다.
 * applyStates 를 주면 끝난 요청마다 실제 웹사이트에 올라갔는지(적용 대기 · 점검 중 · 적용 완료)도 보여준다.
 */
export function RequestThreads({
  requests,
  pages,
  threads,
  replyAction,
  applyStates,
}: {
  requests: ChangeRequestRow[];
  pages: Pick<ProjectPageRow, "id" | "name" | "screenshots">[];
  threads: Map<string, MessageRow[]> | null;
  /** 요청 id → 그 요청에 답글을 보내는 서버 액션 */
  replyAction: (requestId: string) => (body: string) => Promise<SendResult>;
  applyStates?: Map<string, ApplyState>;
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
                const s = requestStatus(r.kind, r.status);
                const page = pageOf.get(r.page_id);
                const shot = page?.screenshots[r.device];
                const entries = threads?.get(r.id) ?? [];
                const awaiting = Boolean(r.awaiting_user) && isOpenStatus(r.status);
                // AI 가 물어본 질문 (AI 차례인 접수에서 AI 글이 마지막) — 답하면 AI 가 이어서 처리한다 (lib/ai/engine.ts resumeAfterAnswer)
                const aiAsked = awaiting && r.kind === "ai" && r.status === "pending" && entries.at(-1)?.via === "ai";
                const unread = entries.some((m) => m.author_role === "admin" && !m.read_at);
                const apply = applyStates?.get(r.id);
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
                          {apply ? <Badge tone={APPLY_STATE[apply].tone}>{APPLY_STATE[apply].label}</Badge> : null}
                          {awaiting ? <span className="rounded-sm bg-sky-400 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-night-950">확인 필요</span> : null}
                          {!awaiting ? <NewTag unread={unread} label="새 답변" /> : null}
                          {r.kind === "ai" && r.tokens_used > 0 ? <span className="tabular-nums">{formatTokens(r.tokens_used)} 토큰</span> : null}
                          {r.kind === "bug" ? <span>무료</span> : null}
                          {needsPerson(r.kind) && isOpenStatus(r.status) ? <span>답변 기한 {dueLabel(r.created_at, r.kind)}</span> : null}
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
                            <Thread entries={entries} viewer="user" kind={r.kind} />
                            {awaiting ? (
                              <p className="text-xs font-medium text-sky-600">
                                {aiAsked ? "AI가 답을 기다리고 있어요. 답글을 보내면 AI가 이어서 반영해요." : "담당자가 답을 기다리고 있습니다. 답글을 보내면 작업이 이어집니다."}
                              </p>
                            ) : null}
                            <ReplyToggle
                              send={replyAction(r.id)}
                              open={awaiting}
                              placeholder={aiAsked ? "AI의 질문에 답해 주세요" : awaiting ? "담당자의 질문에 답해 주세요" : "이 요청에 대해 담당자에게 남길 말을 적어 주세요"}
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
