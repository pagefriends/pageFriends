"use client";

import { DatabaseIcon, ExternalLinkIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startSiteDbAction, syncSiteDbAction, type SiteDbActionState } from "@/app/(admin)/admin/site-db-actions";
import { Badge } from "@/components/ui/card";
import { SITE_DB_MONTHLY_USD } from "@/config/site-db";
import { describeCollection, type Collection, type SchemaSnapshot } from "@/lib/collections";
import { cn, formatDateTime } from "@/lib/utils";

const STATUS: Record<string, { label: string; tone: "blue" | "sky" | "gray" | "red" }> = {
  none: { label: "없음", tone: "gray" },
  creating: { label: "만드는 중", tone: "sky" },
  provisioning: { label: "켜지는 중", tone: "sky" },
  ready: { label: "사용 중", tone: "blue" },
  failed: { label: "실패", tone: "red" },
  deleted: { label: "지움", tone: "gray" },
};

/** 관리자 "제작 정보" 의 사이트 데이터 저장소 칸: 상태 · Supabase 대시보드 링크 · 만들기/다시 시도 · 표 맞추기 · 관리자 목록 */
export function SiteDbPanel({
  projectId,
  info,
  collections,
}: {
  projectId: string;
  info: {
    available: boolean;
    configured: boolean;
    missing: string[];
    status: string;
    ref: string | null;
    region: string | null;
    error: string | null;
    createdAt: string | null;
    readyAt: string | null;
    schema: SchemaSnapshot;
    dashboardUrl: string | null;
  };
  collections: Collection[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<SiteDbActionState>(null);
  const run = (fn: () => Promise<SiteDbActionState>) =>
    start(async () => {
      setState(await fn());
      router.refresh();
    });
  const st = STATUS[info.status] ?? STATUS.none;
  const tables = Object.keys(info.schema);

  return (
    <div className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <DatabaseIcon className="size-4" /> 사이트 데이터 저장소
        </span>
        {!info.available ? (
          <span className="text-ink-500">0011_site_db.sql 을 먼저 실행해 주세요.</span>
        ) : (
          <>
            <Badge tone={st.tone}>{st.label}</Badge>
            {info.ref ? (
              <a href={info.dashboardUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-brand-600 hover:underline">
                {info.ref} <ExternalLinkIcon className="size-3" />
              </a>
            ) : null}
            {info.region ? <span className="text-xs text-ink-500">{info.region}</span> : null}
            {info.readyAt ? <span className="text-xs text-ink-500">준비 {formatDateTime(info.readyAt)}</span> : info.createdAt ? <span className="text-xs text-ink-500">시작 {formatDateTime(info.createdAt)}</span> : null}
            <span className="text-xs text-ink-400">Supabase Pro 조직 기준 월 약 ${SITE_DB_MONTHLY_USD}</span>
          </>
        )}
      </div>
      {info.available && !info.configured ? (
        <p className="mt-2 text-xs text-ink-500">만들 수 없는 설정입니다: {info.missing.join(", ") || "SITE_DB=off"} (.env.local)</p>
      ) : null}
      {info.error ? <p className="mt-2 text-xs text-mark">{info.error}</p> : null}
      {info.available && info.configured ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {info.status === "none" || info.status === "failed" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`이 사이트 전용 Supabase 프로젝트를 만들어요 (Pro 조직이면 매달 약 $${SITE_DB_MONTHLY_USD}). 계속할까요?`)) return;
                run(() => startSiteDbAction(projectId));
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <DatabaseIcon className="size-3.5" />}
              {info.status === "failed" ? "다시 시도" : "만들기"}
            </button>
          ) : null}
          {info.status === "creating" || info.status === "provisioning" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => startSiteDbAction(projectId))}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />} 준비 확인
            </button>
          ) : null}
          {info.status === "ready" && collections.length ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => syncSiteDbAction(projectId))}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />} 표 다시 맞추기
            </button>
          ) : null}
          {state ? <span className={cn("text-xs", state.ok ? "text-brand-700" : "text-mark")}>{state.message}</span> : null}
        </div>
      ) : null}
      {collections.length || tables.length ? (
        <ul className="mt-3 space-y-1 text-xs text-ink-600">
          {collections.map((c) => (
            <li key={c.key}>
              <span className="font-mono text-ink-900">{c.key}</span> · {describeCollection(c)}
              {!info.schema[c.key] ? <span className="ml-1 text-mark">(표 없음)</span> : null}
            </li>
          ))}
          {tables
            .filter((t) => !collections.some((c) => c.key === t))
            .map((t) => (
              <li key={t} className="text-ink-400">
                <span className="font-mono">{t}</span> · 숨긴 목록 (표와 글은 그대로)
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
