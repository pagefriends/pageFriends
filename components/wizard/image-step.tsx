"use client";

import { ChevronDownIcon, ImageIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Tip } from "@/components/wizard/parts";
import { Alert, Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APPROX_TOKENS_PER_AI_REQUEST, APPROX_TOKENS_PER_IMAGE, formatTokens } from "@/config/plans";
import { RATIO_SHAPE, RATIO_SIZE, emptyImageCount, generatedImageCount, type ImageSlot, type SitePlan } from "@/lib/site-plan";
import { cn } from "@/lib/utils";

export type SlotOverrides = Record<string, { need?: string; generate?: boolean }>;

/**
 * 이미지 단계. "AI로 이미지 만들어 넣기" 를 켜면 AI 로 만들 수 있는 자리를 만들고(토큰을 많이 쓴다는 안내와 예상치),
 * 끄면 자리를 비워 두고 자리마다 어떤 이미지가 필요한지 적어 둔다. 실제 사진이어야 하는 자리는 켜도 만들지 않는다.
 */
export function ImageStep({
  plan,
  generate,
  onGenerate,
  overrides,
  onOverride,
  hasPlan,
  tokenBudget,
  expert,
  guided,
  pageName,
}: {
  /** 지금 입력(켜기·자리별 선택·설명)을 반영한 계획 */
  plan: SitePlan;
  generate: boolean;
  onGenerate: (v: boolean) => void;
  overrides: SlotOverrides;
  onOverride: (id: string, patch: { need?: string; generate?: boolean } | null) => void;
  hasPlan: boolean;
  /** 이번 달 남은 토큰 (한도 + 크레딧). null = 무제한 */
  tokenBudget: number | null;
  expert: boolean;
  guided: boolean;
  pageName: (path: string) => string;
}) {
  const images = plan.images;
  const aiSlots = images.filter((s) => s.source === "ai");
  const realSlots = images.filter((s) => s.source === "real");
  const totalCount = images.reduce((n, s) => n + s.count, 0);
  const selected = generatedImageCount(images);
  const estimate = selected * APPROX_TOKENS_PER_IMAGE;
  const over = generate && tokenBudget !== null && estimate > tokenBudget;
  const pct = tokenBudget && tokenBudget > 0 ? Math.round((estimate / tokenBudget) * 100) : null;
  const [listOpen, setListOpen] = useState(!guided);
  const showList = listOpen || over;

  // 자리가 처음 나오는 페이지별로 묶는다
  const groups: { path: string; slots: ImageSlot[] }[] = [];
  for (const s of images) {
    const path = s.pages[0] ?? "/";
    const g = groups.find((x) => x.path === path);
    if (g) g.slots.push(s);
    else groups.push({ path, slots: [s] });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-700">
        지금 구성에서 이미지가 들어갈 자리는 <b>{images.length}곳</b>
        {totalCount > images.length ? ` (사진 ${totalCount}장)` : ""}이에요.
      </p>

      {guided ? (
        <Tip title="이미지 자리란?">
          사이트에는 첫 화면 큰 사진, 서비스 카드 사진처럼 이미지가 들어갈 자리가 있어요. AI로 바로 채우거나, 비워 두고 나중에 직접 찍은 사진으로 채울 수 있어요.
        </Tip>
      ) : null}

      {/* 선택: AI 로 만들기 */}
      <label
        className={cn(
          "flex cursor-pointer gap-3 rounded-md border p-4 transition-colors",
          generate ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400",
          (!hasPlan || aiSlots.length === 0) && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-sky-500"
          checked={generate}
          disabled={!hasPlan || aiSlots.length === 0}
          onChange={(e) => onGenerate(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <SparklesIcon className="size-4 text-sky-600" />
            <span className="font-semibold">AI로 이미지 만들어 넣기</span>
            <Badge tone="red">토큰 많이 사용</Badge>
          </span>
          <span className="mt-1 block text-[13px] text-ink-500">
            AI가 자리마다 어울리는 이미지를 직접 만들어 넣어요. AI로 만들 수 있는 자리 {aiSlots.length}곳 · 1장에 약 {formatTokens(APPROX_TOKENS_PER_IMAGE)} 토큰
            (글 수정 요청 1건의 약 {Math.round(APPROX_TOKENS_PER_IMAGE / APPROX_TOKENS_PER_AI_REQUEST)}배).
          </span>
          {!hasPlan ? (
            <span className="mt-1 block text-[13px] text-ink-700">
              토큰은 플랜에 포함되어 있어 플랜을 고른 뒤에 쓸 수 있어요.{" "}
              <Link href="/billing" className="font-medium text-brand-600 underline">
                플랜 선택
              </Link>
            </span>
          ) : null}
        </span>
      </label>

      {generate ? (
        <Alert tone={over ? "red" : "blue"}>
          <p className="font-semibold">이미지 생성은 토큰을 많이 써요</p>
          <p className="mt-1">
            {selected}장 × 약 {formatTokens(APPROX_TOKENS_PER_IMAGE)} = <b>약 {formatTokens(estimate)} 토큰</b>
            {tokenBudget === null ? " (무제한 플랜)" : <> · 이번 달 남은 토큰 {formatTokens(tokenBudget)}{pct !== null ? `의 약 ${pct}%` : ""}</>}
          </p>
          {over ? (
            <p className="mt-1">
              남은 토큰보다 많아요. 아래 목록에서 만들 이미지를 줄이거나{" "}
              <Link href="/billing#credits" className="font-medium underline">
                토큰 크레딧
              </Link>
              을 구매해 주세요.
            </p>
          ) : (
            <p className="mt-1 text-[13px] opacity-90">실제 사용량은 이미지를 만든 뒤 기록되고, 요청 내역에서 진행 상황을 볼 수 있어요. 고른 자리는 아래에서 바꿀 수 있어요.</p>
          )}
        </Alert>
      ) : (
        <Alert tone="gray">
          <p className="font-semibold">이미지 자리는 비워 둔 채로 만들어요</p>
          <p className="mt-1">
            빈 자리마다 <b>어떤 이미지가 필요한지</b> 적어 둬요. 편집 화면에서 확인하고, 사진을 준비하거나 그 자리만 AI로 만들어 달라고 요청하면 돼요.
          </p>
        </Alert>
      )}

      {realSlots.length > 0 ? (
        <p className="flex gap-2 text-[13px] leading-relaxed text-ink-500">
          <ImageIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            대표·구성원 사진, 매장·상품·작업물처럼 <b className="text-ink-700">실제 모습이어야 하는 자리 {realSlots.length}곳</b>은 AI로 만들지 않고 비워 둬요. 실제와 다른
            사진이 들어가면 고객이 오해할 수 있어서예요.
          </span>
        </p>
      ) : null}

      <div className="rounded-md border border-ink-200">
        <button type="button" onClick={() => setListOpen(!showList)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold">
          <span>
            이미지 자리 목록 <span className="font-normal text-ink-500">· {images.length}곳{generate ? ` · AI로 만들 자리 ${images.filter((s) => s.generate).length}곳` : ""}{!generate ? ` · 비워 둘 사진 ${emptyImageCount(images)}장` : ""}</span>
          </span>
          <ChevronDownIcon className={cn("size-4 transition-transform", showList && "rotate-180")} />
        </button>
        {showList ? (
          <div className="border-t border-ink-100">
            {groups.map((g) => (
              <section key={g.path} className="border-b border-ink-100 px-4 py-3 last:border-b-0">
                <p className="text-xs font-semibold text-ink-500">{pageName(g.path)}</p>
                <ul className="mt-1 divide-y divide-ink-100">
                  {g.slots.map((s) => {
                    const canPick = generate && s.source === "ai";
                    const raw = overrides[s.id]?.need;
                    return (
                      <li key={s.id} className="flex gap-3 py-2.5">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-sky-500"
                          checked={s.generate}
                          disabled={!canPick}
                          onChange={(e) => onOverride(s.id, { generate: e.target.checked })}
                          aria-label={`${s.label} AI로 만들기`}
                          title={s.source === "real" ? "실제 사진이 필요한 자리라 AI로 만들지 않아요" : !generate ? "위에서 'AI로 이미지 만들어 넣기' 를 켜면 고를 수 있어요" : undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">{s.label}</span>
                            {s.count > 1 ? <span className="text-xs text-ink-500">{s.count}장</span> : null}
                            {s.generate ? (
                              <Badge tone="blue">AI로 만들어요</Badge>
                            ) : s.source === "real" ? (
                              <Badge tone="dark">실제 사진 필요</Badge>
                            ) : (
                              <Badge tone="gray">비워 둠</Badge>
                            )}
                          </div>
                          {expert ? (
                            <Input
                              value={raw ?? s.need}
                              onChange={(e) => onOverride(s.id, { need: e.target.value })}
                              onBlur={(e) => {
                                if (!e.target.value.trim()) onOverride(s.id, { need: undefined });
                              }}
                              maxLength={200}
                              className="mt-1.5 h-9 text-[13px]"
                              aria-label={`${s.label}에 필요한 이미지 설명`}
                            />
                          ) : (
                            <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{s.need}</p>
                          )}
                          <p className="mt-1 text-xs text-ink-400">
                            권장 {RATIO_SIZE[s.ratio]} · {RATIO_SHAPE[s.ratio]}
                            {s.pages.length > 1 ? ` · ${s.pages.map(pageName).join(", ")}에 함께 쓰여요` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {expert ? <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">설명을 고치면 빈 자리에 적히는 글과 AI에게 주는 지시가 함께 바뀝니다.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
