"use client";

import { ClipboardListIcon, ClockIcon, LoaderCircleIcon, LockIcon, MessageSquareIcon, MonitorIcon, RefreshCwIcon, RocketIcon, SmartphoneIcon, SparklesIcon, TabletIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { aiStatusAction, submitRequestsAction } from "@/app/(app)/projects/[id]/actions";
import { AiLivePanel } from "@/components/editor/ai-live-panel";
import { EditorCanvas, type CanvasHandle, type Flash, type LiveLabel } from "@/components/editor/canvas";
import { RequestPanel } from "@/components/editor/request-panel";
import { draftKey, requestsBySlot, shotVersion, toRegion, type DraftBox, type EditorPage, type EditorTemplate, type ExistingRequest, type SubmitItem } from "@/components/editor/types";
import { CountChip } from "@/components/messages/count-chip";
import { Badge } from "@/components/ui/card";
import { AI_LIVE_POLL_MS } from "@/config/ai";
import type { StyleId } from "@/config/design-styles";
import { DEVICE_LABEL, EXPERT_HOURS, type DeviceKind, type RequestKind } from "@/config/plans";
import type { BatchProgress, LiveItem } from "@/lib/ai/progress";
import type { ProjectNews } from "@/lib/messages";
import type { QuotaInfo } from "@/lib/quota";
import { imageRequestMessage } from "@/lib/site-plan";
import { cn } from "@/lib/utils";

const DEVICE_ORDER: DeviceKind[] = ["mobile", "tablet", "desktop"];
const NO_DRAFTS: DraftBox[] = [];
const DEVICE_ICON = { mobile: SmartphoneIcon, tablet: TabletIcon, desktop: MonitorIcon } as const;

/** 초안 네모 id (화면에서 누를 때만 만든다) */
function newDraftId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 프로젝트 편집 화면.
 * 왼쪽 사이드바: 위에 디바이스(모바일·태블릿·웹, 가로 한 줄) · 아래에 페이지 목록(세로).
 * 가운데: 캡처 캔버스 · 오른쪽: 요청 패널.
 * lg 미만에서는 상단 → 디바이스 → 페이지(가로 스크롤) → 캔버스 → 요청 패널 순으로 세로 스택.
 * 초안 네모는 페이지×디바이스 별로 따로 보관하고, "요청하기"는 전부 모아서 한 묶음(batch)으로 보낸다.
 * 상단의 "요청 내역" · "메시지" 는 담당자와의 대화로 가는 길이고, 옆의 숫자는 아직 확인하지 않은 것의 수다.
 * 상단의 "웹사이트에 적용" 은 끝난 수정을 실제 웹사이트에 올려 달라고 요청하는 곳이다 (숫자 = 아직 올라가지 않은 수정).
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
  buildNote = null,
  website = null,
  siteStyles = [],
  templates = [],
  ai = null,
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
  /** 누가 만드는지 · 전문가 제작이면 첫 완성본 기한 (구성 초안 배지에 붙는다) */
  buildNote?: string | null;
  /**
   * 웹사이트 적용 상태. waiting = 끝났지만 아직 실제 웹사이트에 올라가지 않은 수정 수, active = 진행 중인 적용의 단계 이름("적용 점검 중" 등),
   * ready = 제작이 끝나 적용을 요청할 수 있는 사이트. 기능을 쓸 수 없으면(체험 모드 · 0007 적용 전) null
   */
  website?: { waiting: number; active: string | null; published: boolean; ready: boolean } | null;
  /** 사이트의 디자인 유형 (AI 반영 네모의 기본값) */
  siteStyles?: StyleId[];
  /** 참고 템플릿으로 붙일 수 있는 템플릿 (구매한 것만 고를 수 있다) */
  templates?: EditorTemplate[];
  /**
   * AI 엔진 상태. enabled = 키가 있어 AI 가 바로 처리한다 · version = 지금 디자인 버전 · pending = 첫 제작 중 · open = 진행 중인 AI 반영 네모 수 ·
   * batchId = AI 가 지금 처리 중인 묶음 (새로 고침해도 "AI 작업 중" 화면을 이어서 보여 준다). 체험 모드 · 예전 사이트는 null
   */
  ai?: { enabled: boolean; version: number; pending: boolean; open: number; batchId?: string | null } | null;
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
  // AI 진행 상황: 서버의 최신 디자인 버전 · 첫 제작 중 · 진행 중인 AI 네모 수 (몇 초마다 확인)
  const [live, setLive] = useState(ai ? { version: ai.version, pending: ai.pending, open: ai.open } : null);
  const [watch, setWatch] = useState(Boolean(ai?.enabled && (ai.pending || ai.open > 0)));
  // 보고 있는 화면이 그려진 디자인 버전 (props 가 바뀌면 = 새로 고침하면 따라간다)
  const shownVersion = ai?.version ?? 0;
  const newer = Boolean(live && live.version > shownVersion);
  // 지난번에 확인한 "AI 가 맡은 네모 수". 줄면 AI 가 일을 마친 것이다 (반영 · 질문 · 담당자에게 넘김)
  const lastOpen = useRef(ai?.open ?? 0);

  // ----- AI 작업 중 화면 -----
  // 요청하기로 보낸 묶음을 AI 가 하나씩 고치는 동안: 1초마다 진행 상황을 읽고, 화면이 바뀔 때마다 바로 새로 그리고,
  // 고치는 네모를 따라 페이지 · 화면을 옮긴다. 그동안 캔버스는 잠긴다 (네모를 그릴 수 없다)
  const [liveBatch, setLiveBatch] = useState<string | null>(ai?.enabled && !demo ? (ai.batchId ?? null) : null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  // 방금 반영한 곳 (네모 위치는 0~1 비율 — 화면 높이가 바뀌어도 그릴 때 맞춘다)
  const [flashes, setFlashes] = useState<{ pageId: string; device: DeviceKind; region: { x: number; y: number; w: number; h: number }; label: string; until: number }[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // 같은 페이지 · 화면 안에서 다른 네모로 옮길 때도 화면 이동이 일어나게
  const [focusTick, setFocusTick] = useState(0);
  const prevStates = useRef(new Map<string, LiveItem["state"]>());
  const refreshedFor = useRef(0);
  const followed = useRef<string | null>(null);
  const pendingFocus = useRef<{ pageId: string; device: DeviceKind; region: { x: number; y: number; w: number; h: number } } | null>(null);
  const locked = Boolean(liveBatch);

  /** 그 네모가 있는 페이지 · 화면으로 옮기고 네모가 보이게 한다 */
  const followItem = useCallback(
    (it: Pick<LiveItem, "id" | "pageId" | "device" | "region">) => {
      const target = pages.find((p) => p.id === it.pageId);
      if (!target?.screenshots[it.device] || !allowedDevices.includes(it.device)) return;
      setFocusedId(it.id);
      pendingFocus.current = { pageId: it.pageId, device: it.device, region: it.region };
      setPageId(it.pageId);
      setDevice(it.device);
      setSelectedId(null);
      setFocusTick((t) => t + 1);
    },
    [pages, allowedDevices],
  );

  /** 1초마다 받은 진행 상황 처리: 새 화면 읽기 · 고치는 네모 따라가기 · 방금 반영한 곳 표시 */
  const onProgress = (p: BatchProgress) => {
    setOffsetMs(Date.now() - Date.parse(p.now));
    setProgress(p);
    // 디자인이 바뀌었으면 바로 새로 그린다 (작업 중에는 그리던 네모가 없으므로 묻지 않는다)
    if (p.version > shownVersion && refreshedFor.current < p.version) {
      refreshedFor.current = p.version;
      router.refresh();
    }
    // 고치는 네모(없으면 다음 차례)를 따라간다
    const target = p.items.find((i) => i.state === "working") ?? (p.done ? undefined : p.items.find((i) => i.state === "queued"));
    if (target && followed.current !== target.id) {
      followed.current = target.id;
      followItem(target);
    }
    const now = Date.now();
    const fresh = p.items
      .filter((it) => {
        const before = prevStates.current.get(it.id);
        return before !== undefined && before !== "done" && it.state === "done";
      })
      .map((it) => ({ pageId: it.pageId, device: it.device, region: it.region, label: `반영됨 #${it.seq}`, until: now + 6000 }));
    for (const it of p.items) prevStates.current.set(it.id, it.state);
    if (fresh.length) setFlashes((f) => [...f.filter((x) => x.until > now), ...fresh]);
  };
  // 읽기 타이머는 묶음이 바뀔 때만 다시 거는데, 처리는 늘 최신 화면 값으로 해야 한다
  const onProgressRef = useRef(onProgress);
  useLayoutEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    if (!liveBatch || demo) return;
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/ai-progress?batch=${liveBatch}`, { cache: "no-store" });
        if (stop) return;
        if (r.status === 404) {
          setLiveBatch(null);
          return;
        }
        if (r.ok) {
          const p = (await r.json()) as BatchProgress;
          if (stop) return;
          onProgressRef.current(p);
          if (p.done) return; // 다 끝나면 더 읽지 않는다 (결과는 그대로 둔다)
        }
      } catch {
        // 잠깐 끊겨도 다음 번에 다시 읽는다
      }
      if (!stop) timer = window.setTimeout(tick, AI_LIVE_POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [liveBatch, demo, projectId]);

  // 표시가 끝난 "반영됨" 지우기
  useEffect(() => {
    if (!flashes.length) return;
    const t = window.setTimeout(() => setFlashes((f) => f.filter((x) => x.until > Date.now())), 1000);
    return () => window.clearTimeout(t);
  }, [flashes]);

  // 페이지 · 화면을 옮긴 뒤(캔버스가 새로 그려진 뒤) 그 네모로 화면 이동
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f || f.pageId !== pageId || f.device !== device) return;
    const s = pages.find((p) => p.id === pageId)?.screenshots[device];
    if (!s) return;
    pendingFocus.current = null;
    const raf = window.requestAnimationFrame(() =>
      canvasRef.current?.focus({ x: f.region.x * s.width, y: f.region.y * s.height, w: f.region.w * s.width, h: f.region.h * s.height }),
    );
    return () => window.cancelAnimationFrame(raf);
  }, [pageId, device, pages, focusTick]);

  /**
   * "이상해요 · 오류 신고": 작업 화면을 닫고 그 네모 자리에 오류 신고 네모를 만들어 둔다.
   * 고객이 무엇이 이상한지 적고 요청하기를 누르면 오류 확인 AI 가 먼저 본다 (최근 AI 변경이면 되돌린다)
   */
  const reportProblem = (it: LiveItem) => {
    const target = pages.find((p) => p.id === it.pageId);
    const s = target?.screenshots[it.device];
    if (!target || !s) return;
    closeLive();
    const id = newDraftId();
    const box: DraftBox = {
      id,
      x: it.region.x * s.width,
      y: it.region.y * s.height,
      w: it.region.w * s.width,
      h: it.region.h * s.height,
      kind: "bug",
      message: `AI가 "${it.message.slice(0, 40)}" 요청을 반영한 뒤 이상해요: `,
    };
    const k = draftKey(it.pageId, it.device);
    setDrafts((prev) => ({ ...prev, [k]: [...(prev[k] ?? []), box] }));
    setPageId(it.pageId);
    setDevice(it.device);
    setSelectedId(id);
    setNotice("오류 신고 네모를 만들었어요. 무엇이 이상한지 적고 요청하기를 눌러 주세요. AI가 먼저 확인해요 (무료).");
  };

  /** 작업 화면 닫기: 끝났으면 결과를 읽어 오고, 아직 진행 중이면 예전처럼 위쪽 표시로 계속 알려 준다 */
  const closeLive = () => {
    const stillWorking = progress ? !progress.done : true;
    setLiveBatch(null);
    setProgress(null);
    setFlashes([]);
    setFocusedId(null);
    followed.current = null;
    prevStates.current.clear();
    if (stillWorking) setWatch(true);
    router.refresh();
  };

  useEffect(() => {
    if (!ai?.enabled || demo || !watch || liveBatch) return;
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const s = await aiStatusAction(projectId).catch(() => null);
      if (stop || !s) return;
      const finished = s.aiOpen < lastOpen.current;
      lastOpen.current = s.aiOpen;
      setLive({ version: s.version, pending: s.aiPending, open: s.aiOpen });
      const done = !s.aiPending && s.aiOpen === 0;
      // 화면(디자인 버전)은 그대로인데 AI 가 질문하거나 담당자에게 넘겼으면 요청 목록 · 상태만 새로 읽는다 (그리던 네모는 남는다).
      // 화면이 바뀌었으면 "새 화면 보기" 를 누를 때 새로 읽는다
      if ((finished || done) && s.version === shownVersion) router.refresh();
      if (done) {
        setWatch(false);
        setNotice((n) => (n ? "AI가 처리를 마쳤어요. 결과는 아래 '보낸 요청' 과 각 요청의 대화에서 볼 수 있어요." : n));
      }
    };
    const timer = window.setInterval(tick, 6000);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ai?.enabled, demo, watch, projectId, shownVersion, router, liveBatch]);

  /** 새 화면으로 바꾼다. 옛 화면에 그린 네모는 위치가 맞지 않으므로 지운다 (남은 게 있으면 묻는다) */
  const showNewVersion = () => {
    const left = Object.values(drafts).reduce((n, l) => n + l.length, 0);
    if (left > 0 && !window.confirm(`새 화면에서는 지금 그린 네모 ${left}개의 위치가 맞지 않아 지워져요. 새 화면을 볼까요?`)) return;
    setDrafts({});
    setSelectedId(null);
    setError(null);
    setNotice(null);
    router.refresh();
  };

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
  // 올린 사진은 그 자리 위에 겹쳐 보여 준다. 여러 장짜리 자리는 n번째 사진을 n번째 칸에
  const photoOverlays = slotItems.flatMap((i) =>
    (i.slot.photos ?? []).slice(0, i.rects.length).map((ph, n) => ({ ...i.rects[n], url: ph.url, label: `${i.slot.label} ${n + 1}` })),
  );

  /** "AI로 만들기": 그 자리에 AI 반영 네모를 만들고 요청 글을 채워 둔다. 보내기 전에 고칠 수 있다 */
  const draftForSlot = (slotId: string) => {
    const item = slotItems.find((i) => i.slot.id === slotId);
    const r = item?.rects[0];
    if (!item || !r || item.drafted) return;
    const id = newDraftId();
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
          const options = b.kind === "ai" && (b.styles !== undefined || b.templateId) ? { styles: b.styles ?? [], templateId: b.templateId ?? null } : undefined;
          items.push({ page_id: p.id, device: d, kind: b.kind, seq: i + 1, region: toRegion(b, s), message: b.message.trim(), version: shotVersion(s.url), ...(options ? { options } : {}) });
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
    const sentCounts = all.counts;
    const res = await submitRequestsAction(projectId, all.items);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      // 그사이 AI 가 화면을 바꿨다 — 새 화면 보기 안내가 뜨게 바로 확인한다
      if (res.stale) setWatch(true);
      return;
    }
    setDrafts({});
    setSelectedId(null);
    router.refresh();
    // AI 가 바로 처리하면 "AI 작업 중" 화면으로 지켜본다 (사람 몫은 패널 아래에 같이 알려 준다)
    if (res.aiStarted) {
      prevStates.current.clear();
      followed.current = null;
      refreshedFor.current = 0;
      setProgress(null);
      setLiveBatch(res.batchId);
      return;
    }
    // 사람이 보는 요청(전문가 · 오류 신고)은 답변 기한을 알려 준다
    const person = sentCounts.expert + sentCounts.bug;
    const parts = [
      sentCounts.ai > 0 ? `AI 반영 ${sentCounts.ai}건은 담당자가 처리해요` : null,
      person > 0 ? `전문가 요청 ${person}건은 ${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간 안에 답변드려요` : null,
    ].filter(Boolean);
    setNotice(`${res.count}건을 접수했어요. ${parts.join(" · ")}.`);
  }

  if (!page || !shot) {
    return (
      <div className="grid flex-1 place-items-center p-10 text-sm text-ink-500">
        {pages.length === 0 ? "아직 페이지가 없습니다. 제작이 시작되면 캡처가 올라옵니다." : "이 화면의 캡처가 아직 없습니다."}
      </div>
    );
  }

  // AI 안내 줄: 새 화면이 준비됨 > 첫 제작 중 (AI 작업 중 화면에서는 화면이 알아서 바뀌므로 띄우지 않는다)
  const aiBanner = !demo && ai?.enabled && !liveBatch ? (newer ? "newer" : live?.pending ? "building" : null) : null;
  const showBanner = Boolean((welcome && welcomeOpen) || aiBanner);

  // AI 작업 중: 이 화면에 있는 보낸 네모의 라벨을 진행 상황으로 · 방금 반영한 곳.
  // 고치는 네모가 없으면 첫 대기 네모를 엔진이 확인하는 중이다
  const liveNextId = progress && !progress.done && !progress.items.some((i) => i.state === "working") ? progress.items.find((i) => i.state === "queued")?.id : undefined;
  const liveLabels: Record<string, LiveLabel> | undefined = progress
    ? Object.fromEntries(
        progress.items
          .filter((i) => i.state === "working" || i.state === "queued")
          .map((i) => [
            i.id,
            i.state === "working"
              ? { text: i.kind === "bug" ? "AI 오류 확인 중" : "AI 고치는 중", tone: "active" as const }
              : i.id === liveNextId
                ? { text: "AI 확인 중", tone: "active" as const }
                : { text: `대기 ${i.order}번째`, tone: "queued" as const },
          ]),
      )
    : undefined;
  const flashesHere: Flash[] = flashes
    .filter((f) => f.pageId === page.id && f.device === device)
    .map((f) => ({ x: f.region.x * shot.width, y: f.region.y * shot.height, w: f.region.w * shot.width, h: f.region.h * shot.height, label: f.label }));
  const liveDone = progress ? progress.items.filter((i) => i.state !== "queued" && i.state !== "working").length : 0;

  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-64px)] flex-col lg:grid lg:h-[calc(100vh-64px)] lg:grid-cols-[220px_minmax(0,1fr)_340px]",
        // 안내 줄이 있으면 행이 하나 늘어난다 (상단 · 안내 · 본문)
        showBanner ? "lg:grid-rows-[auto_auto_minmax(0,1fr)]" : "lg:grid-rows-[auto_minmax(0,1fr)]",
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
            <Badge tone="gray" className="shrink-0 whitespace-nowrap" title={buildNote ?? "위저드에서 정한 메뉴·내용으로 그린 구성 초안입니다."}>
              구성 초안
            </Badge>
          ) : null}
          {buildNote ? <span className="hidden truncate text-xs text-ink-500 xl:inline">{buildNote}</span> : null}
        </div>
        <div className="flex min-w-0 items-center gap-3 text-xs text-ink-500">
          {notice ? <span className="truncate text-brand-700">{notice}</span> : null}
          {liveBatch ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold text-sky-700" title="AI 가 보낸 네모를 하나씩 고치고 있어요">
              {progress?.done ? <SparklesIcon className="size-3.5" /> : <LoaderCircleIcon className="size-3.5 animate-spin" />}
              {progress?.done ? "AI 작업 끝" : "AI 작업 중"} {progress ? `${liveDone}/${progress.items.length}` : ""}
            </span>
          ) : !demo && ai?.enabled && live && live.open > 0 && !newer ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-brand-700" title="AI 반영 네모를 AI 가 처리하고 있어요">
              <LoaderCircleIcon className="size-3.5 animate-spin" /> AI 반영 중 {live.open}건
            </span>
          ) : null}
          {!demo && website ? (
            <Link
              href={`/projects/${projectId}/apply`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 whitespace-nowrap",
                // 올릴 것이 있으면 눈에 띄게 (끝난 수정이 있거나, 아직 한 번도 공개하지 않은 완성 사이트)
                !website.active && website.ready && (website.waiting > 0 || !website.published)
                  ? "rounded-full bg-sky-400 px-2.5 py-1 font-semibold text-night-950 hover:bg-sky-300"
                  : "hover:text-ink-900",
              )}
              title="끝난 수정을 실제 웹사이트에 올려 달라고 요청해요. 담당자가 확인용 서버에서 먼저 점검한 뒤 적용해요."
            >
              <RocketIcon className="size-3.5" />
              {website.active ?? (website.ready && website.waiting > 0 ? "웹사이트에 적용" : website.ready && !website.published ? "웹사이트 공개 요청" : "웹사이트 적용")}
              {!website.active && website.waiting > 0 ? <CountChip strong>{website.waiting}</CountChip> : null}
            </Link>
          ) : null}
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

      {showBanner ? (
        <div className="lg:col-span-3">
          {aiBanner === "newer" ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-[13px] text-ink-900">
              <SparklesIcon className="size-4 shrink-0 text-brand-700" />
              <p className="flex-1">AI가 바꾼 새 화면이 준비됐어요. 새 화면을 보고 이어서 요청해 주세요.</p>
              <button type="button" onClick={showNewVersion} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-ink-50 hover:bg-brand-700">
                <RefreshCwIcon className="size-3.5" /> 새 화면 보기
              </button>
            </div>
          ) : aiBanner === "building" ? (
            <div className="flex items-start gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-[13px] leading-relaxed text-ink-900">
              <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin text-brand-700" />
              <p className="flex-1">
                AI가 고르신 디자인 유형에 맞춰 첫 디자인을 다듬고 있어요. 보통 1~2분 걸리고, 끝나면 여기에 &lsquo;새 화면 보기&rsquo; 가 떠요. 지금 그린 네모는 새 화면에서 다시 그려야 해요.
              </p>
            </div>
          ) : null}
          {welcome && welcomeOpen ? (
            <div
              className={cn(
                "flex items-start gap-3 border-b px-4 py-2.5 text-[13px] leading-relaxed",
                welcome.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-ink-900",
              )}
            >
              <p className="flex-1">{welcome.text}</p>
              <button type="button" onClick={() => setWelcomeOpen(false)} className="grid size-6 shrink-0 place-items-center rounded text-ink-500 hover:bg-ink-100 hover:text-ink-900" aria-label="안내 닫기">
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : null}
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
          photos={photoOverlays}
          locked={locked}
          lockDone={Boolean(progress?.done)}
          liveLabels={liveLabels}
          flashes={flashesHere}
          ref={canvasRef}
        />
      </div>

      {/* 오른쪽: 요청 패널 (AI 작업 중에는 진행 패널) */}
      <div className="lg:min-h-0">
        {liveBatch ? (
          <AiLivePanel progress={progress} offsetMs={offsetMs} projectId={projectId} focusedId={focusedId} onFocus={followItem} onClose={closeLive} onReport={reportProblem} />
        ) : (
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
          projectId={demo ? null : projectId}
          slots={slotItems.map((i) => ({ slot: i.slot, located: i.rects.length > 0, request: i.request, drafted: i.drafted }))}
          hoveredSlot={hoveredSlot}
          onSlotHover={setHoveredSlot}
          onSlotFocus={(id) => {
            const r = slotItems.find((i) => i.slot.id === id)?.rects[0];
            if (r) canvasRef.current?.focus(r);
          }}
          onSlotAi={draftForSlot}
          siteStyles={siteStyles}
          templates={templates}
          aiEnabled={Boolean(ai?.enabled)}
        />
        )}
      </div>
    </div>
  );
}
