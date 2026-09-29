import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, formatTokens, type RequestKind } from "@/config/plans";
import { requireUser } from "@/lib/auth/session";
import { getProject, listProjectRequests } from "@/lib/projects";
import type { RequestStatus } from "@/lib/types/db";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<RequestKind, "gray" | "sky" | "red"> = { ai: "gray", expert: "sky", bug: "red" };

const STATUS: Record<RequestStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" | "red" }> = {
  pending: { label: "접수", tone: "blue" },
  processing: { label: "처리중", tone: "sky" },
  done: { label: "반영 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

/** 요청 내역. 한 번에 보낸 묶음(batch) 단위로 묶어 보여준다. */
export default async function RequestsPage({ params }: PageProps<"/projects/[id]/requests">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}/requests`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const requests = await listProjectRequests(id);
  const pageName = new Map(data.pages.map((p) => [p.id, p.name]));

  const batches = new Map<string, typeof requests>();
  for (const r of requests) {
    const list = batches.get(r.batch_id) ?? [];
    list.push(r);
    batches.set(r.batch_id, list);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
        ← 편집 화면
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.project.name} · 요청 내역</h1>
      <p className="mt-1 text-sm text-ink-500">총 {requests.length}건. AI 반영은 보통 몇 시간, 전문가 요청은 1~2 영업일 안에 처리됩니다. 오류 신고는 무료입니다.</p>

      {batches.size === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">아직 보낸 요청이 없습니다.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {[...batches.entries()].map(([batchId, items]) => (
            <section key={batchId} className="rounded-md border border-ink-200 bg-surface">
              <header className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 text-xs text-ink-500">
                <span>{formatDateTime(items[0].created_at)} · {items.length}건</span>
                <span className="font-mono">{batchId.slice(0, 8)}</span>
              </header>
              <ul className="divide-y divide-ink-100">
                {items
                  .slice()
                  .sort((a, b) => a.seq - b.seq)
                  .map((r) => {
                    const s = STATUS[r.status];
                    return (
                      <li key={r.id} className="flex gap-3 px-4 py-3">
                        <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{r.seq}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                            <span className="font-medium text-ink-900">{pageName.get(r.page_id) ?? "페이지"}</span>
                            <span>{DEVICE_LABEL[r.device]}</span>
                            <Badge tone={KIND_TONE[r.kind]}>{REQUEST_KIND_LABEL[r.kind]}</Badge>
                            <Badge tone={s.tone}>{s.label}</Badge>
                            {r.kind === "ai" && r.tokens_used > 0 ? <span className="tabular-nums">{formatTokens(r.tokens_used)} 토큰</span> : null}
                            {r.kind === "bug" ? <span>무료</span> : null}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{r.message}</p>
                          {r.resolution_note ? <p className="mt-1 text-xs text-ink-500">답변: {r.resolution_note}</p> : null}
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
