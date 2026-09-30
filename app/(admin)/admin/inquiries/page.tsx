import type { Metadata } from "next";
import Link from "next/link";

import { updateInquiryStatusAction } from "@/app/(admin)/admin/actions";
import { Alert, Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import type { InquiryKind, InquiryRow, InquiryStatus } from "@/lib/types/db";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "문의 관리" };
export const dynamic = "force-dynamic";

/**
 * 공개 사이트 폼 접수 목록 (상담 · 뉴스레터 · 전문가 지원 · 문의).
 * 읽기는 0005 의 "inquiries: admin select" RLS 정책, 상태 변경은 admin_update_inquiry RPC.
 */
const KIND_TABS: { key: InquiryKind | ""; label: string }[] = [
  { key: "", label: "전체" },
  { key: "consultation", label: "상담" },
  { key: "newsletter", label: "뉴스레터" },
  { key: "application", label: "전문가 지원" },
  { key: "contact", label: "문의" },
];
const KIND_LABEL: Record<InquiryKind, string> = { consultation: "상담", newsletter: "뉴스레터", application: "전문가 지원", contact: "문의" };
const KIND_TONE: Record<InquiryKind, "blue" | "sky" | "gray" | "dark"> = { consultation: "blue", newsletter: "gray", application: "sky", contact: "dark" };

const STATUS: Record<InquiryStatus, { label: string; tone: "blue" | "sky" | "gray" }> = {
  new: { label: "새 접수", tone: "blue" },
  contacted: { label: "연락함", tone: "sky" },
  closed: { label: "종료", tone: "gray" },
};

/** 폼별 추가 항목(payload)을 라벨과 함께 펼친다 */
const PAYLOAD_LABEL: Record<string, string> = { siteType: "사이트 종류", budget: "예산", urgency: "시급도", role: "지원 분야", portfolio: "포트폴리오", experience: "경력" };

function isKind(v: unknown): v is InquiryKind {
  return v === "consultation" || v === "newsletter" || v === "application" || v === "contact";
}

export default async function AdminInquiriesPage({ searchParams }: PageProps<"/admin/inquiries">) {
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : undefined;
  const flashError = typeof sp.error === "string" ? sp.error : null;
  const flashOk = sp.ok === "1";

  const supabase = await createClient();
  let q = supabase.from("inquiries").select("*").order("created_at", { ascending: false }).limit(300);
  if (kind) q = q.eq("kind", kind);
  const { data, error } = await q;
  const rows = ((data as InquiryRow[] | null) ?? []).slice();

  const counts: Record<InquiryStatus, number> = { new: 0, contacted: 0, closed: 0 };
  for (const r of rows) counts[r.status] += 1;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">문의</h1>
          <p className="mt-1 text-sm text-ink-500">
            새 접수 {counts.new} · 연락함 {counts.contacted} · 종료 {counts.closed}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-ink-200">
        {KIND_TABS.map((t) => (
          <Link
            key={t.key || "all"}
            href={t.key ? `/admin/inquiries?kind=${t.key}` : "/admin/inquiries"}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", (kind ?? "") === t.key ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {flashError ? (
        <Alert tone="red" className="mt-6">
          {flashError}
        </Alert>
      ) : null}
      {flashOk ? (
        <Alert tone="blue" className="mt-6">
          상태를 변경했습니다.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="red" className="mt-6">
          문의를 불러오지 못했습니다. <code>supabase/migrations/0005_inquiries.sql</code> 적용과 관리자 역할 지정을 확인하세요.
          <span className="mt-1 block text-xs">{error.message}</span>
        </Alert>
      ) : null}

      {!error && rows.length === 0 ? <p className="mt-8 rounded-md border border-dashed border-ink-300 bg-surface p-8 text-center text-sm text-ink-500">해당하는 접수가 없습니다.</p> : null}

      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => {
          const s = STATUS[r.status];
          const payload = Object.entries(r.payload ?? {}).filter(([, v]) => typeof v === "string" && v.trim() !== "") as [string, string][];
          return (
            <li key={r.id} className="rounded-md border border-ink-200 bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>
                  <Badge tone={s.tone}>{s.label}</Badge>
                  <span className="font-semibold">{r.name ?? "(이름 없음)"}</span>
                  <a href={`mailto:${r.email}`} className="text-ink-700 hover:underline">
                    {r.email}
                  </a>
                  {r.phone ? <span className="text-ink-500">{r.phone}</span> : null}
                  {r.company ? <span className="text-ink-500">{r.company}</span> : null}
                  <span className="text-xs text-ink-500">{formatDateTime(r.created_at)}</span>
                </div>
                <form action={updateInquiryStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="kind" value={kind ?? ""} />
                  <Select name="status" defaultValue={r.status} className="h-7 w-auto py-0 text-xs" aria-label="상태">
                    {(Object.keys(STATUS) as InquiryStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {STATUS[k].label}
                      </option>
                    ))}
                  </Select>
                  <button type="submit" className="h-7 rounded border border-ink-300 bg-surface px-2.5 text-xs font-medium text-ink-900 hover:border-ink-900">
                    변경
                  </button>
                </form>
              </div>
              {payload.length > 0 || r.message ? (
                <div className="px-4 py-3 text-sm">
                  {payload.length > 0 ? (
                    <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
                      {payload.map(([k, v]) => (
                        <div key={k} className="flex gap-1">
                          <dt className="font-medium text-ink-700">{PAYLOAD_LABEL[k] ?? k}</dt>
                          <dd>
                            {k === "portfolio" ? (
                              <a href={v} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                                {v}
                              </a>
                            ) : (
                              v
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {r.message ? <p className={cn("whitespace-pre-wrap text-ink-900", payload.length > 0 && "mt-2")}>{r.message}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
