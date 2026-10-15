"use client";

import { ClipboardListIcon, ClockIcon, LockIcon, MessageSquareIcon, MonitorIcon, SmartphoneIcon, TabletIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { submitRequestsAction } from "@/app/(app)/projects/[id]/actions";
import { EditorCanvas, type CanvasHandle } from "@/components/editor/canvas";
import { RequestPanel } from "@/components/editor/request-panel";
import { draftKey, requestsBySlot, toRegion, type DraftBox, type EditorPage, type ExistingRequest, type SubmitItem } from "@/components/editor/types";
import { CountChip } from "@/components/messages/count-chip";
import { Badge } from "@/components/ui/card";
import { DELIVERY_DAYS, DEVICE_LABEL, type DeviceKind, type RequestKind } from "@/config/plans";
import type { ProjectNews } from "@/lib/messages";
import type { QuotaInfo } from "@/lib/quota";
import { imageRequestMessage } from "@/lib/site-plan";
import { cn } from "@/lib/utils";

const DEVICE_ORDER: DeviceKind[] = ["mobile", "tablet", "desktop"];
const NO_DRAFTS: DraftBox[] = [];
const DEVICE_ICON = { mobile: SmartphoneIcon, tablet: TabletIcon, desktop: MonitorIcon } as const;

/**
 * 프로젝트 편집 화면.
 * 왼쪽 사이드바: 위에 디바이스(모바일·태블릿·웹, 가로 한 줄) · 아래에 페이지 목록(세로).
 * 가운데: 캡처 캔버스 · 오른쪽: 요청 패널.
 * lg 미만에서는 상단 → 디바이스 → 페이지(가로 스크롤) → 캔버스 → 요청 패널 순으로 세로 스택.
 * 초안 네모는 페이지×디바이스 별로 따로 보관하고, "요청하기"는 전부 모아서 한 묶음(batch)으로 보낸다.
 * 상단의 "요청 내역" · "메시지" 는 담당자와의 대화로 가는 길이고, 옆의 숫자는 아직 확인하지 않은 것의 수다.
 */
export function ProjectEditor({
  projectId,
  projectName,
  pages,
  allowedDevices,
  existing,
  quota,
  hasPlan,
  news = null,
  demo = false,
  welcome = null,
}: {
  projectId: string;
  projectName: string;
  pages: EditorPage[];
  allowedDevices: DeviceKind[];
  existing: ExistingRequest[];
  quota: QuotaInfo;
  hasPlan: boolean;
  /** 이 사이트의 알림 수. 대화 기능을 쓸 수 없으면(체험 모드 포함) null — "메시지" 링크를 숨긴다 */
  news?: ProjectNews | null;
  demo?: boolean;
  /** 방금 만든 사이트의 첫 안내 */
  welcome?: { text: string; tone: "blue" | "red" } | null;
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
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  // 이미지 자리 목록에 마우스를 올린 자리 (캔버스에서 같이 강조)
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);

  // 첫 안내 주소(?created=1)는 새로 고침 때 다시 뜨지 않게 지운다. 보이던 안내는 닫을 때까지 남는다
  useEffect(() => {
    if (!welcome) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("created")) return;
    url.searchParams.delete("created");
    url.searchParams.delete("images");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [welcome]);

  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const shot = page?.screenshots[device];
  const key = draftKey(page?.id ?? "", device);
  const current = drafts[key] ?? NO_DRAFTS;

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

  // 이 페이지의 이미지 자리: 설명(위저드) + 이 화면에서의 위치 + 그 자리에 보낸 요청 + 이미 그린 초안 네모
  const slotItems = useMemo(() => {
    if (!page?.slots?.length || !shot?.slots?.length) return [];
    const sent = requestsBySlot(page, existing);
    const same = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
      Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;
    return page.slots.map((slot) => {
      const rects = (shot.slots ?? []).filter((r) => r.id === slot.id);
      // 이미지는 모든 화면에 같으므로 다른 화면에서 이미 그 자리에 네모를 그렸어도 그린 것으로 본다 (같은 요청을 두 번 보내지 않게)
      const drafted = DEVICE_ORDER.some((d) => {
        const rect = page.screenshots[d]?.slots?.find((r) => r.id === slot.id);
        return Boolean(rect && (drafts[draftKey(page.id, d)] ?? []).some((b) => same(b, rect)));
      });
      return { slot, rects, request: sent.get(slot.id) ?? null, drafted };
    });
  }, [page, shot, existing, drafts]);
  const highlights = hoveredSlot ? (slotItems.find((i) => i.slot.id === hoveredSlot)?.rects ?? []) : [];

  /** "AI로 만들기": 그 자리에 AI 반영 네모를 만들고 요청 글을 채워 둔다. 보내기 전에 고칠 수 있다 */
  const draftForSlot = (slotId: string) => {
    const item = slotItems.find((i) => i.slot.id === slotId);
    const r = item?.rects[0];
    if (!item || !r || item.drafted) return;
    const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setCurrent([...current, { id, x: r.x, y: r.y, w: r.w, h: r.h, kind: "ai", message: imageRequestMessage(item.slot) }]);
    setSelectedId(id);
    canvasRef.current?.focus(r);
  };

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
    setNotice(`${res.count}건을 접수했습니다. 담당자가 답하면 위쪽 종 아이콘과 요청 내역에 표시됩니다.`);
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
    <div
      className={cn(
        "flex min-h-[calc(100vh-64px)] flex-col lg:grid lg:h-[calc(100vh-64px)] lg:grid-cols-[220px_minmax(0,1fr)_340px]",
        // 첫 안내 줄이 있으면 행이 하나 늘어난다 (상단 · 안내 · 본문)
        welcome && welcomeOpen ? "lg:grid-rows-[auto_auto_minmax(0,1fr)]" : "lg:grid-rows-[auto_minmax(0,1fr)]",
      )}
    >
      {/* 상단: 프로젝트명 + 상태 */}
      <div className="flex h-11 items-center justify-between gap-3 border-b border-ink-200 bg-surface px-4 lg:col-span-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={demo ? "/" : "/dashboard"} className="shrink-0 text-xs whitespace-nowrap text-ink-500 hover:text-ink-900">
            ← {demo ? "홈" : "내 사이트"}
          </Link>
          <span className="truncate text-sm font-semibold">{projectName}</span>
          {demo ? <Badge tone="sky" className="shrink-0 whitespace-nowrap">체험 모드</Badge> : null}
          {shot.draft ? (
            <Badge tone="gray" className="shrink-0 whitespace-nowrap" title={`위저드에서 정한 메뉴·내용으로 그린 구성 초안입니다. 첫 완성본은 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 올라와요.`}>
              구성 초안
            </Badge>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-3 text-xs text-ink-500">
          {notice ? <span className="truncate text-brand-700">{notice}</span> : null}
          {!demo ? (
            <Link href={`/projects/${projectId}/brief`} className="hidden shrink-0 items-center gap-1 whitespace-nowrap hover:text-ink-900 sm:inline-flex" title="새 사이트를 만들 때 적은 내용 · 준비할 사진 목록">
              <ClipboardListIcon className="size-3.5" /> 제작 정보
            </Link>
          ) : null}
          {!demo ? (
            <Link href={`/projects/${projectId}/requests`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap hover:text-ink-900">
              <ClockIcon className="size-3.5" /> 요청 내역
              {news && news.unreadRequests + news.awaiting > 0 ? <CountChip strong={news.awaiting > 0}>{news.unreadRequests + news.awaiting}</CountChip> : null}
            </Link>
          ) : null}
          {!demo && news ? (
            <Link href={`/projects/${projectId}/messages`} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap hover:text-ink-900">
              <MessageSquareIcon className="size-3.5" /> 메시지
              {news.unreadGeneral > 0 ? <CountChip>{news.unreadGeneral}</CountChip> : null}
            </Link>
          ) : null}
        </div>
      </div>

      {welcome && welcomeOpen ? (
        <div
          className={cn(
            "flex items-start gap-3 border-b px-4 py-2.5 text-[13px] leading-relaxed lg:col-span-3",
            welcome.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-ink-900",
          )}
        >
          <p className="flex-1">{welcome.text}</p>
          <button type="button" onClick={() => setWelcomeOpen(false)} className="grid size-6 shrink-0 place-items-center rounded text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="안내 닫기">
            <XIcon className="size-3.5" />
          </button>
        </div>
      ) : null}

      {/* 왼쪽 사이드바: 디바이스(가로) + 페이지 목록(세로) */}
      <aside className="flex flex-col border-b border-ink-200 bg-surface lg:min-h-0 lg:border-r lg:border-b-0">
        <div className="border-b border-ink-100 px-3 pt-3 pb-2">
          <p className="mb-1.5 text-[11px] font-semibold text-ink-400">화면</p>
          <div className="grid grid-cols-3 gap-1">
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
                    "relative flex flex-col items-center gap-1 rounded py-2 text-[11px]",
                    device === d ? "bg-sky-400 text-night-950" : "text-ink-500 hover:bg-ink-100",
                    (!allowed || !hasShot) && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Icon className="size-5" />
                  {DEVICE_LABEL[d]}
                  {!allowed ? <LockIcon className="absolute top-1 right-1 size-3" /> : null}
                  {n > 0 ? <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center bg-mark text-[10px] text-white">{n}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-2">
          <p className="mb-1.5 text-[11px] font-semibold text-ink-400">페이지</p>
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-x-visible lg:overflow-y-auto">
            {pages.map((p, idx) => {
              const n = draftCountFor(p.id);
              const pending = existing.filter((r) => r.page_id === p.id && (r.status === "pending" || r.status === "processing")).length;
              const active = p.id === page.id;
              // 하위 페이지는 상위 메뉴 이름 아래에 들여 쓴다 (헤더 메뉴 구조 그대로)
              const groupStart = Boolean(p.group) && pages[idx - 1]?.group !== p.group;
              return (
                <Fragment key={p.id}>
                {groupStart ? (
                  <li className="flex shrink-0 items-center px-2.5 pt-1.5 text-[11px] font-semibold whitespace-nowrap text-ink-400 lg:shrink lg:pt-2 lg:pb-0.5">{p.group}</li>
                ) : null}
                <li className={cn("shrink-0 lg:shrink", p.group && "lg:pl-3")}>
                  <button
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
                      "flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-[13px] whitespace-nowrap",
                      active ? "bg-ink-900 text-ink-50" : "text-ink-700 hover:bg-ink-100",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {p.label ?? p.name}
                      <span className="ml-1.5 text-[11px] text-ink-400">{p.path}</span>
                    </span>
                    {n > 0 ? (
                      <span className="grid min-w-4 shrink-0 place-items-center bg-mark px-1 text-[10px] text-white" title="아직 보내지 않은 네모">
                        {n}
                      </span>
                    ) : null}
                    {pending > 0 ? (
                      <span className="grid min-w-4 shrink-0 place-items-center bg-brand-500 px-1 text-[10px] text-white" title="접수·처리중 요청">
                        {pending}
                      </span>
                    ) : null}
                  </button>
                </li>
                </Fragment>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* 가운데: 캔버스 (모바일은 화면 높이의 60%) */}
      <div className="relative h-[60vh] lg:h-auto lg:min-h-0">
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
          highlights={highlights}
          ref={canvasRef}
        />
      </div>

      {/* 오른쪽: 요청 패널 */}
      <div className="lg:min-h-0">
        <RequestPanel
          drafts={current}
          sent={existingHere}
          requestsHref={demo ? null : `/projects/${projectId}/requests`}
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
          slots={slotItems.map((i) => ({ slot: i.slot, located: i.rects.length > 0, request: i.request, drafted: i.drafted }))}
          hoveredSlot={hoveredSlot}
          onSlotHover={setHoveredSlot}
          onSlotFocus={(id) => {
            const r = slotItems.find((i) => i.slot.id === id)?.rects[0];
            if (r) canvasRef.current?.focus(r);
          }}
          onSlotAi={draftForSlot}
        />
      </div>
    </div>
  );
}
