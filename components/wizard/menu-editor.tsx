"use client";

import { ArrowDownIcon, ArrowUpIcon, CornerDownRightIcon, HomeIcon, PlusIcon, StickyNoteIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import { Chip, Tip } from "@/components/wizard/parts";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { MENU_LIMITS, PAGE_KIND_LABEL, SELECTABLE_KINDS, contrastText, countPages, inferPageKind, type MenuLeaf, type MenuNode, type Offering, type PageKind } from "@/lib/site-plan";
import { cn } from "@/lib/utils";

/** 자주 쓰는 메뉴. 이미 있는 이름은 숨긴다 */
const QUICK: { label: string; kind: PageKind }[] = [
  { label: "회사 소개", kind: "about" },
  { label: "서비스", kind: "services" },
  { label: "포트폴리오", kind: "portfolio" },
  { label: "고객 후기", kind: "reviews" },
  { label: "공지사항", kind: "notice" },
  { label: "자주 묻는 질문", kind: "faq" },
  { label: "오시는 길", kind: "location" },
  { label: "문의하기", kind: "contact" },
  { label: "예약", kind: "reservation" },
  { label: "요금 안내", kind: "pricing" },
  { label: "채용", kind: "careers" },
  { label: "블로그", kind: "blog" },
];

const leaf = (label: string, kind: PageKind | null = null): MenuLeaf => ({ label, kind, note: "", offering: null });

/**
 * 헤더 메뉴 · 하위 페이지 편집기.
 * 하위 페이지가 있는 메뉴는 "묶음" 이다: 자기 페이지가 없고 누르면 첫 하위 페이지로 간다. 그래서 하위 페이지 없는 메뉴에
 * 처음 하위 페이지를 더하면 지금 페이지를 첫 하위 페이지로 내리고 새 페이지를 하나 더한다 — 페이지가 사라지지 않고 하나만 는다.
 */
export function MenuEditor({
  menu,
  onChange,
  siteName,
  cta,
  primaryColor,
  maxPages,
  planName,
  expert,
  guided,
  offerings,
  homeNote,
  onHomeNote,
  onRecommend,
  recommended,
}: {
  menu: MenuNode[];
  onChange: (menu: MenuNode[]) => void;
  siteName: string;
  cta: string;
  primaryColor: string;
  maxPages: number;
  planName: string;
  expert: boolean;
  guided: boolean;
  offerings: Offering[];
  homeNote: string;
  onHomeNote: (v: string) => void;
  onRecommend: () => void;
  /** 지금 메뉴가 추천 구성 그대로인지 */
  recommended: boolean;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const pages = countPages(menu);
  const full = pages >= maxPages;
  const over = pages > maxPages;

  const set = (next: MenuNode[]) => onChange(next);
  const patchTop = (i: number, patch: Partial<MenuNode>) => set(menu.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const patchChild = (i: number, j: number, patch: Partial<MenuLeaf>) =>
    set(menu.map((m, k) => (k === i ? { ...m, children: m.children.map((c, l) => (l === j ? { ...c, ...patch } : c)) } : m)));
  const move = <T,>(list: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= list.length) return list;
    const next = list.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    return next;
  };
  const addTop = (label: string, kind: PageKind | null = null) => {
    const v = label.trim().slice(0, MENU_LIMITS.label);
    if (!v || full || menu.length >= MENU_LIMITS.top) return;
    set([...menu, { ...leaf(v, kind), children: [] }]);
  };
  const addChild = (i: number) => {
    const m = menu[i];
    if (full || m.children.length >= MENU_LIMITS.children) return;
    // 하위 페이지가 없던 메뉴: 지금 페이지를 첫 하위 페이지로 내리고 새 페이지를 더한다
    const children = m.children.length > 0 ? [...m.children, leaf("")] : [{ label: m.label, kind: m.kind, note: m.note, offering: m.offering ?? null }, leaf("")];
    patchTop(i, { children, kind: null, note: "", offering: null });
  };
  const removeChild = (i: number, j: number) => {
    const m = menu[i];
    const children = m.children.filter((_, l) => l !== j);
    // 하위 페이지를 다 지우면 다시 자기 페이지가 있는 메뉴가 된다
    if (children.length === 0) patchTop(i, { children: [], kind: null });
    else patchTop(i, { children });
  };
  const toggleNote = (key: string) =>
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const kindSelect = (item: MenuLeaf, onKind: (k: PageKind | null) => void, label: string) => {
    const auto = inferPageKind(item.label, offerings).kind;
    return (
      <Select
        value={item.kind ?? ""}
        onChange={(e) => onKind((e.target.value || null) as PageKind | null)}
        className="h-9 w-full py-0 text-xs sm:w-44"
        aria-label={`${label} 페이지 종류`}
        title="페이지 종류에 따라 들어갈 구역과 이미지 자리가 정해집니다"
      >
        <option value="">자동 · {PAGE_KIND_LABEL[auto]}</option>
        {item.kind === "service" ? <option value="service">{PAGE_KIND_LABEL.service}</option> : null}
        {SELECTABLE_KINDS.map((k) => (
          <option key={k} value={k}>
            {PAGE_KIND_LABEL[k]}
          </option>
        ))}
      </Select>
    );
  };

  const noteBox = (key: string, value: string, onValue: (v: string) => void) =>
    openNotes.has(key) || value ? (
      <Textarea
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder="이 페이지에 넣을 내용 (예: 진행 순서 4단계를 그림으로, 가격표는 표로)"
        className="mt-2 min-h-16 text-[13px]"
        maxLength={MENU_LIMITS.note}
        aria-label="이 페이지에 넣을 내용"
      />
    ) : null;

  const quick = QUICK.filter((q) => !menu.some((m) => m.label === q.label || m.children.some((c) => c.label === q.label)));

  return (
    <div className="flex flex-col gap-4">
      {guided ? (
        <Tip title="헤더 메뉴와 하위 페이지란?">
          <b>헤더 메뉴</b>는 사이트 맨 위에 늘 보이는 메뉴예요. 메뉴 아래에 <b>하위 페이지</b>를 둘 수 있어요 (예: 회사 소개 › 인사말 · 오시는 길). 업종과 목적에 맞춰
          추천 구성을 만들어 두었으니 그대로 써도 되고, 이름을 바꾸거나 지우고 더해도 돼요.
        </Tip>
      ) : null}

      <HeaderPreview menu={menu} siteName={siteName} cta={cta} primaryColor={primaryColor} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-sm tabular-nums", over ? "font-semibold text-mark" : "text-ink-500")}>
          페이지 {pages} / {maxPages} <span className="text-xs">(홈 포함 · {planName} 플랜)</span>
        </p>
        <Button variant="ghost" size="sm" onClick={onRecommend} disabled={recommended} title="업종 · 목적 · 서비스에 맞춘 구성으로 다시 만듭니다">
          <WandSparklesIcon className="size-3.5" /> {recommended ? "추천 구성 사용 중" : "추천 구성으로 되돌리기"}
        </Button>
      </div>
      {over ? (
        <p className="-mt-2 text-xs text-mark">
          {planName} 플랜은 홈을 포함해 {maxPages}페이지까지예요. 메뉴나 하위 페이지를 {pages - maxPages}개 줄이거나 플랜을 올려 주세요.
        </p>
      ) : null}

      <ol className="flex flex-col gap-2">
        <li className="rounded-md border border-ink-200 bg-ink-50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <HomeIcon className="size-4 text-ink-400" />
            <span className="font-semibold">홈</span>
            <span className="text-xs text-ink-500">로고를 누르면 가는 첫 화면 · 항상 있어요</span>
            {expert ? (
              <button type="button" onClick={() => toggleNote("home")} className="ml-auto inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900">
                <StickyNoteIcon className="size-3.5" /> 넣을 내용
              </button>
            ) : null}
          </div>
          {expert ? noteBox("home", homeNote, onHomeNote) : null}
        </li>

        {menu.map((m, i) => {
          const group = m.children.length > 0;
          return (
            <li key={i} className="rounded-md border border-ink-200 bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className="w-4 shrink-0 text-center text-xs text-ink-400">{i + 1}</span>
                <Input
                  value={m.label}
                  onChange={(e) => patchTop(i, { label: e.target.value })}
                  maxLength={MENU_LIMITS.label}
                  placeholder="메뉴 이름"
                  aria-label={`${i + 1}번 메뉴 이름`}
                  className={cn("h-9 min-w-0 flex-1", !m.label.trim() && "border-mark")}
                />
                {expert && !group ? <div className="w-full sm:w-auto">{kindSelect(m, (kind) => patchTop(i, { kind, offering: kind === "service" ? m.offering : null }), m.label)}</div> : null}
                <div className="ml-auto flex shrink-0 items-center">
                  <IconBtn title="위로" onClick={() => set(move(menu, i, i - 1))} disabled={i === 0}>
                    <ArrowUpIcon className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="아래로" onClick={() => set(move(menu, i, i + 1))} disabled={i === menu.length - 1}>
                    <ArrowDownIcon className="size-3.5" />
                  </IconBtn>
                  <IconBtn title={group ? "메뉴와 하위 페이지 삭제" : "메뉴 삭제"} onClick={() => set(menu.filter((_, k) => k !== i))} danger>
                    <Trash2Icon className="size-3.5" />
                  </IconBtn>
                </div>
              </div>
              {expert && !group ? noteBox(`${i}`, m.note, (note) => patchTop(i, { note })) : null}

              {group ? (
                <ul className="mt-2 ml-2 flex flex-col gap-1.5 border-l border-ink-200 pl-3 sm:ml-6">
                  {m.children.map((c, j) => (
                    <li key={j}>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <CornerDownRightIcon className="size-3.5 shrink-0 text-ink-400" />
                        <Input
                          value={c.label}
                          onChange={(e) => patchChild(i, j, { label: e.target.value })}
                          maxLength={MENU_LIMITS.label}
                          placeholder="하위 페이지 이름"
                          aria-label={`${m.label || `${i + 1}번 메뉴`}의 ${j + 1}번 하위 페이지 이름`}
                          className={cn("h-9 min-w-0 flex-1", !c.label.trim() && "border-mark")}
                        />
                        {expert ? <div className="w-full sm:w-auto">{kindSelect(c, (kind) => patchChild(i, j, { kind, offering: kind === "service" ? c.offering : null }), c.label)}</div> : null}
                        <div className="ml-auto flex shrink-0 items-center">
                          <IconBtn title="위로" onClick={() => patchTop(i, { children: move(m.children, j, j - 1) })} disabled={j === 0}>
                            <ArrowUpIcon className="size-3.5" />
                          </IconBtn>
                          <IconBtn title="아래로" onClick={() => patchTop(i, { children: move(m.children, j, j + 1) })} disabled={j === m.children.length - 1}>
                            <ArrowDownIcon className="size-3.5" />
                          </IconBtn>
                          <IconBtn title="하위 페이지 삭제" onClick={() => removeChild(i, j)} danger>
                            <Trash2Icon className="size-3.5" />
                          </IconBtn>
                        </div>
                      </div>
                      {expert ? (
                        <>
                          <button type="button" onClick={() => toggleNote(`${i}.${j}`)} className="mt-1 ml-6 inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-ink-900">
                            <StickyNoteIcon className="size-3" /> 이 페이지에 넣을 내용
                          </button>
                          <div className="ml-6">{noteBox(`${i}.${j}`, c.note, (note) => patchChild(i, j, { note }))}</div>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs">
                <button
                  type="button"
                  onClick={() => addChild(i)}
                  disabled={full || m.children.length >= MENU_LIMITS.children}
                  className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-400 disabled:no-underline"
                  title={full ? `${planName} 플랜의 페이지 수를 모두 썼어요` : undefined}
                >
                  <PlusIcon className="size-3.5" /> 하위 페이지 추가
                </button>
                {expert && !group ? (
                  <button type="button" onClick={() => toggleNote(`${i}`)} className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
                    <StickyNoteIcon className="size-3.5" /> 이 페이지에 넣을 내용
                  </button>
                ) : null}
                {group ? <span className="text-ink-400">하위 페이지가 있는 메뉴는 누르면 첫 번째 하위 페이지로 이동해요</span> : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-md border border-dashed border-ink-300 p-3">
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTop(newLabel);
                setNewLabel("");
              }
            }}
            maxLength={MENU_LIMITS.label}
            placeholder="새 메뉴 이름 (예: 이벤트)"
            aria-label="새 메뉴 이름"
            className="h-9 max-w-64"
            disabled={full || menu.length >= MENU_LIMITS.top}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              addTop(newLabel);
              setNewLabel("");
            }}
            disabled={!newLabel.trim() || full || menu.length >= MENU_LIMITS.top}
          >
            <PlusIcon className="size-3.5" /> 메뉴 추가
          </Button>
        </div>
        {quick.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <Chip key={q.label} onClick={() => addTop(q.label, q.kind)} disabled={full || menu.length >= MENU_LIMITS.top} className="px-2.5 py-1 text-xs">
                + {q.label}
              </Chip>
            ))}
          </div>
        ) : null}
        {full ? <p className="mt-2 text-xs text-ink-500">{planName} 플랜의 페이지 수({maxPages})를 모두 썼어요. 더 넣으려면 다른 페이지를 지우거나 플랜을 올려 주세요.</p> : null}
      </div>
    </div>
  );
}

function IconBtn({ danger, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn("grid size-8 place-items-center rounded text-ink-400 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-30", danger ? "hover:text-mark" : "hover:text-ink-900", className)}
      aria-label={props.title}
      {...props}
    />
  );
}

/**
 * 헤더 미리보기 — 고객 사이트의 맨 위 모습. 사이트는 흰 바탕이라 앱의 어두운 톤과 상관없이 고정 색을 쓴다.
 * 하위 페이지는 메뉴 아래에 펼친 상태로 보여 준다 (실제 사이트에서는 마우스를 올리면 펼쳐진다).
 */
export function HeaderPreview({ menu, siteName, cta, primaryColor }: { menu: MenuNode[]; siteName: string; cta: string; primaryColor: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-ink-200 bg-[#ffffff] text-[#0f172a]" aria-label="헤더 미리보기">
      <div className="flex min-w-max items-start gap-6 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="grid size-6 place-items-center rounded-[5px] text-[11px] font-bold" style={{ background: primaryColor, color: contrastText(primaryColor) }}>
            {[...(siteName.trim() || "P")][0]}
          </span>
          <span className="max-w-40 truncate text-[13px] font-bold">{siteName.trim() || "회사 이름"}</span>
        </div>
        <ul className="flex items-start gap-5">
          {menu.map((m, i) => (
            <li key={i} className="text-[13px]">
              <span className="font-semibold whitespace-nowrap">
                {m.label.trim() || "(이름 없음)"}
                {m.children.length ? <span className="ml-0.5 text-[10px] text-[#94a3b8]">▼</span> : null}
              </span>
              {m.children.length ? (
                <ul className="mt-1.5 flex flex-col gap-1 border-l border-[#e2e8f0] pl-2 text-[12px] text-[#64748b]">
                  {m.children.map((c, j) => (
                    <li key={j} className="whitespace-nowrap">
                      {c.label.trim() || "(이름 없음)"}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        <span className="ml-auto shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap" style={{ background: primaryColor, color: contrastText(primaryColor) }}>
          {cta}
        </span>
      </div>
    </div>
  );
}
