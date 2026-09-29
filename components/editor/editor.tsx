"use client";

import { ClockIcon, LockIcon, MonitorIcon, SmartphoneIcon, TabletIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { submitRequestsAction } from "@/app/(app)/projects/[id]/actions";
import { EditorCanvas } from "@/components/editor/canvas";
import { RequestPanel } from "@/components/editor/request-panel";
import { draftKey, toRegion, type DraftBox, type EditorPage, type ExistingRequest, type SubmitItem } from "@/components/editor/types";
import { Badge } from "@/components/ui/card";
import { DEVICE_LABEL, type DeviceKind, type RequestKind } from "@/config/plans";
import type { QuotaInfo } from "@/lib/quota";
import { cn } from "@/lib/utils";

const DEVICE_ORDER: DeviceKind[] = ["mobile", "tablet", "desktop"];
const DEVICE_ICON = { mobile: SmartphoneIcon, tablet: TabletIcon, desktop: MonitorIcon } as const;

/**
 * 프로젝트 편집 화면.
 * 왼쪽: 디바이스 선택(플랜별 허용) · 가운데: 캡처 캔버스 · 오른쪽: 요청 패널 · 아래: 페이지 경로 탭.
 * 초안 네모는 페이지×디바이스 별로 따로 보관하고, "한번에 요청하기"는 전부 모아서 한 묶음(batch)으로 보낸다.
 */
export function ProjectEditor({
  projectId,
  projectName,
  pages,
  allowedDevices,
  existing,
  quota,
  hasPlan,
  demo = false,
}: {
  projectId: string;
  projectName: string;
  pages: EditorPage[];
  allowedDevices: DeviceKind[];
  existing: ExistingRequest[];
  quota: QuotaInfo;
  hasPlan: boolean;
  demo?: boolean;
}) {
  const router = useRouter();
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [device, setDevice] = useState<DeviceKind>(allowedDevices.includes("desktop") ? "desktop" : allowedDevices[0]);
  const [drafts, setDrafts] = useState<Record<string, DraftBox[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 카드 ↔ 네모 상호 강조 (어느 요청이 어느 영역인지 한눈에)
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const shot = page?.screenshots[device];
  const key = draftKey(page?.id ?? "", device);
  const current = drafts[key] ?? [];

  const setCurrent = useCallback(
    (next: DraftBox[]) => {
      setDrafts((prev) => ({ ...prev, [key]: next }));
    },
    [key],
  );

  const existingHere = useMemo(
    () => existing.filter((r) => r.page_id === page?.id && r.device === device && (r.status === "pending" || r.status === "processing")),
    [existing, page?.id, device],
  );

  // 전체 초안 집계 (제출 버튼·한도 표시)
  const all = useMemo(() => {
    const items: SubmitItem[] = [];
    const counts: Record<RequestKind, number> = { ai: 0, expert: 0, bug: 0 };
    for (const p of pages) {
      for (const d of DEVICE_ORDER) {
        const s = p.screenshots[d];
        const list = drafts[draftKey(p.id, d)];
        if (!s || !list) continue;
        list.forEach((b, i) => {
          counts[b.kind] += 1;
          items.push({ page_id: p.id, device: d, kind: b.kind, seq: i + 1, region: toRegion(b, s), message: b.message.trim() });
        });
      }
    }
    return { items, counts };
  }, [drafts, pages]);

  const draftCountFor = (pid: string, d?: DeviceKind) =>
    d ? (drafts[draftKey(pid, d)]?.length ?? 0) : DEVICE_ORDER.reduce((n, dd) => n + (drafts[draftKey(pid, dd)]?.length ?? 0), 0);

  async function submit() {
    setError(null);
    setNotice(null);
    if (demo) {
      setNotice(`체험 모드입니다. 실제로는 ${all.items.length}건이 접수됩니다. 회원가입 후 프로젝트를 만들어 보세요.`);
      return;
    }
    setSubmitting(true);
    const res = await submitRequestsAction(projectId, all.items);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDrafts({});
    setSelectedId(null);
    setNotice(`${res.count}건의 수정 요청을 접수했습니다. 반영되면 알려드립니다.`);
    router.refresh();
  }

  if (!page || !shot) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-sm text-ink-500">
        {pages.length === 0 ? "아직 페이지가 없습니다. 제작이 시작되면 캡처가 올라옵니다." : "이 화면의 캡처가 아직 없습니다."}
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-64px)] grid-cols-[72px_minmax(0,1fr)_340px] grid-rows-[auto_minmax(0,1fr)_auto]">
      {/* 상단: 프로젝트명 + 상태 */}
      <div className="col-span-3 flex h-11 items-center justify-between border-b border-ink-200 bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link href={demo ? "/" : "/dashboard"} className="text-xs text-ink-500 hover:text-ink-900">
            ← {demo ? "홈" : "내 사이트"}
          </Link>
          <span className="text-sm font-semibold">{projectName}</span>
          {demo ? <Badge tone="sky">체험 모드</Badge> : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-500">
          {notice ? <span className="text-brand-700">{notice}</span> : null}
          {!demo ? (
            <Link href={`/projects/${projectId}/requests`} className="inline-flex items-center gap-1 hover:text-ink-900">
              <ClockIcon className="size-3.5" /> 요청 내역
            </Link>
          ) : null}
        </div>
      </div>

      {/* 왼쪽: 디바이스 */}
      <div className="flex flex-col items-center gap-1 border-r border-ink-200 bg-surface py-3">
        {DEVICE_ORDER.map((d) => {
          const Icon = DEVICE_ICON[d];
          const allowed = allowedDevices.includes(d);
          const hasShot = Boolean(page.screenshots[d]);
          const n = draftCountFor(page.id, d);
          return (
            <button
              key={d}
              type="button"
              disabled={!allowed || !hasShot}
              onClick={() => {
                setDevice(d);
                setSelectedId(null);
              }}
              title={!allowed ? "비즈니스 플랜 이상에서 사용 가능" : !hasShot ? "캡처 준비 중" : DEVICE_LABEL[d]}
              className={cn(
                "relative flex w-14 flex-col items-center gap-1 rounded py-2 text-[11px]",
                device === d ? "bg-sky-400 text-night-950" : "text-ink-500 hover:bg-ink-100",
                (!allowed || !hasShot) && "cursor-not-allowed opacity-40",
              )}
            >
              <Icon className="size-5" />
              {DEVICE_LABEL[d]}
              {!allowed ? <LockIcon className="absolute right-1 top-1 size-3" /> : null}
              {n > 0 ? <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center bg-mark text-[10px] text-white">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {/* 가운데: 캔버스 */}
      <div className="relative min-h-0">
        <EditorCanvas
          key={`${page.id}:${device}`}
          screenshot={shot}
          drafts={current}
          existing={existingHere}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onDraftsChange={setCurrent}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          defaultKind="ai"
        />
      </div>

      {/* 오른쪽: 요청 패널 (아래 탭 행까지 차지) */}
      <div className="row-span-2 min-h-0">
        <RequestPanel
          drafts={current}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          onChange={(id, patch) => setCurrent(current.map((d) => (d.id === id ? { ...d, ...patch } : d)))}
          onRemove={(id) => {
            setCurrent(current.filter((d) => d.id !== id));
            if (selectedId === id) setSelectedId(null);
          }}
          totalCount={all.items.length}
          counts={all.counts}
          quota={quota}
          hasPlan={hasPlan}
          submitting={submitting}
          onSubmit={submit}
          error={error}
          demo={demo}
        />
      </div>

      {/* 아래: 페이지 경로 탭 */}
      <div className="col-span-2 flex h-11 items-center gap-1 overflow-x-auto border-t border-ink-200 bg-surface px-3">
        <span className="mr-2 shrink-0 text-[11px] text-ink-400">페이지</span>
        {pages.map((p) => {
          const n = draftCountFor(p.id);
          const pending = existing.filter((r) => r.page_id === p.id && (r.status === "pending" || r.status === "processing")).length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPageId(p.id);
                setSelectedId(null);
                if (!p.screenshots[device]) {
                  const first = DEVICE_ORDER.find((d) => allowedDevices.includes(d) && p.screenshots[d]);
                  if (first) setDevice(first);
                }
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-3 text-[13px]",
                p.id === page.id ? "bg-ink-900 text-ink-50" : "text-ink-700 hover:bg-ink-100",
              )}
            >
              {p.name}
              <span className={cn("text-[11px]", p.id === page.id ? "text-ink-400" : "text-ink-400")}>{p.path}</span>
              {n > 0 ? <span className="grid min-w-4 place-items-center bg-mark px-1 text-[10px] text-white">{n}</span> : null}
              {pending > 0 ? <span className="grid min-w-4 place-items-center bg-brand-500 px-1 text-[10px] text-white">{pending}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
