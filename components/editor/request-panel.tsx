"use client";

import { LoaderCircleIcon, SendIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import type { DraftBox } from "@/components/editor/types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { REQUEST_KIND_LABEL, type RequestKind } from "@/config/plans";
import type { QuotaInfo } from "@/lib/quota";
import { cn } from "@/lib/utils";

/**
 * 오른쪽 요청 패널. 현재 페이지·디바이스의 네모 목록 + 요청사항 입력 + 한 번에 제출.
 * 주간 한도 초과분은 크레딧으로 처리된다는 것을 제출 전에 미리 보여준다.
 */
export function RequestPanel({
  drafts,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  totalCount,
  counts,
  quota,
  hasPlan,
  submitting,
  onSubmit,
  error,
  demo,
}: {
  drafts: DraftBox[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<DraftBox>) => void;
  onRemove: (id: string) => void;
  /** 모든 페이지·디바이스의 초안 합계 */
  totalCount: number;
  counts: Record<RequestKind, number>;
  quota: QuotaInfo;
  hasPlan: boolean;
  submitting: boolean;
  onSubmit: () => void;
  error: string | null;
  demo?: boolean;
}) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // 네모를 새로 그리면 그 요청사항 입력칸으로 바로 포커스
  useEffect(() => {
    if (selectedId) refs.current[selectedId]?.focus();
  }, [selectedId]);

  const overAi = quota.ai.remaining === null ? 0 : Math.max(0, counts.ai - quota.ai.remaining);
  const overExpert = quota.expert.remaining === null ? 0 : Math.max(0, counts.expert - quota.expert.remaining);
  const shortAi = Math.max(0, overAi - quota.ai.credits);
  const shortExpert = Math.max(0, overExpert - quota.expert.credits);
  const missingMessage = drafts.some((d) => !d.message.trim());
  const canSubmit = totalCount > 0 && !missingMessage && shortAi === 0 && shortExpert === 0 && (hasPlan || demo);

  return (
    <aside className="flex h-full flex-col border-l border-ink-200 bg-surface">
      <div className="border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold">수정 요청</h2>
        <p className="mt-0.5 text-xs text-ink-500">네모를 그린 뒤 각 번호에 요청사항을 적으세요. 기본은 AI 반영입니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {drafts.length === 0 ? (
          <div className="rounded border border-dashed border-ink-300 p-4 text-center text-xs text-ink-500">
            이 화면에 그린 네모가 없습니다.
            <br />
            캔버스에서 <span className="font-medium text-mark">빨간 네모</span> 도구로 영역을 드래그하세요.
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {drafts.map((d, i) => {
              const selected = d.id === selectedId;
              return (
                <li
                  key={d.id}
                  onClick={() => onSelect(d.id)}
                  className={cn("rounded border p-3 transition-colors", selected ? "border-mark bg-red-50/40" : "border-ink-200 hover:border-ink-400")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="grid size-5 place-items-center bg-mark text-[11px] text-white">{i + 1}</span>
                      {i + 1}번 네모
                    </span>
                    <div className="flex items-center gap-1">
                      <Select value={d.kind} onChange={(e) => onChange(d.id, { kind: e.target.value as RequestKind })} className="h-7 w-auto py-0 text-xs" onClick={(e) => e.stopPropagation()}>
                        <option value="ai">{REQUEST_KIND_LABEL.ai}</option>
                        <option value="expert">{REQUEST_KIND_LABEL.expert}</option>
                      </Select>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(d.id);
                        }}
                        className="grid size-7 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-mark"
                        title="삭제"
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <Textarea
                    ref={(el) => {
                      refs.current[d.id] = el;
                    }}
                    value={d.message}
                    onChange={(e) => onChange(d.id, { message: e.target.value })}
                    onFocus={() => onSelect(d.id)}
                    placeholder={d.kind === "ai" ? "예: 이 제목을 더 짧고 명확하게" : "예: 이 이미지를 실제 매장 사진으로 교체해 주세요"}
                    className="mt-2 min-h-16 text-[13px]"
                    maxLength={2000}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="border-t border-ink-100 px-4 py-3">
        <QuotaLine label={REQUEST_KIND_LABEL.ai} q={quota.ai} pending={counts.ai} />
        <QuotaLine label={REQUEST_KIND_LABEL.expert} q={quota.expert} pending={counts.expert} />

        {!hasPlan && !demo ? (
          <Alert tone="blue" className="mt-3 text-xs">
            플랜이 있어야 요청을 보낼 수 있습니다.{" "}
            <Link href="/billing" className="font-medium underline">
              플랜 선택
            </Link>
          </Alert>
        ) : null}
        {overAi > 0 || overExpert > 0 ? (
          <Alert tone={shortAi > 0 || shortExpert > 0 ? "red" : "gray"} className="mt-3 text-xs">
            주간 한도를 넘는 요청 {overAi > 0 ? `AI ${overAi}건` : ""}
            {overAi > 0 && overExpert > 0 ? ", " : ""}
            {overExpert > 0 ? `전문가 ${overExpert}건` : ""}은 크레딧에서 차감됩니다.
            {shortAi > 0 || shortExpert > 0 ? (
              <>
                {" "}
                크레딧이 {shortAi > 0 ? `AI ${shortAi}건` : ""}
                {shortAi > 0 && shortExpert > 0 ? ", " : ""}
                {shortExpert > 0 ? `전문가 ${shortExpert}건` : ""} 부족합니다.{" "}
                <Link href="/billing#credits" className="font-medium underline">
                  크레딧 구매
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
        {missingMessage ? <p className="mt-2 text-xs text-mark">요청사항이 비어 있는 네모가 있습니다.</p> : null}
        {error ? <Alert tone="red" className="mt-3 text-xs">{error}</Alert> : null}

        <Button className="mt-3 w-full" size="lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
          {submitting ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
          한번에 요청하기{totalCount > 0 ? ` (${totalCount}건)` : ""}
        </Button>
        {totalCount > drafts.length ? <p className="mt-1.5 text-center text-[11px] text-ink-500">다른 페이지·화면의 네모 {totalCount - drafts.length}건도 함께 보냅니다.</p> : null}
      </div>
    </aside>
  );
}

function QuotaLine({ label, q, pending }: { label: string; q: QuotaInfo["ai"]; pending: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-500">{label}</span>
      <span className="tabular-nums">
        {q.weekly === null ? (
          <span className="text-ink-700">이번 주 무제한</span>
        ) : (
          <span className={cn(q.remaining !== null && pending > q.remaining ? "text-mark" : "text-ink-700")}>
            이번 주 {q.used + pending}/{q.weekly}
          </span>
        )}
        {q.credits > 0 ? <span className="ml-2 text-ink-400">크레딧 {q.credits}</span> : null}
      </span>
    </div>
  );
}
