"use client";

import { ArrowRightIcon, CheckIcon, CircleHelpIcon, LoaderCircleIcon, SparklesIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { BUG_HOURS, EXPERT_HOURS } from "@/config/plans";
import type { BatchProgress, LiveItem, LiveStage } from "@/lib/ai/progress";
import { cn } from "@/lib/utils";

/**
 * "AI 작업 중" 패널 (편집기 오른쪽). 요청하기를 누른 뒤 AI 가 네모를 하나씩 고치는 과정을 실시간으로 보여 준다.
 * 진행 상황은 편집기가 1초마다 읽어 넘긴다 (GET /api/projects/[id]/ai-progress). 이 패널은 보여 주기만 한다.
 *
 * 네모마다: 순서 · 어디(페이지 · 화면 · 네모 번호) · 가리키는 곳 · 요청 글 · 상태
 * 고치는 중이면 단계(확인 → 고칠 방법 정하기 → 바꿀 내용 쓰기 → 새 화면 그리기)와 걸린 시간, AI 가 쓰는 설명을 바로 보여 주고,
 * 끝나면 실제로 바뀐 것(전 → 후)을 남긴다. 질문 · 담당자에게 넘김은 이유와 함께.
 */

/** 단계 이름 (AI 반영 / 오류 확인) */
const STEPS: Record<LiveItem["kind"], string[]> = {
  ai: ["요청 확인", "고칠 방법 정하기", "바꿀 내용 쓰기", "새 화면 그리기"],
  bug: ["신고 확인", "원인 찾기", "고칠 내용 쓰기", "새 화면 그리기"],
};
const STAGE_INDEX: Record<LiveStage | "check", number> = { check: 0, thinking: 1, writing: 2, rendering: 3, database: 3 };

/** 걸린 시간 "7초" · "1분 5초" */
function secs(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export function AiLivePanel({
  progress,
  offsetMs,
  projectId,
  focusedId,
  onFocus,
  onClose,
  onReport,
}: {
  /** 아직 처음 읽기 전이면 null */
  progress: BatchProgress | null;
  /** 내 컴퓨터 시각 - 서버 시각 (걸린 시간 계산) */
  offsetMs: number;
  projectId: string;
  /** 캔버스에 지금 보이는 네모 */
  focusedId: string | null;
  onFocus: (item: LiveItem) => void;
  onClose: () => void;
  /** AI 가 바꾼 결과가 이상할 때: 그 자리에 오류 신고 네모를 만들어 준다 (작업 화면을 닫고) */
  onReport: (item: LiveItem) => void;
}) {
  // 걸린 시간이 매초 바뀌게
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const serverNow = now - offsetMs;

  const items = progress?.items ?? [];
  const finished = items.filter((i) => i.state !== "queued" && i.state !== "working").length;
  const done = Boolean(progress?.done);
  const working = items.find((i) => i.state === "working");
  // 처리 중인 것이 없고 아직 남았으면 첫 대기 네모가 "곧 시작"
  const next = !working && !done ? items.find((i) => i.state === "queued") : undefined;
  const count = {
    applied: items.filter((i) => i.kind === "ai" && i.state === "done").length,
    fixed: items.filter((i) => i.kind === "bug" && i.state === "done").length,
    asked: items.filter((i) => i.state === "asked").length,
    handoff: items.filter((i) => i.state === "handoff").length,
  };

  return (
    <div className="flex h-full flex-col border-t border-ink-200 bg-surface lg:border-t-0 lg:border-l">
      {/* 머리: 전체 진행 */}
      <div className={cn("border-b px-4 py-3", done ? "border-brand-200 bg-brand-50" : "border-sky-200 bg-sky-50")}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            {done ? <CheckIcon className="size-4 text-brand-700" /> : <LoaderCircleIcon className="size-4 animate-spin text-sky-600" />}
            {done ? "AI가 다 마쳤어요" : "AI가 고치는 중"}
          </p>
          <span className="text-xs font-semibold tabular-nums text-ink-700">
            {finished} / {items.length || "-"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70" aria-hidden>
          <div className={cn("h-full rounded-full transition-all duration-500", done ? "bg-brand-600" : "bg-sky-500")} style={{ width: `${items.length ? (finished / items.length) * 100 : 5}%` }} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-700">
          {!progress
            ? "요청을 확인하고 있어요."
            : done
              ? [
                  count.applied ? `반영 ${count.applied}건` : null,
                  count.fixed ? `오류 고침 ${count.fixed}건` : null,
                  count.asked ? `질문 ${count.asked}건` : null,
                  count.handoff ? `담당자에게 ${count.handoff}건` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") + ". 바뀐 화면은 왼쪽에서 바로 볼 수 있어요. 결과가 이상하면 '이상해요'를 눌러 오류 신고해 주세요."
              : `요청 ${items.length}개를 확인했어요. 하나씩 순서대로 처리하고, 끝날 때마다 화면이 바로 바뀌어요. 그동안은 새 네모를 그릴 수 없어요.`}
        </p>
      </div>

      {/* 네모별 진행 */}
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onFocus(it)}
              className={cn(
                "w-full rounded-md border p-3 text-left transition-colors",
                it.state === "working" ? "border-sky-400 bg-sky-50 ring-1 ring-sky-400" : "border-ink-200 hover:border-ink-400",
                focusedId === it.id && it.state !== "working" && "border-ink-400",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                    it.state === "done" ? "bg-brand-600 text-white" : it.state === "working" ? "bg-sky-500 text-white" : "bg-ink-100 text-ink-700",
                  )}
                >
                  {it.state === "done" ? <CheckIcon className="size-3" /> : it.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] text-ink-500">
                      {it.kind === "bug" ? <span className="mr-1 font-semibold text-mark">오류 신고</span> : null}
                      {it.where}
                    </p>
                    <StateChip item={it} isNext={it.id === next?.id} elapsed={elapsedOf(it, serverNow)} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] font-medium text-ink-900">&ldquo;{it.message}&rdquo;</p>
                  {it.target ? <p className="mt-0.5 text-[11px] text-ink-500">가리키는 곳: {it.target}</p> : null}

                  {/* 다음 차례는 엔진이 요청 · 화면을 확인하는 중 (실행이 시작되기 전) */}
                  {it.state === "working" ? <Stepper kind={it.kind} stage={it.stage ?? "thinking"} /> : it.id === next?.id ? <Stepper kind={it.kind} stage="check" /> : null}

                  {it.summary && (it.state === "working" || it.state === "done") ? (
                    <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-ink-800">
                      <SparklesIcon className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
                      <span>{it.summary}</span>
                    </p>
                  ) : null}
                  {it.state === "done" && it.changes.length ? (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-ink-600">
                      {it.changes.slice(0, 6).map((c, i) => (
                        <li key={i} className="break-words">
                          · {c}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {it.state === "asked" ? (
                    <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-ink-800">
                      <CircleHelpIcon className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
                      <span>{it.note ?? "AI가 확인하고 싶은 게 있어요."}</span>
                    </p>
                  ) : null}
                  {it.state === "handoff" ? (
                    <p className="mt-2 flex gap-1.5 text-[12px] leading-relaxed text-ink-700">
                      <UserRoundIcon className="mt-0.5 size-3.5 shrink-0 text-ink-500" />
                      <span>{it.note ?? "담당자가 이어서 처리해요."}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </button>
            {it.state === "asked" ? (
              <Link href={`/projects/${projectId}/requests`} className="mt-1 ml-7 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline">
                답하러 가기 <ArrowRightIcon className="size-3" />
              </Link>
            ) : null}
            {/* 다 끝난 뒤, AI 가 바꾼 결과가 이상하면 바로 그 자리에 오류 신고 */}
            {done && it.state === "done" ? (
              <button type="button" onClick={() => onReport(it)} className="mt-1 ml-7 inline-flex items-center gap-1 text-[12px] font-medium text-ink-500 hover:text-mark">
                <TriangleAlertIcon className="size-3" /> 이상해요 · 오류 신고
              </button>
            ) : null}
          </li>
        ))}
        {!progress ? (
          <li className="flex items-center gap-2 px-1 py-4 text-sm text-ink-500">
            <LoaderCircleIcon className="size-4 animate-spin" /> 불러오는 중…
          </li>
        ) : null}
      </ol>

      {/* 아래: 같이 보낸 사람 몫 · 닫기 */}
      <div className="border-t border-ink-100 px-4 py-3">
        {progress && (progress.people > 0 || progress.images > 0) ? (
          <p className="mb-2 text-[11px] leading-relaxed text-ink-500">
            {[
              progress.people > 0 ? `함께 보낸 전문가 요청 ${progress.people}건은 담당자가 ${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간 안에 답해요.` : null,
              progress.images > 0 ? `AI 이미지 요청 ${progress.images}건은 따로 처리돼요.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        ) : null}
        {done ? (
          <Button className="w-full" onClick={onClose}>
            계속 수정하기
          </Button>
        ) : (
          <button type="button" onClick={onClose} className="w-full text-center text-[12px] text-ink-500 hover:text-ink-900">
            작업 화면 닫기 (AI는 계속 진행돼요)
          </button>
        )}
      </div>
    </div>
  );
}

function elapsedOf(it: LiveItem, serverNow: number): number | null {
  if (!it.startedAt) return null;
  const end = it.finishedAt ? Date.parse(it.finishedAt) : it.state === "working" ? serverNow : null;
  return end === null ? null : end - Date.parse(it.startedAt);
}

function StateChip({ item, isNext, elapsed }: { item: LiveItem; isNext: boolean; elapsed: number | null }) {
  const time = elapsed !== null ? ` · ${secs(elapsed)}` : "";
  const bug = item.kind === "bug";
  const map: Record<LiveItem["state"], { text: string; cls: string }> = {
    queued: isNext ? { text: "확인 중", cls: "bg-sky-100 text-sky-800" } : { text: "대기", cls: "bg-ink-100 text-ink-600" },
    working: { text: `${bug ? "확인하는 중" : "고치는 중"}${time}`, cls: "bg-sky-500 text-white" },
    done: { text: `${bug ? "고침 완료" : "반영 완료"}${time}`, cls: "bg-brand-600 text-white" },
    asked: { text: "질문 남김", cls: "bg-brand-100 text-brand-800" },
    handoff: { text: bug ? `담당자에게 · ${BUG_HOURS}시간 안에` : "담당자에게", cls: "bg-ink-200 text-ink-700" },
  };
  const s = map[item.state];
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums", s.cls)}>{s.text}</span>;
}

/** 처리 중인 네모의 단계 (check = 아직 실행 전, 요청 · 화면 확인 중) */
function Stepper({ kind, stage }: { kind: LiveItem["kind"]; stage: LiveStage | "check" }) {
  const at = STAGE_INDEX[stage];
  // 관리자 목록을 바꾸는 중이면 마지막 단계 이름이 바뀐다
  const steps = stage === "database" ? [...STEPS[kind].slice(0, 3), "관리자 페이지 만들기"] : STEPS[kind];
  return (
    <ol className="mt-2 grid grid-cols-4 gap-1">
      {steps.map((label, i) => {
        const state = i < at ? "done" : i === at ? "now" : "todo";
        return (
          <li key={label} className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full",
                state === "done" ? "bg-brand-600 text-white" : state === "now" ? "bg-sky-500 text-white" : "bg-ink-200 text-ink-400",
              )}
            >
              {state === "done" ? <CheckIcon className="size-2.5" /> : state === "now" ? <LoaderCircleIcon className="size-2.5 animate-spin" /> : null}
            </span>
            <span className={cn("text-[10px] leading-tight", state === "now" ? "font-semibold text-sky-700" : state === "done" ? "text-ink-600" : "text-ink-400")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
