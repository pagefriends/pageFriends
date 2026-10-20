import type { Metadata } from "next";
import Link from "next/link";

import { BatchStatusSelect } from "@/components/admin/quick-actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { Alert, Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, formatTokens, type RequestKind } from "@/config/plans";
import { REQUEST_KIND_TONE, STATUS_EVENT_TEXT, isOpenStatus, needsPerson, remainingLabel, requestStatus } from "@/config/requests";
import { countRequestsByStatus, getAdminCounts, listAdminRequests, type AdminRequestListItem, type RequestFilter } from "@/lib/admin";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "수정 요청 관리" };
export const dynamic = "force-dynamic";

/**
 * 탭. "할 일" 은 지금 손댈 것만 모은다: 접수·처리중이고 사용자 답을 기다리지 않는 요청 + 사용자가 새 답글을 단 요청.
 * 사용자에게 질문해 두고 답을 기다리는 요청은 "확인 대기" 로 빠진다 (답글이 오면 다시 "할 일" 로 돌아온다).
 */
const TABS = ["todo", "awaiting", "pending", "processing", "done", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { todo: "할 일", awaiting: "확인 대기", pending: "접수", processing: "처리중", done: "반영 완료", rejected: "반영 불가", all: "전체" };

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.status as Tab) ? (sp.status as Tab) : "todo";
  const kind = sp.kind === "ai" || sp.kind === "expert" || sp.kind === "bug" ? (sp.kind as RequestKind) : undefined;
  const projectId = typeof sp.project === "string" ? sp.project : undefined;

  let items: AdminRequestListItem[] = [];
  let messaging = true;
  let error: string | null = null;
  let counts = { pending: 0, processing: 0, done: 0, rejected: 0, awaiting: 0 };
  let todo = 0;
  try {
    const filter: RequestFilter = { status: tab === "all" ? undefined : tab, kind, projectId };
    const [list, byStatus, badge] = await Promise.all([listAdminRequests(filter), countRequestsByStatus(), getAdminCounts()]);
    ({ items, messaging } = list);
    counts = byStatus;
    todo = badge.todo;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const tabCount: Partial<Record<Tab, number>> = { todo, awaiting: counts.awaiting, pending: counts.pending, processing: counts.processing, done: counts.done, rejected: counts.rejected };

  // 묶음(batch) 단위로 그룹
  const batches = new Map<string, AdminRequestListItem[]>();
  for (const r of items) {
    const list = batches.get(r.batch_id) ?? [];
    list.push(r);
    batches.set(r.batch_id, list);
  }

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { status: tab, kind, project: projectId, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin?${q.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">수정 요청</h1>
          <p className="mt-1 text-sm text-ink-500">답하거나 상태를 바꾸면 사용자에게 알림이 갑니다. 사용자가 답글을 달면 그 요청이 &lsquo;할 일&rsquo; 로 돌아옵니다.</p>
        </div>
        <div className="flex gap-1 rounded border border-ink-200 bg-surface p-1 text-[13px]">
          {(["", "ai", "expert", "bug"] as const).map((k) => (
            <Link key={k || "all"} href={href({ kind: k || undefined })} className={cn("rounded-sm px-3 py-1.5", (kind ?? "") === k ? "bg-ink-900 text-ink-50" : "text-ink-700 hover:bg-ink-100")}>
              {k ? REQUEST_KIND_LABEL[k] : "전체 종류"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.filter((t) => messaging || t !== "awaiting").map((t) => (
          <Link
            key={t}
            href={href({ status: t })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900")}
          >
            {TAB_LABEL[t]}
            {tabCount[t] !== undefined ? <span className="ml-1 text-xs tabular-nums text-ink-400">{tabCount[t]}</span> : null}
          </Link>
        ))}
        {projectId ? (
          <Link href={href({ project: undefined })} className="ml-auto self-center text-xs text-ink-500 hover:text-ink-900">
            프로젝트 필터 해제 ×
          </Link>
        ) : null}
      </div>

      {error ? (
        <Alert tone="red" className="mt-6">
          요청을 불러오지 못했습니다. <code>supabase/migrations/0002_admin.sql</code> 적용과 관리자 역할 지정을 확인하세요.
          <span className="mt-1 block text-xs">{error}</span>
        </Alert>
      ) : null}
      {!error && !messaging ? (
        <Alert tone="gray" className="mt-6 text-xs">
          사용자와의 대화 · 읽음 표시 · 확인 대기는 <code>supabase/migrations/0006_messages.sql</code> 을 적용해야 켜집니다. 지금은 예전처럼 답변 한 줄만 저장됩니다.
        </Alert>
      ) : null}

      {!error && batches.size === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">
          {tab === "todo" ? "지금 손댈 요청이 없습니다." : tab === "awaiting" ? "사용자의 답을 기다리는 요청이 없습니다." : "해당하는 요청이 없습니다."}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {[...batches.entries()].map(([batchId, list]) => {
          const first = list[0];
          return (
            <section key={batchId} className="rounded-md border border-ink-200 bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link href={href({ project: first.project?.id })} className="font-semibold hover:underline">
                    {first.project?.name ?? "(삭제된 프로젝트)"}
                  </Link>
                  {first.ownerEmail ? <span className="text-xs text-ink-500">{first.ownerEmail}</span> : null}
                  <span className="text-xs text-ink-500">{formatDateTime(first.created_at)}</span>
                  <span className="text-xs text-ink-400">묶음 {batchId.slice(0, 8)} · {list.length}건</span>
                </div>
                <BatchStatusSelect batchId={batchId} />
              </header>
              <ul className="divide-y divide-ink-100">
                {list
                  .slice()
                  .sort((a, b) => a.seq - b.seq)
                  .map((r) => {
                    const s = requestStatus(r.kind, r.status);
                    const last = r.lastEntry;
                    // 사람이 답하는 요청은 접수 뒤 72시간 안에 답한다 — 남은 시간을 보여 늦지 않게
                    const due = needsPerson(r.kind) && isOpenStatus(r.status) ? remainingLabel(r.created_at, r.kind) : null;
                    return (
                      <li key={r.id}>
                        <Link href={`/admin/requests/${r.id}`} className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                          <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{r.seq}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                              <span className="font-medium text-ink-900">{r.page?.name ?? "페이지"}</span>
                              <span>{r.page?.path}</span>
                              <span>{DEVICE_LABEL[r.device]}</span>
                              <Badge tone={REQUEST_KIND_TONE[r.kind]}>{REQUEST_KIND_LABEL[r.kind]}</Badge>
                              <Badge tone={s.tone}>{s.label}</Badge>
                              {r.unreadReplies > 0 ? <span className="rounded-sm bg-sky-400 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-night-950">새 답글 {r.unreadReplies}</span> : null}
                              {r.awaiting_user && isOpenStatus(r.status) ? <Badge tone="sky">사용자 답 대기</Badge> : null}
                              {r.kind === "ai" && r.tokens_used > 0 ? <span className="tabular-nums">{formatTokens(r.tokens_used)} 토큰</span> : null}
                              {due ? <span className={due.late ? "font-semibold text-mark" : "text-ink-500"}>{due.text}</span> : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm">{r.message}</p>
                            {last ? (
                              <p className="mt-1 line-clamp-1 text-xs text-ink-500">
                                <span className="font-medium text-ink-700">{last.author_role === "user" ? "사용자" : "담당자"}</span> {last.body ?? (last.status ? STATUS_EVENT_TEXT[last.status] : "")}
                              </p>
                            ) : r.resolution_note ? (
                              <p className="mt-1 line-clamp-1 text-xs text-ink-500">답변: {r.resolution_note}</p>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          );
        })}
      </div>
      <AutoRefresh seconds={45} />
    </div>
  );
}
