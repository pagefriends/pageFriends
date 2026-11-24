"use client";

import { BadgeCheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitRequestsAction } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EXPERT_HOURS, type DeviceKind } from "@/config/plans";

/**
 * 전문가 검수 요청 (2026-11-24 — 예전 "전문가 요청"). 고치는 일은 모두 AI 가 하고, 사람은 사이트를 검수한다.
 * 네모 없이 지금 보고 있는 페이지 전체(화면 전체 영역)를 검수 대상으로 보낸다. 플랜의 월 횟수 · 검수 크레딧에서 1회 차감.
 */
export function ReviewRequestButton({
  projectId,
  pageId,
  pageName,
  device,
  version,
  quota,
  disabled,
}: {
  projectId: string;
  pageId: string;
  pageName: string;
  device: DeviceKind;
  version: number;
  quota: { monthly: number | null; used: number; credits: number } | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const left = quota ? (quota.monthly === null ? null : Math.max(0, quota.monthly - quota.used) + quota.credits) : 0;

  const submit = () =>
    start(async () => {
      const note = text.trim() || "사이트 전체를 검수해 주세요.";
      const r = await submitRequestsAction(projectId, [
        { page_id: pageId, device, kind: "expert", seq: 1, region: { x: 0, y: 0, w: 1, h: 1 }, message: `[전문가 검수 요청] ${note}`.slice(0, 2000), version },
      ]);
      if (!r.ok) {
        setResult({ ok: false, message: r.error });
        return;
      }
      setResult({ ok: true, message: `보냈어요. 전문가가 ${EXPERT_HOURS.min}~${EXPERT_HOURS.max}시간 안에 검수 결과를 남겨 드려요.` });
      setText("");
      router.refresh();
    });

  return (
    <span className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((v) => !v);
          setResult(null);
        }}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap hover:text-ink-900 disabled:opacity-50"
        title="고치는 일은 AI가 해요. 사람이 사이트를 한 번 더 확인해 줬으면 할 때 보내요."
      >
        <BadgeCheckIcon className="size-3.5" /> 전문가 검수 요청
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-md border border-ink-200 bg-surface p-4 text-left text-sm text-ink-700 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink-900">전문가 검수 요청</p>
            <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-900" aria-label="닫기">
              <XIcon className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            전문가가 <b>{pageName}</b> 페이지를 중심으로 사이트를 검수하고 {EXPERT_HOURS.min}~{EXPERT_HOURS.max}시간 안에 결과를 남겨요. 사실 확인 · 광고 표현 ·
            약관 같은 것도 봐 드려요.
          </p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="검수 받고 싶은 점 (비워 두면 사이트 전체를 봐요)" className="mt-3 min-h-20 text-sm" />
          <p className="mt-2 text-xs text-ink-500">
            {quota === null ? "플랜이 있어야 보낼 수 있어요." : left === null ? "이번 달 무제한" : `이번 달 남은 검수 ${left}회`}
          </p>
          {result ? <p className={result.ok ? "mt-2 text-xs text-brand-700" : "mt-2 text-xs text-mark"}>{result.message}</p> : null}
          <Button className="mt-3 w-full" size="sm" onClick={submit} disabled={pending || quota === null || left === 0}>
            {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
            검수 요청 보내기
          </Button>
        </div>
      ) : null}
    </span>
  );
}
