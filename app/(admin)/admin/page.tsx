import type { Metadata } from "next";
import Link from "next/link";

import { BatchStatusSelect } from "@/components/admin/quick-actions";
import { Alert, Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL } from "@/config/plans";
import { countRequestsByStatus, listAdminRequests, type AdminRequestListItem } from "@/lib/admin";
import type { RequestStatus } from "@/lib/types/db";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "수정 요청 관리" };
export const dynamic = "force-dynamic";

const STATUS: Record<RequestStatus, { label: string; tone: "gray" | "blue" | "sky" | "dark" | "red" }> = {
  pending: { label: "접수", tone: "blue" },
  processing: { label: "처리중", tone: "sky" },
  done: { label: "반영 완료", tone: "dark" },
  rejected: { label: "반영 불가", tone: "red" },
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "open", label: "미처리" },
  { key: "pending", label: "접수" },
  { key: "processing", label: "처리중" },
  { key: "done", label: "반영 완료" },
  { key: "rejected", label: "반영 불가" },
  { key: "all", label: "전체" },
];

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const statusKey = typeof sp.status === "string" ? sp.status : "open";
  const kind = sp.kind === "ai" || sp.kind === "expert" ? sp.kind : undefined;
  const projectId = typeof sp.project === "string" ? sp.project : undefined;

  let items: AdminRequestListItem[] = [];
  let error: string | null = null;
  let counts = { pending: 0, processing: 0, done: 0, rejected: 0 };
  try {
    [items, counts] = await Promise.all([
      listAdminRequests({ status: statusKey === "all" ? undefined : (statusKey as RequestStatus | "open"), kind, projectId }),
      countRequestsByStatus(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // 묶음(batch) 단위로 그룹
  const batches = new Map<string, AdminRequestListItem[]>();
  for (const r of items) {
    const list = batches.get(r.batch_id) ?? [];
    list.push(r);
    batches.set(r.batch_id, list);
  }

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { status: statusKey, kind, project: projectId, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin?${q.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">수정 요청</h1>
          <p className="mt-1 text-sm text-ink-500">
            접수 {counts.pending} · 처리중 {counts.processing} · 완료 {counts.done} · 반영 불가 {counts.rejected}
          </p>
        </div>
        <div className="flex gap-1 rounded border border-ink-200 bg-surface p-1 text-[13px]">
          {(["", "ai", "expert"] as const).map((k) => (
            <Link key={k || "all"} href={href({ kind: k || undefined })} className={cn("rounded-sm px-3 py-1.5", (kind ?? "") === k ? "bg-ink-900 text-ink-50" : "text-ink-700 hover:bg-ink-100")}>
              {k ? REQUEST_KIND_LABEL[k] : "AI + 전문가"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-ink-200">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={href({ status: t.key })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", statusKey === t.key ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900")}
          >
            {t.label}
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

      {!error && batches.size === 0 ? <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">해당하는 요청이 없습니다.</p> : null}

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
                    const s = STATUS[r.status];
                    return (
                      <li key={r.id}>
                        <Link href={`/admin/requests/${r.id}`} className="flex gap-3 px-4 py-3 hover:bg-ink-50">
                          <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{r.seq}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                              <span className="font-medium text-ink-900">{r.page?.name ?? "페이지"}</span>
                              <span>{r.page?.path}</span>
                              <span>{DEVICE_LABEL[r.device]}</span>
                              <Badge tone={r.kind === "expert" ? "sky" : "gray"}>{REQUEST_KIND_LABEL[r.kind]}</Badge>
                              <Badge tone={s.tone}>{s.label}</Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm">{r.message}</p>
                            {r.resolution_note ? <p className="mt-1 line-clamp-1 text-xs text-ink-500">답변: {r.resolution_note}</p> : null}
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
    </div>
  );
}
