"use client";

import { HandIcon, MaximizeIcon, MinusIcon, PlusIcon, SquareIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { DraftBox, ExistingRequest } from "@/components/editor/types";
import { REQUEST_KIND_SHORT } from "@/config/plans";
import type { Screenshot } from "@/lib/types/db";
import { cn } from "@/lib/utils";

/**
 * 캡처 이미지 캔버스.
 *
 * 핵심 설계: 이미지와 네모들을 한 래퍼 안에 두고 래퍼 전체에 `translate + scale` 을 건다.
 * 네모 좌표는 이미지 픽셀 기준으로 저장하므로 마우스 휠로 줌을 바꿔도 네모가 이미지와 같이 늘고 줄어든다
 * (요구사항: "휠로 이미지를 작게/크게 하면 네모 박스도 크기에 맞게 수정되어야 함").
 * 테두리·라벨·핸들처럼 화면에서 일정한 크기여야 하는 것만 1/zoom 로 역보정한다.
 *
 * 네모 하나 = 요청 하나. 라벨의 번호는 오른쪽 패널 카드 번호와 같고, hoveredId 로 서로 강조를 주고받는다.
 */

type Mode = "move" | "box";
type View = { zoom: number; x: number; y: number };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

type Drag =
  | { type: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { type: "draw"; id: string; startX: number; startY: number }
  | { type: "move"; id: string; startX: number; startY: number; origin: DraftBox }
  | { type: "resize"; id: string; handle: Handle; origin: DraftBox };

export function EditorCanvas({
  screenshot,
  drafts,
  existing,
  selectedId,
  hoveredId,
  onDraftsChange,
  onSelect,
  onHover,
  defaultKind,
}: {
  screenshot: Screenshot;
  drafts: DraftBox[];
  existing: ExistingRequest[];
  selectedId: string | null;
  /** 오른쪽 패널 카드에 마우스를 올린 네모 (같이 강조) */
  hoveredId: string | null;
  onDraftsChange: (next: DraftBox[]) => void;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  defaultKind: DraftBox["kind"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("box");
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const draftsRef = useRef(drafts);
  // 이벤트 핸들러가 항상 최신 값을 보도록 렌더 후 동기화 (렌더 중 ref 쓰기는 React 규칙 위반)
  useLayoutEffect(() => {
    viewRef.current = view;
    draftsRef.current = drafts;
  });
  const dragRef = useRef<Drag | null>(null);
  // 드래그 종류를 state 로도 들고 있어야 커서 표시에 쓸 수 있다 (렌더 중 ref 읽기 금지)
  const [dragging, setDragging] = useState<"none" | "pan" | "other">("none");

  /** 화면 좌표 → 이미지 픽셀 좌표 */
  const toImage = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.zoom, y: (clientY - rect.top - v.y) / v.zoom };
  }, []);

  /** 가로 맞춤: 긴 페이지 캡처는 폭을 맞추고 위에서부터 보는 게 자연스럽다 */
  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 32;
    const zoom = Math.min(1.5, Math.max(MIN_ZOOM, (el.clientWidth - pad * 2) / screenshot.width));
    setView({ zoom, x: (el.clientWidth - screenshot.width * zoom) / 2, y: pad });
  }, [screenshot.width]);

  useLayoutEffect(() => {
    fit();
  }, [fit, screenshot.url]);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const v = viewRef.current;
    const px = cx ?? el.clientWidth / 2;
    const py = cy ?? el.clientHeight / 2;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
    const ratio = zoom / v.zoom;
    setView({ zoom, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio });
  }, []);

  // 휠 = 커서 기준 줌. React 의 onWheel 은 passive 라 preventDefault 가 안 먹으므로 네이티브로 등록한다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // 키보드: V 이동, R 네모, Delete 삭제, Esc 선택 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
      if (e.key === "v" || e.key === "V") setMode("move");
      if (e.key === "r" || e.key === "R") setMode("box");
      if (e.key === "Escape") onSelect(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        onDraftsChange(draftsRef.current.filter((d) => d.id !== selectedId));
        onSelect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDraftsChange, onSelect, selectedId]);

  const clampBox = useCallback(
    (b: DraftBox): DraftBox => {
      const x = Math.max(0, Math.min(screenshot.width - b.w, b.x));
      const y = Math.max(0, Math.min(screenshot.height - b.h, b.y));
      return { ...b, x, y, w: Math.min(b.w, screenshot.width), h: Math.min(b.h, screenshot.height) };
    },
    [screenshot.width, screenshot.height],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle as Handle | undefined;
    const boxEl = target.closest<HTMLElement>("[data-box]");
    const boxId = boxEl?.dataset.box;
    const p = toImage(e.clientX, e.clientY);

    if (handle && boxId) {
      const origin = draftsRef.current.find((d) => d.id === boxId);
      if (!origin) return;
      dragRef.current = { type: "resize", id: boxId, handle, origin };
      onSelect(boxId);
    } else if (boxId) {
      const origin = draftsRef.current.find((d) => d.id === boxId);
      if (!origin) return;
      dragRef.current = { type: "move", id: boxId, startX: p.x, startY: p.y, origin };
      onSelect(boxId);
    } else if (mode === "box") {
      const id = `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      dragRef.current = { type: "draw", id, startX: p.x, startY: p.y };
      onDraftsChange([...draftsRef.current, { id, x: p.x, y: p.y, w: 0, h: 0, message: "", kind: defaultKind }]);
      onSelect(id);
    } else {
      dragRef.current = { type: "pan", startX: e.clientX, startY: e.clientY, originX: viewRef.current.x, originY: viewRef.current.y };
      onSelect(null);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(dragRef.current?.type === "pan" ? "pan" : "other");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "pan") {
      setView((v) => ({ ...v, x: drag.originX + (e.clientX - drag.startX), y: drag.originY + (e.clientY - drag.startY) }));
      return;
    }
    const p = toImage(e.clientX, e.clientY);
    const px = Math.max(0, Math.min(screenshot.width, p.x));
    const py = Math.max(0, Math.min(screenshot.height, p.y));
    const next = draftsRef.current.map((d) => {
      if (d.id !== drag.id) return d;
      if (drag.type === "draw") {
        return { ...d, x: Math.min(drag.startX, px), y: Math.min(drag.startY, py), w: Math.abs(px - drag.startX), h: Math.abs(py - drag.startY) };
      }
      if (drag.type === "move") {
        return clampBox({ ...d, x: drag.origin.x + (p.x - drag.startX), y: drag.origin.y + (p.y - drag.startY) });
      }
      // resize: 핸들 방향에 따라 반대편 모서리를 고정
      const o = drag.origin;
      let { x, y, w, h } = o;
      const minSize = 8 / viewRef.current.zoom;
      if (drag.handle.includes("w")) {
        const nx = Math.min(px, o.x + o.w - minSize);
        w = o.x + o.w - nx;
        x = nx;
      }
      if (drag.handle.includes("e")) w = Math.max(minSize, px - o.x);
      if (drag.handle.includes("n")) {
        const ny = Math.min(py, o.y + o.h - minSize);
        h = o.y + o.h - ny;
        y = ny;
      }
      if (drag.handle.includes("s")) h = Math.max(minSize, py - o.y);
      return { ...d, x, y, w, h };
    });
    onDraftsChange(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging("none");
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* 이미 해제됨 */
    }
    if (drag?.type === "draw") {
      // 너무 작은 네모(클릭에 가까운 것)는 버린다
      const min = 8 / viewRef.current.zoom;
      const d = draftsRef.current.find((x) => x.id === drag.id);
      if (!d || d.w < min || d.h < min) {
        onDraftsChange(draftsRef.current.filter((x) => x.id !== drag.id));
        onSelect(null);
      }
    }
  };

  const inv = 1 / view.zoom; // 화면 고정 크기 보정
  const cursor = dragging === "pan" ? "grabbing" : dragging === "other" ? "crosshair" : mode === "move" ? "grab" : "crosshair";

  return (
    <div
      ref={containerRef}
      className="editor-canvas relative h-full w-full overflow-hidden bg-ink-100"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* 변환 래퍼: 이미지 + 네모 */}
      <div
        className="absolute left-0 top-0 bg-[#fff] shadow-md"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, transformOrigin: "0 0", width: screenshot.width, height: screenshot.height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 캡처는 원본 픽셀 크기로 배치해야 좌표 계산이 맞는다 */}
        <img src={screenshot.url} width={screenshot.width} height={screenshot.height} alt="" draggable={false} className="block select-none" />

        {/* 이미 접수된 요청: 파란 테두리, 조작 불가 */}
        {existing.map((r) => (
          <div
            key={r.id}
            className="pointer-events-none absolute border-brand-500"
            style={{
              left: r.region.x * screenshot.width,
              top: r.region.y * screenshot.height,
              width: r.region.w * screenshot.width,
              height: r.region.h * screenshot.height,
              borderWidth: 2 * inv,
              borderStyle: r.status === "processing" ? "dashed" : "solid",
            }}
          >
            <span
              className="absolute left-0 bg-brand-500 px-1 font-semibold whitespace-nowrap text-white"
              style={{ top: -18 * inv, fontSize: 11 * inv, lineHeight: `${18 * inv}px`, paddingInline: 5 * inv, marginLeft: -2 * inv }}
            >
              {r.status === "processing" ? "처리중" : "접수"} #{r.seq}
            </span>
          </div>
        ))}

        {/* 초안 네모: 빨간 테두리, 선택 시 핸들. 라벨 번호 = 오른쪽 패널 카드 번호 */}
        {drafts.map((d, i) => {
          const selected = d.id === selectedId;
          const hovered = d.id === hoveredId;
          return (
            <div
              key={d.id}
              data-box={d.id}
              onPointerEnter={() => onHover(d.id)}
              onPointerLeave={() => onHover(null)}
              className={cn("group absolute border-mark", selected || hovered ? "bg-red-500/10" : "hover:bg-red-500/5")}
              style={{ left: d.x, top: d.y, width: d.w, height: d.h, borderWidth: (selected || hovered ? 3 : 2) * inv, cursor: "move" }}
            >
              <span
                className="absolute left-0 bg-mark font-semibold whitespace-nowrap text-white"
                style={{ top: -18 * inv, fontSize: 11 * inv, lineHeight: `${18 * inv}px`, paddingInline: 5 * inv, marginLeft: -2 * inv }}
              >
                {i + 1} · {REQUEST_KIND_SHORT[d.kind]}
                {d.message.trim() ? "" : " · 요청사항 없음"}
              </span>
              {HANDLES.map((h) => (
                <span
                  key={h}
                  data-handle={h}
                  className={cn("absolute border border-mark bg-[#fff]", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                  style={{ ...handleStyle(h, 10 * inv), cursor: `${h}-resize` }}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* 툴바 */}
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded border border-ink-200 bg-surface p-1 shadow-sm" onPointerDown={(e) => e.stopPropagation()}>
        <ToolButton active={mode === "move"} onClick={() => setMode("move")} title="이동 (V) — 드래그로 화면 이동">
          <HandIcon className="size-4" /> 이동
        </ToolButton>
        <ToolButton active={mode === "box"} onClick={() => setMode("box")} title="빨간 네모 (R) — 드래그로 영역 그리기">
          <SquareIcon className="size-4 text-mark" /> 빨간 네모
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-ink-200" />
        <ToolButton onClick={() => zoomAt(1 / 1.25)} title="축소">
          <MinusIcon className="size-4" />
        </ToolButton>
        <span className="w-12 text-center text-xs tabular-nums text-ink-700">{Math.round(view.zoom * 100)}%</span>
        <ToolButton onClick={() => zoomAt(1.25)} title="확대">
          <PlusIcon className="size-4" />
        </ToolButton>
        <ToolButton onClick={fit} title="가로 맞춤">
          <MaximizeIcon className="size-4" />
        </ToolButton>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-surface/90 px-2 py-1 text-[11px] text-ink-500">
        {mode === "box" ? "드래그해서 고칠 곳에 네모를 그리세요 · 휠로 확대/축소" : "드래그로 화면 이동 · 휠로 확대/축소"}
      </p>
    </div>
  );
}

function handleStyle(h: Handle, size: number): React.CSSProperties {
  const half = -size / 2;
  const s: React.CSSProperties = { width: size, height: size };
  if (h.includes("n")) s.top = half;
  if (h.includes("s")) s.bottom = half;
  if (h.includes("w")) s.left = half;
  if (h.includes("e")) s.right = half;
  if (h === "n" || h === "s") {
    s.left = "50%";
    s.marginLeft = half;
  }
  if (h === "e" || h === "w") {
    s.top = "50%";
    s.marginTop = half;
  }
  return s;
}

function ToolButton({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] font-medium", active ? "bg-sky-400 text-night-950" : "text-ink-700 hover:bg-ink-100", className)}
      {...props}
    />
  );
}
