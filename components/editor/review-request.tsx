"use client";

import { BadgeCheckIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitRequestsAction } from "@/app/(app)/projects/[id]/actions";
import type { ExistingRequest } from "@/components/editor/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { DEVICE_LABEL, EXPERT_HOURS, type DeviceKind } from "@/config/plans";
import { requestStatus } from "@/config/requests";

/**
 * 전문가 검수 요청 탭 (편집 화면 가운데, 2026-11-24). 고치는 일은 모두 AI 가 하고, 사람은 사이트를 검수한다.
 * 박스 없이 지금 고른 페이지 전체(화면 전체 영역)를 검수 대상으로 보낸다. 플랜의 월 횟수 · 검수 크레딧에서 1회 차감.
 * 아래에는 지금까지 보낸 검수 요청과 전문가의 마지막 답을 보여 준다.
 */
export function ReviewPanel({
  projectId,
  pageId,
  pageName,
  device,
  version,
  quota,
  disabled,
  history,
  pageNameOf,
}: {
  projectId: string;
  pageId: string;
  pageName: string;
  device: DeviceKind;
  version: number;
  quota: { monthly: number | null; used: number; credits: number } | null;
  disabled?: boolean;
  /** 보낸 전문가 검수 요청 (최신순) */
  history: ExistingRequest[];
  pageNameOf: (pageId: string) => string;
}) {
  const router = useRouter();
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
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <BadgeCheckIcon className="size-5 text-brand-600" /> 전문가 검수 요청
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        고치는 일은 AI가 바로 해요. 사람이 사이트를 한 번 더 확인해 줬으면 할 때 보내 주세요. 전문가가 {EXPERT_HOURS.min}~{EXPERT_HOURS.max}시간 안에 검수 결과를 남겨요 —
        사실 확인 · 광고 표현 · 약관 같은 것도 봐 드려요.
      </p>

      <div className="mt-6 rounded-md border border-ink-200 bg-surface p-5">
        <p className="text-sm text-ink-700">
          검수할 페이지: <b>{pageName}</b> <span className="text-ink-400">({DEVICE_LABEL[device]} 화면)</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-400">다른 페이지를 검수 받으려면 왼쪽 목록에서 페이지를 고르세요.</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="검수 받고 싶은 점 (비워 두면 사이트 전체를 봐요)" className="mt-3 min-h-28 text-sm" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-500">{quota === null ? "플랜이 있어야 보낼 수 있어요." : left === null ? "이번 달 무제한" : `이번 달 남은 검수 ${left}회`}</p>
          <Button size="sm" onClick={submit} disabled={disabled || pending || quota === null || left === 0}>
            {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
            검수 요청 보내기
          </Button>
        </div>
        {result ? <p className={result.ok ? "mt-2 text-xs text-brand-700" : "mt-2 text-xs text-mark"}>{result.message}</p> : null}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-ink-900">보낸 검수 요청</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-sm text-ink-400">아직 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200 bg-surface">
          {history.map((r) => {
            const st = requestStatus(r.kind, r.status);
            return (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="text-xs text-ink-500">{pageNameOf(r.page_id)}</span>
                  {r.due ? <span className="text-xs text-ink-400">답변 {r.due}</span> : null}
                </div>
                <p className="mt-1 text-ink-700">{r.message.replace(/^\[전문가 검수 요청\]\s*/, "")}</p>
                {r.lastReply ? <p className="mt-1 rounded-sm bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">전문가: {r.lastReply}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
