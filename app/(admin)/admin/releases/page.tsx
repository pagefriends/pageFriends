import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/messages/auto-refresh";
import { Alert, Badge } from "@/components/ui/card";
import { RELEASE_STAGE_ADMIN, isActiveRelease, releaseRemaining, releaseStage } from "@/config/releases";
import { listAdminReleases, type AdminReleaseListItem, type AdminReleaseTab } from "@/lib/releases";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "웹사이트 적용" };
export const dynamic = "force-dynamic";

const TABS: AdminReleaseTab[] = ["todo", "live", "cancelled", "all"];
const TAB_LABEL: Record<AdminReleaseTab, string> = { todo: "할 일", live: "적용 완료", cancelled: "취소", all: "전체" };

/**
 * 웹사이트 적용 요청 목록. 사용자가 "웹사이트에 적용 요청" 을 누르면 "할 일" 에 들어온다 (오래된 것부터).
 * 상세에서 ① 개발 서버 배포 → ② 개발 서버 확인 → ③ 운영 배포 순서로만 진행된다.
 */
export default async function AdminReleasesPage({ searchParams }: PageProps<"/admin/releases">) {
  const sp = await searchParams;
  const tab: AdminReleaseTab = TABS.includes(sp.tab as AdminReleaseTab) ? (sp.tab as AdminReleaseTab) : "todo";
  const projectId = typeof sp.project === "string" ? sp.project : undefined;

  let items: AdminReleaseListItem[] = [];
  let available = true;
  let counts: Partial<Record<AdminReleaseTab, number>> = {};
  let error: string | null = null;
  try {
    ({ items, available, counts } = await listAdminReleases(tab, projectId));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, project: projectId, ...patch })) if (v) q.set(k, v);
    return `/admin/releases?${q.toString()}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">웹사이트 적용</h1>
      <p className="mt-1 text-sm text-ink-500">
        사용자가 &lsquo;웹사이트에 적용 요청&rsquo; 을 누르면 여기로 옵니다. 바로 운영에 올리지 않고 ① 개발 서버에 먼저 배포해 ② 확인 목록을 모두 체크한 뒤에만 ③ 운영에 배포할 수 있습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <Link
            key={t}
            href={href({ tab: t })}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900")}
          >
            {TAB_LABEL[t]}
            {counts[t] !== undefined ? <span className="ml-1 text-xs tabular-nums text-ink-400">{counts[t]}</span> : null}
          </Link>
        ))}
        {projectId ? (
          <Link href={href({ project: undefined })} className="ml-auto self-center text-xs text-ink-500 hover:text-ink-900">
            사이트 필터 해제 ×
          </Link>
        ) : null}
      </div>

      {error ? (
        <Alert tone="red" className="mt-6">
          적용 요청을 불러오지 못했습니다.
          <span className="mt-1 block text-xs">{error}</span>
        </Alert>
      ) : null}
      {!error && !available ? (
        <Alert tone="gray" className="mt-6">
          웹사이트 적용을 쓰려면 Supabase SQL Editor 에서 <code>supabase/migrations/0007_releases.sql</code> 을 실행하세요.
        </Alert>
      ) : null}
      {!error && available && items.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">
          {tab === "todo" ? "지금 손댈 웹사이트 적용이 없습니다." : "해당하는 적용이 없습니다."}
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {items.map((r) => {
          const st = RELEASE_STAGE_ADMIN[releaseStage(r)];
          const due = isActiveRelease(r.status) ? releaseRemaining(r.requested_at) : null;
          return (
            <li key={r.id}>
              <Link href={`/admin/releases/${r.id}`} className="block rounded-md border border-ink-200 bg-surface px-4 py-3 hover:border-brand-400">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="font-semibold">{r.project?.name ?? "(삭제된 사이트)"}</span>
                  <span className="text-ink-500">{r.seq}번째 적용</span>
                  {r.first_publish ? <Badge tone="blue">첫 공개</Badge> : null}
                  {r.db_change ? <Badge tone="gray">폼·DB 변경</Badge> : null}
                  {due ? <span className={cn("text-xs", due.late ? "font-semibold text-mark" : "text-ink-500")}>{due.text}</span> : null}
                </div>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-500">
                  {r.ownerEmail ? <span>{r.ownerEmail}</span> : null}
                  <span>수정 {r.itemCount}건</span>
                  <span>요청 {formatDateTime(r.requested_at)}</span>
                  {r.staging_at ? <span>개발 서버 {formatDateTime(r.staging_at)}{r.staging_rounds > 1 ? ` (${r.staging_rounds}번째)` : ""}</span> : null}
                  {r.live_at ? <span>운영 {formatDateTime(r.live_at)}</span> : null}
                </p>
                {r.note ? <p className="mt-1 line-clamp-1 text-[13px] text-ink-700">사용자: {r.note}</p> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <AutoRefresh seconds={45} />
    </div>
  );
}
