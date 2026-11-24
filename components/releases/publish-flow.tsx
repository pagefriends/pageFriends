"use client";

import { CheckIcon, LoaderCircleIcon, RocketIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { publishCheckAction, requestReleaseAction } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import type { CheckIssue } from "@/lib/publish-check";
import { cn } from "@/lib/utils";

/**
 * "사이트에 올리기" (2026-11-24 — 예전 "웹사이트에 적용 요청"). 누르면 AI 가 차례로 점검하고 올린다. 단계마다 실제 검사를 부르고,
 * 기다리는 동안 진행률이 그 단계의 끝 쪽으로 천천히 차오른다 (단계가 끝나면 바로 그 단계 끝 % 로).
 *   수정 확인 (모든 화면 다시 그리기) → 보안 검사 (스크립트 · 위험한 링크 · 개인정보) → 올리기 (올릴 내용 묶기)
 * 심각한 문제가 있으면 멈추고 무엇을 고칠지 보여 준다.
 */
const STEPS = [
  { key: "verify", label: "수정 확인 중", done: "수정 확인", end: 40 },
  { key: "security", label: "보안 검사 중", done: "보안 검사", end: 75 },
  { key: "release", label: "사이트에 올리는 중", done: "올리기", end: 100 },
] as const;

type Phase = "idle" | "running" | "done" | "failed";

export function PublishFlow({ projectId, label, disabledReason }: { projectId: string; label: string; disabledReason: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [percent, setPercent] = useState(0);
  const [notes, setNotes] = useState<string[]>([]);
  const [issues, setIssues] = useState<CheckIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const target = useRef(0);

  // 진행률: 지금 단계의 끝 % 바로 앞까지 천천히 차오른다
  useEffect(() => {
    if (phase !== "running") return;
    const t = window.setInterval(() => setPercent((p) => (p < target.current ? Math.min(target.current, p + Math.max(0.4, (target.current - p) * 0.06)) : p)), 120);
    return () => window.clearInterval(t);
  }, [phase]);

  const run = async () => {
    setPhase("running");
    setError(null);
    setNotes([]);
    setIssues([]);
    setPercent(2);
    let start = 0;
    const found: CheckIssue[] = [];
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      setStep(i);
      target.current = s.end - 4;
      // 검사가 금방 끝나도 단계마다 잠깐은 보이게 (진행 상황을 읽을 수 있게)
      const shown = new Promise((r) => window.setTimeout(r, s.key === "release" ? 900 : 1500));
      if (s.key === "release") {
        const [res] = await Promise.all([requestReleaseAction(projectId, ""), shown]);
        if (!res.ok) {
          setError(res.error);
          setPhase("failed");
          return;
        }
      } else {
        const [res] = await Promise.all([publishCheckAction(projectId, s.key), shown]);
        if (!res.ok) {
          setError(res.error);
          setPhase("failed");
          return;
        }
        setNotes((n) => [...n, res.result.summary]);
        found.push(...res.result.issues);
        setIssues([...found]);
        if (!res.result.ok) {
          setError(`${s.done}에서 멈췄어요. 아래 내용을 고친 뒤 다시 올려 주세요.`);
          setPhase("failed");
          return;
        }
      }
      start = s.end;
      target.current = start;
      setPercent(start);
    }
    setPhase("done");
    router.refresh();
  };

  const shown = Math.round(phase === "done" ? 100 : percent);

  return (
    <div className="flex flex-col gap-3">
      {phase === "idle" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={Boolean(disabledReason)}>
            <RocketIcon className="size-4" />
            {label}
          </Button>
          {disabledReason ? <span className="text-xs text-ink-500">{disabledReason}</span> : <span className="text-xs text-ink-500">AI가 수정 확인 · 보안 검사를 한 뒤 올려요.</span>}
        </div>
      ) : (
        <div className="rounded-md border border-ink-200 bg-surface p-4">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-900">
            <span className="inline-flex items-center gap-1.5">
              {phase === "running" ? <LoaderCircleIcon className="size-4 animate-spin text-sky-600" /> : phase === "done" ? <CheckIcon className="size-4 text-brand-700" /> : <TriangleAlertIcon className="size-4 text-mark" />}
              {phase === "running" ? STEPS[step].label + "…" : phase === "done" ? "사이트에 올렸어요" : "올리지 못했어요"}
            </span>
            <span className="tabular-nums">{shown}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
            <div className={cn("h-full rounded-full transition-all duration-300", phase === "failed" ? "bg-mark" : phase === "done" ? "bg-brand-600" : "bg-sky-500")} style={{ width: `${Math.max(3, shown)}%` }} />
          </div>
          <ol className="mt-3 grid gap-1.5 text-[13px]">
            {STEPS.map((s, i) => {
              const state = phase === "done" || i < step ? "done" : i === step ? (phase === "failed" ? "failed" : "now") : "todo";
              return (
                <li key={s.key} className={cn("flex items-center gap-2", state === "todo" ? "text-ink-400" : "text-ink-800")}>
                  {state === "done" ? (
                    <CheckIcon className="size-3.5 text-brand-700" />
                  ) : state === "now" ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin text-sky-600" />
                  ) : state === "failed" ? (
                    <TriangleAlertIcon className="size-3.5 text-mark" />
                  ) : (
                    <span className="size-3.5 rounded-full border border-ink-300" />
                  )}
                  {s.key === "security" ? <ShieldCheckIcon className="size-3.5 text-ink-400" /> : null}
                  {state === "now" ? s.label : s.done}
                </li>
              );
            })}
          </ol>
          {notes.length ? (
            <ul className="mt-3 space-y-0.5 text-xs text-ink-600">
              {notes.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          ) : null}
          {issues.length ? (
            <ul className="mt-2 space-y-0.5 text-xs">
              {issues.map((it, i) => (
                <li key={i} className={it.level === "critical" ? "text-mark" : "text-amber-700"}>
                  {it.level === "critical" ? "고쳐야 해요" : "주의"} · {it.where}: {it.text}
                </li>
              ))}
            </ul>
          ) : null}
          {phase === "done" ? <p className="mt-3 text-xs text-ink-600">점검을 모두 통과해 올렸어요. 공개 주소가 준비되면 이 화면과 대시보드에 보여요.</p> : null}
          {error ? (
            <Alert tone="red" className="mt-3">
              {error}
            </Alert>
          ) : null}
          {phase === "failed" ? (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setPhase("idle")}>
              다시 시도
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
