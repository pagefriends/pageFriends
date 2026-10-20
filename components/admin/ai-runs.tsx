"use client";

import { LoaderCircleIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { rerunBuildAction, rerunRequestAction, reviewRunAction, type AiActionState } from "@/app/(admin)/admin/ai-actions";
import { Badge } from "@/components/ui/card";
import { USD_TO_KRW } from "@/config/ai";
import { formatTokens } from "@/config/plans";
import { RUN_STATUS, type AiRunRow } from "@/lib/ai/run-types";
import { cn, formatDateTime } from "@/lib/utils";

const REVIEW: { key: "good" | "bad" | "fixed"; label: string }[] = [
  { key: "good", label: "잘함" },
  { key: "bad", label: "잘못함" },
  { key: "fixed", label: "고쳐서 마무리" },
];

/** AI 실행 기록. 줄마다 결과 · 바꾼 값 · 토큰 · 비용, 그리고 담당자 평가(학습 데이터 표시) */
export function AiRunList({ runs, path }: { runs: AiRunRow[]; path: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  if (!runs.length) return <p className="text-sm text-ink-500">아직 AI 실행 기록이 없습니다.</p>;

  const review = (id: string, r: "good" | "bad" | "fixed" | null) =>
    start(async () => {
      const res = await reviewRunAction(id, r, "", path);
      setMsg(res?.message ?? null);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {msg ? <p className="text-xs text-brand-700">{msg}</p> : null}
      <ul className="flex flex-col divide-y divide-ink-100 rounded-md border border-ink-200">
        {runs.map((run) => {
          const st = RUN_STATUS[run.status];
          const cost = Number(run.cost_usd || 0);
          const out = run.output as { summary?: string; question?: string; expertNote?: string; notes?: string; decision?: string } | null;
          const changes = run.applied?.changes ?? [];
          return (
            <li key={run.id} className="px-3 py-2.5 text-xs">
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="font-semibold text-ink-900">
                    {run.task === "build" ? "첫 제작" : run.task === "bug" || (run.input as { bugReport?: boolean } | null)?.bugReport ? "오류 확인" : "수정"}
                  </span>
                  <span className="text-ink-500">{formatDateTime(run.created_at)}</span>
                  {run.usage ? (
                    <span className="tabular-nums text-ink-500">
                      입력 {formatTokens(run.usage.input + run.usage.cacheRead + run.usage.cacheWrite)} (캐시 {formatTokens(run.usage.cacheRead)}) · 출력 {formatTokens(run.usage.output)}
                    </span>
                  ) : null}
                  {run.tokens_billed > 0 ? <span className="tabular-nums text-ink-700">사용자 차감 {formatTokens(run.tokens_billed)}</span> : null}
                  {cost > 0 ? <span className="tabular-nums text-ink-500">약 {Math.round(cost * USD_TO_KRW).toLocaleString("ko-KR")}원 (${cost.toFixed(4)})</span> : null}
                  {run.duration_ms ? <span className="text-ink-400">{(run.duration_ms / 1000).toFixed(1)}초</span> : null}
                  {run.review ? <Badge tone="blue">{REVIEW.find((x) => x.key === run.review)?.label}</Badge> : null}
                </summary>
                <div className="mt-2 flex flex-col gap-1.5 text-ink-700">
                  <p className="text-ink-500">
                    모델 {run.model ?? "-"} · 지시서 {run.prompt_version} · 노력 {run.effort ?? "-"} · 디자인 v{run.design_version_before ?? "-"} → v{run.design_version_after ?? "-"}
                  </p>
                  {run.error ? <p className="text-mark">오류: {run.error}</p> : null}
                  {out?.summary ? <p>AI 설명: {out.summary}</p> : null}
                  {out?.notes ? <p>디자인 설명: {out.notes}</p> : null}
                  {out?.question ? <p>질문: {out.question}</p> : null}
                  {out?.expertNote ? <p className="font-medium">담당자가 할 일: {out.expertNote}</p> : null}
                  {changes.length ? (
                    <ul className="list-disc pl-4">
                      {changes.map((c, i) => (
                        <li key={i} className="break-words">
                          {c.kind === "theme" ? "테마" : "문구"} {c.path ? `${c.path} ` : ""}
                          <code>{c.key}</code>: {c.before || "(기본)"} → <b>{c.after}</b>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {run.applied?.rejected?.length ? <p className="text-ink-500">버린 값: {run.applied.rejected.join(" · ")}</p> : null}
                  <details>
                    <summary className="cursor-pointer text-ink-500">AI 에게 보낸 메시지 · 받은 답 원문</summary>
                    <pre className="mt-1 max-h-72 overflow-auto rounded bg-ink-100 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">{String(run.input?.user ?? "")}</pre>
                    <pre className="mt-1 max-h-72 overflow-auto rounded bg-ink-100 p-2 text-[11px] leading-relaxed whitespace-pre-wrap">{JSON.stringify(run.output, null, 2)}</pre>
                  </details>
                  {run.status !== "running" && run.status !== "skipped" ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-ink-500">평가 (학습 데이터):</span>
                      {REVIEW.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          disabled={pending}
                          onClick={() => review(run.id, run.review === r.key ? null : r.key)}
                          className={cn("rounded border px-2 py-0.5", run.review === r.key ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-ink-200 hover:border-ink-400")}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "AI로 다시 만들기" / "AI로 다시 처리" */
export function AiRerunButton({ kind, id, disabled, label }: { kind: "build" | "request"; id: string; disabled?: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AiActionState>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          // 첫 제작을 다시 하면 테마 · 문구를 처음부터 새로 만든다 — 그동안 반영한 수정(버튼 모양 · 문구 등)도 새 디자인으로 바뀐다
          if (kind === "build" && !window.confirm("처음부터 새로 만들어요. 그동안 반영한 수정(색 · 버튼 · 문구 등)도 새 디자인으로 바뀝니다. 계속할까요?")) return;
          start(async () => {
            const res = kind === "build" ? await rerunBuildAction(id) : await rerunRequestAction(id);
            setState(res);
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-300 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : kind === "build" ? <SparklesIcon className="size-3.5" /> : <RotateCcwIcon className="size-3.5" />}
        {label}
      </button>
      {state ? <span className={cn("text-xs", state.ok ? "text-brand-700" : "text-mark")}>{state.message}</span> : null}
    </div>
  );
}
