"use client";

import { ChevronDownIcon, ImageIcon, LoaderCircleIcon, SendIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { DraftBox, EditorSlot, ExistingRequest } from "@/components/editor/types";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { APPROX_TOKENS_PER_IMAGE, REQUEST_KIND_LABEL, formatTokens, type RequestKind } from "@/config/plans";
import { REQUEST_KIND_PROMISE, requestStatus } from "@/config/requests";
import type { QuotaInfo } from "@/lib/quota";
import { SlotPhotos } from "@/components/photos/slot-photos";
import { RATIO_SHAPE, RATIO_SIZE } from "@/lib/site-plan";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

/** 오른쪽 "이미지 자리" 목록의 한 줄: 자리 설명 + 이 화면에 위치가 있는지 + 그 자리에 보낸 요청 + 이미 그린 초안 네모 */
export type PanelSlot = { slot: EditorSlot; located: boolean; request: ExistingRequest | null; drafted: boolean };

function slotStatus(item: PanelSlot): { label: string; tone: "blue" | "sky" | "gray" | "dark" } {
  const r = item.request;
  if (r) {
    const st = requestStatus(r.kind, r.status);
    return { label: st.label, tone: st.tone === "red" ? "gray" : st.tone };
  }
  const photos = item.slot.photos?.length ?? 0;
  if (photos >= item.slot.count) return { label: "사진 올림", tone: "sky" };
  if (photos > 0) return { label: `사진 ${photos}/${item.slot.count}장`, tone: "blue" };
  // 위저드에서 AI 로 만들기로 골랐어도 요청이 없으면(접수 실패·반영 불가) 다시 요청할 수 있게 빈 자리로 본다
  if (item.slot.source === "real") return { label: "실제 사진 필요", tone: "dark" };
  return { label: "이미지 필요", tone: "gray" };
}

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
 *
 * 그 아래 "보낸 요청" 은 이 화면에서 이미 보내 아직 진행 중인 요청(캔버스의 파란 네모)이다. 상태와 담당자의 마지막 글이
 * 보이고, 대화는 요청 내역 화면에서 이어 간다. 빨간 초안과 섞이지 않게 번호 칩도 파란색으로 그린다.
 */
export function RequestPanel({
  drafts,
  sent,
  requestsHref,
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
  projectId = null,
  slots = [],
  hoveredSlot = null,
  onSlotHover,
  onSlotFocus,
  onSlotAi,
}: {
  drafts: DraftBox[];
  /** 이 페이지·디바이스에서 이미 보낸, 아직 진행 중인 요청 */
  sent: ExistingRequest[];
  /** 요청 내역 화면 주소. 체험 모드에서는 null (대화로 가는 링크를 숨긴다) */
  requestsHref: string | null;
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
  /** 사진 올리기에 쓰는 프로젝트 id. 체험 모드에서는 null (올리기 숨김) */
  projectId?: string | null;
  /** 이 페이지의 이미지 자리 (구성 초안으로 만든 사이트만) */
  slots?: PanelSlot[];
  hoveredSlot?: string | null;
  onSlotHover?: (id: string | null) => void;
  /** 캔버스를 그 자리로 옮긴다 */
  onSlotFocus?: (id: string) => void;
  /** 그 자리에 AI 반영 네모를 만들고 요청 글을 채운다 */
  onSlotAi?: (id: string) => void;
}) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [slotsOpen, setSlotsOpen] = useState(true);
  const emptySlots = slots.filter((i) => !i.request && (i.slot.photos?.length ?? 0) < i.slot.count).length;
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
        {slots.length > 0 ? (
          <section className="mb-4 rounded border border-ink-200">
            <button type="button" onClick={() => setSlotsOpen(!slotsOpen)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold" aria-expanded={slotsOpen}>
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-ink-500" /> 이 페이지의 이미지 자리 {slots.length}곳
                {emptySlots > 0 ? <span className="font-normal text-ink-500">· 비어 있음 {emptySlots}</span> : null}
              </span>
              <ChevronDownIcon className={cn("size-3.5 shrink-0 text-ink-500 transition-transform", slotsOpen && "rotate-180")} />
            </button>
            {slotsOpen ? (
              <ul className="divide-y divide-ink-100 border-t border-ink-100">
                {slots.map((item) => {
                  const st = slotStatus(item);
                  const s = item.slot;
                  return (
                    <li
                      key={s.id}
                      onMouseEnter={() => onSlotHover?.(s.id)}
                      onMouseLeave={() => onSlotHover?.(null)}
                      onClick={() => item.located && onSlotFocus?.(s.id)}
                      className={cn("px-3 py-2.5 text-xs transition-colors", item.located && "cursor-pointer", hoveredSlot === s.id && "bg-sky-50")}
                      title={item.located ? "누르면 캔버스에서 이 자리로 이동해요" : undefined}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="text-[13px] font-semibold text-ink-900">{s.label}</span>
                        {s.count > 1 ? <span className="text-ink-500">{s.count}장</span> : null}
                      </div>
                      <p className="mt-1 leading-relaxed text-ink-700">{s.need}</p>
                      <p className="mt-0.5 text-ink-400">
                        권장 {RATIO_SIZE[s.ratio]} · {RATIO_SHAPE[s.ratio]}
                      </p>
                      {item.request ? (
                        requestsHref ? (
                          <Link href={`${requestsHref}#r-${item.request.id}`} onClick={(e) => e.stopPropagation()} className="mt-1.5 inline-block font-medium text-brand-600 hover:underline">
                            요청 내역에서 보기 →
                          </Link>
                        ) : null
                      ) : (s.photos?.length ?? 0) >= s.count ? null : s.source === "real" ? (
                        <p className="mt-1.5 text-ink-500">실제 사진이 필요해요. 아래 &lsquo;사진 올리기&rsquo; 로 올려 주시면 담당자가 이 자리에 넣어 드려요.</p>
                      ) : item.drafted ? (
                        <p className="mt-1.5 font-medium text-mark">네모를 만들었어요 — 요청 목록에서 글을 확인하고 요청하기를 누르세요.</p>
                      ) : (
                        <button
                          type="button"
                          disabled={!item.located}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSlotAi?.(s.id);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-brand-300 px-2.5 py-1 font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <SparklesIcon className="size-3" /> AI로 만들기 · 약 {formatTokens(APPROX_TOKENS_PER_IMAGE)} 토큰
                        </button>
                      )}
                      {/* 갖고 있는 사진으로 채우기 — AI 로 만들 수 있는 자리도 직접 찍은 사진을 쓸 수 있다 */}
                      {projectId && !item.request ? (
                        <SlotPhotos projectId={projectId} slotId={s.id} label={s.label} count={s.count} photos={s.photos ?? []} className="mt-2" />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}

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
                  <p className="mt-1.5 text-[11px] text-ink-500">{REQUEST_KIND_PROMISE[d.kind]}</p>
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

        {sent.length > 0 ? (
          <div className="mt-4">
            <p className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-400">
              <span>보낸 요청 · 파란 네모 {sent.length}건</span>
              {requestsHref ? (
                <Link href={requestsHref} className="font-medium text-brand-600 hover:underline">
                  전체 내역
                </Link>
              ) : null}
            </p>
            <ul className="flex flex-col gap-2">
              {sent.map((r) => (
                <li
                  key={r.id}
                  onMouseEnter={() => onHover(r.id)}
                  onMouseLeave={() => onHover(null)}
                  className={cn("rounded border p-2.5 text-xs transition-colors", hoveredId === r.id ? "border-brand-500" : "border-ink-200")}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="grid h-5 min-w-5 place-items-center bg-brand-500 px-1 text-[11px] font-semibold text-white">#{r.seq}</span>
                    <span className="text-ink-500">{REQUEST_KIND_LABEL[r.kind]}</span>
                    <span className="font-medium text-ink-700">{requestStatus(r.kind, r.status).label}</span>
                    {r.awaiting ? (
                      <span className="rounded-sm bg-sky-400 px-1 text-[10px] leading-4 font-semibold text-night-950">확인 필요</span>
                    ) : r.unread ? (
                      <span className="rounded-sm bg-sky-400 px-1 text-[10px] leading-4 font-semibold text-night-950">새 답변</span>
                    ) : null}
                  </div>
                  {r.due ? <p className="mt-1 text-[11px] text-ink-500">답변 기한 · {r.due}</p> : null}
                  {r.message ? <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-900">{r.message}</p> : null}
                  {r.lastReply ? (
                    <p className="mt-1 line-clamp-2 text-ink-500">
                      <span className="font-medium text-ink-700">담당자</span> {r.lastReply}
                    </p>
                  ) : null}
                  {requestsHref ? (
                    <Link href={`${requestsHref}#r-${r.id}`} className="mt-1.5 inline-block font-medium text-brand-600 hover:underline">
                      {r.awaiting ? "답글 쓰러 가기" : "대화 열기"} →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
            이번 달 토큰을 모두 썼습니다. AI 반영 {counts.ai}건을 보내려면{" "}
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
          요청하기{totalCount > 0 ? ` (${totalCount}건)` : ""}
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
          토큰{pending > 0 ? <span className="ml-1 text-ink-400">· 대기 {pending}건</span> : null}
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
