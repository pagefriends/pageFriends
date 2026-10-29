import { DatabaseIcon, MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { deleteRowAction, saveRowAction } from "@/app/(app)/projects/[id]/admin/actions";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { DeleteRowButton, RowForm } from "@/components/site-admin/row-form";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { LIST_LAYOUT_LABEL, formatCell, type CollectionRow } from "@/lib/collections";
import { designOf } from "@/lib/design-doc";
import { getProject } from "@/lib/projects";
import { listRows } from "@/lib/site-db/data";
import { ensureSiteDatabase, getSiteDatabase, startSiteDatabase, type SiteDbInfo } from "@/lib/site-db/provision";
import { pageFullName } from "@/lib/site-plan";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "관리자 페이지" };
export const dynamic = "force-dynamic";
// 데이터 저장소 준비 확인(after)이 이 시간 안에 끝나야 한다
export const maxDuration = 300;

/**
 * 사이트 주인의 관리자 페이지: AI 가 만든 관리자 목록(공지 · 메뉴 · 상품 …)에 글을 올리고 고치고 지운다.
 * 목록 정의는 디자인 문서(collections), 글은 이 사이트 전용 Supabase 프로젝트의 표에 있다 (lib/site-db).
 * 목록은 편집 화면에서 AI 에게 "목록으로 만들고 관리자 페이지에서 관리하게 해 달라" 고 요청하면 생긴다.
 */
export default async function SiteAdminPage({ params, searchParams }: PageProps<"/projects/[id]/admin">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/projects/${id}/admin`);
  const data = await getProject(user.id, id);
  if (!data) notFound();
  const { plan } = await getSubscription(user.id);
  const design = designOf(data.project.brief);
  const collections = design.collections ?? [];
  const selected = collections.find((c) => c.key === sp.c) ?? collections[0] ?? null;
  const pageName = new Map((data.project.brief.site?.pages ?? []).map((p) => [p.path, pageFullName(p)]));

  let db: SiteDbInfo | null = null;
  try {
    db = await getSiteDatabase(id);
  } catch (e) {
    console.error("[site-admin] status", e);
  }
  // 목록이 있는데 저장소가 아직이면: 없으면 만들고, 켜지는 중이면 한 번 확인한다 (응답을 보낸 뒤 · 화면은 저절로 새로 고침)
  if (db?.available && db.configured && collections.length && plan?.cms) {
    if (db.status === "none") after(() => startSiteDatabase(id));
    else if (db.status === "creating" || db.status === "provisioning") after(() => ensureSiteDatabase(id).then(() => undefined));
  }
  const ready = db?.status === "ready";

  let rows: CollectionRow[] = [];
  let rowsError: string | null = null;
  if (ready && selected) {
    const res = await listRows(id, selected);
    if (res.ok) rows = res.rows;
    else rowsError = res.error;
  }
  const editRow = typeof sp.edit === "string" ? rows.find((r) => r.id === sp.edit) : undefined;
  const base = `/projects/${id}/admin${selected ? `?c=${selected.key}` : ""}`;
  const shown = selected?.fields.slice(0, 3) ?? [];
  const canEdit = Boolean(plan?.cms) && ready;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-ink-500 hover:text-ink-900">
          ← 편집 화면
        </Link>
        <Link href={`/projects/${id}/messages`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <MessageSquareIcon className="size-3.5" /> 메시지
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.project.name} · 관리자 페이지</h1>
      <p className="mt-1 text-sm text-ink-500">공지 · 메뉴 · 상품처럼 자주 바뀌는 목록을 여기서 직접 올리고 고쳐요. 올린 글은 사이트의 그 목록에 바로 보여요.</p>

      {!plan?.cms ? (
        <Alert tone="gray" className="mt-6">
          관리자 페이지(목록을 직접 올리고 고치기)는 비즈니스 플랜부터 쓸 수 있어요.{" "}
          <Link href="/billing" className="font-medium text-brand-600 underline">
            플랜 보기
          </Link>
        </Alert>
      ) : null}

      {collections.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="space-y-3 text-sm leading-relaxed text-ink-700">
            <p className="font-semibold text-ink-900">아직 관리자 목록이 없어요</p>
            <p>
              편집 화면에서 목록을 둘 곳에 빨간 네모를 그리고 <b>AI 반영</b>으로 이렇게 요청해 보세요. AI가 목록과 데이터 저장소, 이 관리자 페이지를 바로 만들어요.
            </p>
            <p className="rounded-md bg-ink-50 px-3 py-2 text-ink-800">&ldquo;이 페이지를 공지사항 목록으로 바꾸고, 관리자 페이지에서 제목 · 내용 · 날짜를 직접 올릴 수 있게 해 주세요.&rdquo;</p>
            <Link href={`/projects/${id}`} className={buttonClass("dark", "sm")}>
              편집 화면으로
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          <StatusNote db={db} />

          <nav className="mt-6 flex flex-wrap gap-2">
            {collections.map((c) => (
              <Link
                key={c.key}
                href={`/projects/${id}/admin?c=${c.key}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm",
                  c.key === selected?.key ? "border-ink-900 bg-ink-900 font-semibold text-ink-50" : "border-ink-200 bg-surface text-ink-700 hover:border-ink-400",
                )}
              >
                <DatabaseIcon className="size-3.5" /> {c.label}
              </Link>
            ))}
          </nav>

          {selected ? (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{selected.label}</CardTitle>
                  <span className="text-xs text-ink-500">
                    {LIST_LAYOUT_LABEL[selected.layout]} · {selected.page ? `${pageName.get(selected.page) ?? selected.page} 페이지에 보여요` : "관리자 페이지에만 있어요"}
                  </span>
                </CardHeader>
                <CardBody className="overflow-x-auto p-0">
                  {rowsError ? (
                    <p className="px-5 py-6 text-sm text-mark">글을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
                  ) : !ready ? (
                    <p className="px-5 py-10 text-center text-sm text-ink-500">데이터 저장소가 준비되면 여기에 글이 보여요.</p>
                  ) : rows.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-ink-500">아직 올린 글이 없어요. ‘새 글 올리기’에서 첫 글을 올려 보세요.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs text-ink-500">
                          {shown.map((f) => (
                            <th key={f.key} className="px-4 py-2.5 font-semibold">
                              {f.label}
                            </th>
                          ))}
                          <th className="px-4 py-2.5 font-semibold">상태</th>
                          <th className="px-4 py-2.5 font-semibold">올린 날</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className={cn("border-b border-ink-100 last:border-0", r.id === editRow?.id && "bg-sky-50")}>
                            {shown.map((f, i) => (
                              <td key={f.key} className={cn("max-w-64 truncate px-4 py-3", i === 0 ? "font-medium text-ink-900" : "text-ink-600")}>
                                {formatCell(f.type, r[f.key]) || <span className="text-ink-300">—</span>}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-4 py-3">{r.published ? <Badge tone="blue">보임</Badge> : <Badge>숨김</Badge>}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-500">{formatDateTime(r.created_at)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              {canEdit ? (
                                <span className="inline-flex items-center gap-3">
                                  <Link href={`${base}&edit=${r.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                                    고치기
                                  </Link>
                                  <DeleteRowButton remove={deleteRowAction.bind(null, id, selected.key, r.id)} />
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardBody>
              </Card>

              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>{editRow ? "글 고치기" : "새 글 올리기"}</CardTitle>
                </CardHeader>
                <CardBody>
                  {canEdit ? (
                    <RowForm
                      key={editRow?.id ?? "new"}
                      action={saveRowAction.bind(null, id, selected.key, editRow?.id ?? null)}
                      fields={selected.fields}
                      initial={editRow ? Object.fromEntries(selected.fields.map((f) => [f.key, f.type === "boolean" ? editRow[f.key] === true : formatInput(editRow[f.key])])) : undefined}
                      published={editRow ? editRow.published : true}
                      sort={editRow ? editRow.sort : 0}
                      editing={Boolean(editRow)}
                      doneHref={base}
                    />
                  ) : (
                    <p className="text-sm text-ink-500">{plan?.cms ? "데이터 저장소가 준비되면 글을 올릴 수 있어요." : "비즈니스 플랜부터 글을 올릴 수 있어요."}</p>
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** 폼 칸에 넣을 지금 값 (숫자 · 날짜도 글로) */
function formatInput(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** 데이터 저장소 상태 안내. 준비 중이면 화면을 저절로 새로 고친다 */
function StatusNote({ db }: { db: SiteDbInfo | null }) {
  if (!db || !db.available || !db.configured) {
    return (
      <Alert tone="gray" className="mt-6">
        관리자 페이지를 준비하고 있어요. 곧 글을 올릴 수 있어요.
      </Alert>
    );
  }
  if (db.status === "ready") return null;
  if (db.status === "failed") {
    return (
      <Alert tone="red" className="mt-6">
        데이터 저장소를 준비하지 못했어요. 담당자가 확인하고 있어요 — 궁금하면 메시지로 물어봐 주세요.
      </Alert>
    );
  }
  return (
    <Alert tone="blue" className="mt-6">
      이 사이트의 데이터 저장소를 준비하고 있어요 (보통 1~3분). 이 화면은 저절로 새로 고쳐져요.
      {db.createdAt ? <span className="ml-1 text-xs opacity-80">시작 {formatDateTime(db.createdAt)}</span> : null}
      <AutoRefresh seconds={8} />
    </Alert>
  );
}
