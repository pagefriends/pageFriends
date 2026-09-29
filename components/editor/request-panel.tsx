"use client";

import { LoaderCircleIcon, SendIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import type { DraftBox } from "@/components/editor/types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { REQUEST_KIND_LABEL, formatTokens, type RequestKind } from "@/config/plans";
import type { QuotaInfo } from "@/lib/quota";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

const PLACEHOLDER: Record<RequestKind, string> = {
  ai: "예: 폰트 크기가 조금 커요. 글자 색을 조금 더 밝게 해주세요.",
  expert: "예: 이 이미지를 실제 매장 사진으로 교체해 주세요.",
  bug: "예: 버튼을 눌러도 아무 반응이 없어요. (무료 · 차감 없음)",
};

/**
 * 오른쪽 요청 패널. 현재 페이지·디바이스의 네모 목록 + 요청사항 입력 + 한 번에 제출.
 *
 * 네모와 요청은 1:1 이다: 캔버스의 N번 빨간 네모 = 이 목록의 N번 카드. 카드에 마우스를 올리면 캔버스의 네모가,
 * 네모에 올리면 카드가 같이 강조되어 어느 요청이 어느 영역인지 헷갈리지 않는다.
 */
export function RequestPanel({
  drafts,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
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
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
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
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // 네모를 새로 그리거나 캔버스에서 고르면 그 카드로 스크롤 + 입력칸 포커스
  useEffect(() => {
    if (!selectedId) return;
    itemRefs.current[selectedId]?.scrollIntoView({ block: "nearest" });
    refs.current[selectedId]?.focus({ preventScroll: true });
  }, [selectedId]);

  // AI: 남은 토큰(한도 + 크레딧)이 0 이면 AI 요청 불가. 실제 차감은 처리 후 사용량 기준.
  const aiLeft = quota.ai.remaining === null ? null : quota.ai.remaining + quota.ai.credits;
  const aiBlocked = counts.ai > 0 && aiLeft !== null && aiLeft <= 0;
  // 전문가: 주간 한도 초과분은 횟수 크레딧에서 차감
  const overExpert = quota.expert.remaining === null ? 0 : Math.max(0, counts.expert - quota.expert.remaining);
  const shortExpert = Math.max(0, overExpert - quota.expert.credits);
  const missingMessage = drafts.some((d) => !d.message.trim());
  const canSubmit = totalCount > 0 && !missingMessage && !aiBlocked && shortExpert === 0 && (hasPlan || demo);

  return (
    <aside className="flex flex-col border-t border-ink-200 bg-surface lg:h-full lg:border-t-0 lg:border-l">
      <div className="border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold">수정 요청</h2>
        <p className="mt-0.5 text-xs text-ink-500">네모 하나에 요청 하나. 번호가 캔버스의 빨간 네모와 같습니다.</p>
      </div>

      <div className="max-h-[50vh] overflow-y-auto px-4 py-3 lg:max-h-none lg:flex-1">
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
              const hovered = d.id === hoveredId;
              return (
                <li
                  key={d.id}
                  ref={(el) => {
                    itemRefs.current[d.id] = el;
                  }}
                  onClick={() => onSelect(d.id)}
                  onMouseEnter={() => onHover(d.id)}
                  onMouseLeave={() => onHover(null)}
                  className={cn(
                    "rounded border p-3 transition-colors",
                    selected ? "border-mark bg-red-50/40" : hovered ? "border-mark" : "border-ink-200 hover:border-ink-400",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold">
                      <span className="grid size-5 place-items-center bg-mark text-[11px] text-white">{i + 1}</span>
                      {i + 1}번 네모
                      {d.kind === "bug" ? <span className="text-[11px] font-medium text-sky-600">무료</span> : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <Select
                        value={d.kind}
                        onChange={(e) => onChange(d.id, { kind: e.target.value as RequestKind })}
                        className="h-7 w-auto py-0 text-xs"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${i + 1}번 네모 요청 종류`}
                      >
                        <option value="ai">{REQUEST_KIND_LABEL.ai}</option>
                        <option value="expert">{REQUEST_KIND_LABEL.expert}</option>
                        <option value="bug">{REQUEST_KIND_LABEL.bug}</option>
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
                    placeholder={PLACEHOLDER[d.kind]}
                    aria-label={`${i + 1}번 네모 요청사항`}
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
        <TokenLine q={quota.ai} pending={counts.ai} />
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-500">{REQUEST_KIND_LABEL.expert}</span>
          <span className="tabular-nums">
            {quota.expert.weekly === null ? (
              <span className="text-ink-700">이번 주 무제한</span>
            ) : (
              <span className={cn(quota.expert.remaining !== null && counts.expert > quota.expert.remaining ? "text-mark" : "text-ink-700")}>
                이번 주 {quota.expert.used + counts.expert}/{quota.expert.weekly}회
              </span>
            )}
            {quota.expert.credits > 0 ? <span className="ml-2 text-ink-400">크레딧 {quota.expert.credits}회</span> : null}
          </span>
        </div>
        {counts.bug > 0 ? (
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-500">{REQUEST_KIND_LABEL.bug}</span>
            <span className="text-ink-700">{counts.bug}건 · 무료</span>
          </div>
        ) : null}

        {!hasPlan && !demo ? (
          <Alert tone="blue" className="mt-3 text-xs">
            플랜이 있어야 요청을 보낼 수 있습니다.{" "}
            <Link href="/billing" className="font-medium underline">
              플랜 선택
            </Link>
          </Alert>
        ) : null}
        {aiBlocked ? (
          <Alert tone="red" className="mt-3 text-xs">
            이번 달 AI 토큰을 모두 썼습니다. AI 반영 {counts.ai}건을 보내려면{" "}
            <Link href="/billing#credits" className="font-medium underline">
              토큰 크레딧
            </Link>
            을 구매하거나 {formatDate(quota.ai.periodEnd)} 이후에 요청하세요.
          </Alert>
        ) : null}
        {overExpert > 0 ? (
          <Alert tone={shortExpert > 0 ? "red" : "gray"} className="mt-3 text-xs">
            주간 한도를 넘는 전문가 요청 {overExpert}건은 크레딧에서 차감됩니다.
            {shortExpert > 0 ? (
              <>
                {" "}
                크레딧이 {shortExpert}회 부족합니다.{" "}
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

/** AI 토큰 사용량 줄 + 게이지. 크레딧은 한도 다음에 쓰이므로 게이지 바깥에 따로 적는다. */
function TokenLine({ q, pending }: { q: QuotaInfo["ai"]; pending: number }) {
  const ratio = q.monthly === null || q.monthly === 0 ? 0 : Math.min(1, q.used / q.monthly);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-500">
          AI 토큰{pending > 0 ? <span className="ml-1 text-ink-400">· 대기 {pending}건</span> : null}
        </span>
        <span className="tabular-nums text-ink-700">
          {q.monthly === null ? "이번 달 무제한" : `이번 달 ${formatTokens(q.used)} / ${formatTokens(q.monthly)}`}
          {q.credits > 0 ? <span className="ml-2 text-ink-400">크레딧 {formatTokens(q.credits)}</span> : null}
        </span>
      </div>
      {q.monthly !== null ? (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
          <div className={cn("h-full rounded-full", ratio >= 0.9 ? "bg-mark" : "bg-sky-400")} style={{ width: `${ratio * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}
