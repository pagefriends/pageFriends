"use client";

import { CheckIcon, GraduationCapIcon, LoaderCircleIcon, PlusIcon, RotateCcwIcon, Trash2Icon, WrenchIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { createProjectAction, type CreateProjectState } from "@/app/(app)/projects/new/actions";
import { ImageStep, type SlotOverrides } from "@/components/wizard/image-step";
import { HeaderPreview, MenuEditor } from "@/components/wizard/menu-editor";
import { Chip, Field, StepTitle, SummaryRow, Tip } from "@/components/wizard/parts";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { DELIVERY_DAYS, formatTokens } from "@/config/plans";
import {
  FEATURE_OPTIONS,
  INDUSTRIES,
  PAGE_KIND_LABEL,
  PURPOSES,
  buildSitePlan,
  countPages,
  ctaLabel,
  detectCategory,
  emptyImageCount,
  featuresFromPages,
  generatedImageCount,
  industryOf,
  menuFromPageNames,
  pageFullName,
  recommendMenu,
  type ContactInfo,
  type MenuNode,
  type Offering,
  type PurposeCode,
} from "@/lib/site-plan";
import type { TemplateRow } from "@/lib/types/db";
import { cn } from "@/lib/utils";

const TONES = ["깔끔한", "신뢰감 있는", "따뜻한", "고급스러운", "활기찬", "미니멀", "전문적인", "친근한"];
const COLORS = ["#2563eb", "#0ea5e9", "#1e40af", "#0f172a", "#334155", "#0284c7"];
const STEPS = ["시작", "회사 · 서비스", "메뉴 · 페이지", "디자인", "이미지", "확인"] as const;
const MAX_OFFERINGS = 8;
const STORAGE_KEY = "pf:new-site:v1";

type Mode = "guided" | "expert";

/** 위저드 입력 전체. 브라우저에 임시 저장해 두었다가 다시 들어오면 이어서 쓸 수 있다 */
type Draft = {
  step: number;
  mode: Mode | null;
  start: "prompt" | "template";
  templateId: string | null;
  siteName: string;
  industry: string;
  tagline: string;
  offerings: Offering[];
  strengths: string[];
  audience: string;
  about: string;
  contact: ContactInfo;
  purposes: PurposeCode[];
  purposeDetail: string;
  menu: MenuNode[];
  /** auto = 추천 구성 그대로 (회사 정보가 바뀌면 다시 추천) · custom = 직접 고침 */
  menuSource: "auto" | "custom";
  homeNote: string;
  tone: string[];
  primaryColor: string;
  referenceUrls: string;
  prompt: string;
  extraFeatures: string[];
  generate: boolean;
  overrides: SlotOverrides;
};

const EMPTY: Draft = {
  step: 0,
  mode: null,
  start: "prompt",
  templateId: null,
  siteName: "",
  industry: "",
  tagline: "",
  offerings: [
    { name: "", description: "" },
    { name: "", description: "" },
  ],
  strengths: ["", "", ""],
  audience: "",
  about: "",
  contact: { phone: "", email: "", address: "", hours: "" },
  purposes: [],
  purposeDetail: "",
  menu: [],
  menuSource: "auto",
  homeNote: "",
  tone: [],
  primaryColor: COLORS[0],
  referenceUrls: "",
  prompt: "",
  extraFeatures: [],
  generate: false,
  overrides: {},
};

// ----- 브라우저 임시 저장 (새로 고침·실수로 나가도 이어서 쓰기) -----

function readSaved(): Partial<Draft> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: Partial<Draft> };
    return parsed.draft && typeof parsed.draft === "object" ? parsed.draft : null;
  } catch {
    return null;
  }
}

function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

const subscribeStorage = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

function savedExists(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** 저장해 둔 값을 기본값 위에 얹는다. 모양이 다르면 그 칸은 기본값을 쓴다 */
function restore(saved: Partial<Draft>, templateIds: Set<string>): Draft {
  const pick = <K extends keyof Draft>(k: K, ok: (v: unknown) => boolean): Draft[K] => (ok(saved[k]) ? (saved[k] as Draft[K]) : EMPTY[k]);
  const str = (v: unknown) => typeof v === "string";
  const arr = (v: unknown) => Array.isArray(v);
  const d: Draft = {
    step: pick("step", (v) => typeof v === "number" && v >= 0 && v < STEPS.length),
    mode: pick("mode", (v) => v === "guided" || v === "expert"),
    start: pick("start", (v) => v === "prompt" || v === "template"),
    templateId: pick("templateId", (v) => str(v) && templateIds.has(v as string)),
    siteName: pick("siteName", str),
    industry: pick("industry", str),
    tagline: pick("tagline", str),
    offerings: pick("offerings", (v) => arr(v) && (v as unknown[]).length > 0),
    strengths: pick("strengths", arr),
    audience: pick("audience", str),
    about: pick("about", str),
    contact: { ...EMPTY.contact, ...(saved.contact ?? {}) },
    purposes: pick("purposes", arr),
    purposeDetail: pick("purposeDetail", str),
    menu: pick("menu", arr),
    menuSource: pick("menuSource", (v) => v === "auto" || v === "custom"),
    homeNote: pick("homeNote", str),
    tone: pick("tone", arr),
    primaryColor: pick("primaryColor", (v) => str(v) && /^#[0-9a-f]{6}$/i.test(v as string)),
    referenceUrls: pick("referenceUrls", str),
    prompt: pick("prompt", str),
    extraFeatures: pick("extraFeatures", arr),
    generate: pick("generate", (v) => typeof v === "boolean"),
    overrides: pick("overrides", (v) => typeof v === "object" && v !== null && !Array.isArray(v)),
  };
  if (d.start === "template" && !d.templateId) d.start = "prompt";
  return d;
}

/**
 * 새 사이트 위저드. 첫 고객이 결제한 뒤 처음 거치는 화면이다.
 *
 * 0 시작: 웹사이트를 처음 만드는지(쉬운 모드) 잘 아는지(직접 구성) · 설명만으로/템플릿으로
 * 1 회사 · 서비스: 무엇을 하는 회사인지 — 첫 화면 문구 · 서비스 카드 · 연락처가 된다
 * 2 메뉴 · 페이지: 헤더 메뉴와 하위 페이지 (업종·목적·플랜 페이지 수에 맞춘 추천 구성에서 시작)
 * 3 디자인 · 4 이미지(AI 로 만들기 = 토큰 많이 씀 / 비워 두기 = 자리마다 필요한 이미지 안내) · 5 확인
 *
 * 쉬운 모드와 직접 구성은 같은 입력을 만든다. 쉬운 모드는 설명을 더 보여 주고, 직접 구성은 페이지 종류 · 페이지별 메모 ·
 * 이미지 설명 고치기를 더 보여 준다. 언제든 바꿀 수 있다.
 */
export function ProjectWizard({
  purchasedTemplates,
  preselectSlug,
  planName,
  hasPlan,
  maxPages,
  paymentAllowed,
  tokenBudget,
}: {
  purchasedTemplates: TemplateRow[];
  preselectSlug: string | null;
  planName: string;
  hasPlan: boolean;
  maxPages: number;
  paymentAllowed: boolean;
  /** 이번 달 남은 토큰 (한도 + 크레딧). null = 무제한 */
  tokenBudget: number | null;
}) {
  const preselected = purchasedTemplates.find((t) => t.slug === preselectSlug) ?? null;
  const [s, setS] = useState<Draft>(() => (preselected ? { ...EMPTY, start: "template", templateId: preselected.id } : EMPTY));
  const [touched, setTouched] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasSaved = useSyncExternalStore(subscribeStorage, savedExists, () => false);
  const [state, formAction, pending] = useActionState<CreateProjectState, FormData>(createProjectAction, null);

  const patch = (p: Partial<Draft>) => {
    setTouched(true);
    setS((prev) => ({ ...prev, ...p }));
  };

  // 손댄 뒤부터 브라우저에 임시 저장. 제출하면 지우고, 서버가 오류를 돌려주면(state 바뀜) 다시 저장한다
  useEffect(() => {
    if (!touched) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), draft: s }));
    } catch {
      /* 저장소를 쓸 수 없는 환경 — 저장 없이 진행 */
    }
  }, [s, touched, state]);

  const mode: Mode = s.mode ?? "guided";
  const guided = mode === "guided";
  const expert = mode === "expert";
  const category = detectCategory(s.industry);
  const ind = industryOf(category);
  const ex = ind.example;
  const template = s.start === "template" ? (purchasedTemplates.find((t) => t.id === s.templateId) ?? null) : null;
  const offerings = s.offerings.map((o) => ({ name: o.name.trim(), description: o.description.trim() })).filter((o) => o.name);
  const cta = ctaLabel(category, s.purposes);
  const pageCount = countPages(s.menu);

  // 페이지·이미지 자리 계획. 서버가 프로젝트를 만들 때와 같은 함수라 여기서 보여 준 자리가 그대로 만들어진다 (계산이 가벼워 매번 다시 만든다)
  const plan = buildSitePlan({
    mode,
    siteName: s.siteName.trim(),
    business: { category, tagline: s.tagline, offerings, strengths: s.strengths, about: s.about, contact: s.contact, purposes: s.purposes },
    menu: s.menu,
    homeNote: s.homeNote,
    generate: s.generate,
    overrides: Object.entries(s.overrides).map(([id, o]) => ({ id, ...o })),
  });
  const pageNameByPath = new Map(plan.pages.map((p) => [p.path, pageFullName(p)]));
  const autoFeatures = featuresFromPages(plan.pages);
  const imageCount = generatedImageCount(plan.images);
  const estimate = plan.imageGeneration.estimatedTokens;
  const overBudget = s.generate && tokenBudget !== null && estimate > tokenBudget;

  const recommendation = (): MenuNode[] =>
    template
      ? menuFromPageNames(template.pages).slice(0, Math.max(1, maxPages - 1))
      : recommendMenu({ category, purposes: s.purposes, offerings, maxPages });

  const valid = [
    s.mode !== null && (s.start === "prompt" || Boolean(template)),
    Boolean(s.siteName.trim() && s.industry.trim() && s.tagline.trim() && offerings.length > 0 && (s.purposes.length > 0 || s.purposeDetail.trim())),
    s.menu.length > 0 && s.menu.every((m) => m.label.trim() && m.children.every((c) => c.label.trim())) && pageCount <= maxPages,
    true,
    !overBudget,
    true,
  ];
  const canOpen = (i: number) => valid.slice(0, i).every(Boolean);

  const goTo = (step: number) => {
    const p: Partial<Draft> = { step };
    // 회사·서비스 단계를 마치고 메뉴로 갈 때: 빈 서비스 줄을 정리하고, 메뉴를 아직 고치지 않았으면 지금 정보로 다시 추천
    if (s.step <= 1 && step >= 2) {
      p.offerings = offerings.length ? offerings : EMPTY.offerings;
      if (s.menuSource === "auto" || s.menu.length === 0) {
        p.menu = recommendation();
        p.menuSource = "auto";
      }
    }
    patch(p);
    window.scrollTo({ top: 0 });
  };

  const setOverride = (id: string, o: { need?: string; generate?: boolean } | null) => {
    const next = { ...s.overrides };
    if (o === null) delete next[id];
    else {
      const merged = { ...next[id], ...o };
      if ("need" in o && o.need === undefined) delete merged.need;
      next[id] = merged;
    }
    patch({ overrides: next });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      templateId: template?.id ?? null,
      mode,
      siteName: s.siteName.trim(),
      industry: s.industry.trim(),
      category,
      tagline: s.tagline.trim(),
      offerings,
      strengths: s.strengths.map((x) => x.trim()).filter(Boolean),
      about: s.about.trim(),
      contact: s.contact,
      purposes: s.purposes,
      purposeDetail: s.purposeDetail.trim(),
      audience: s.audience.trim(),
      menu: s.menu,
      homeNote: s.homeNote,
      tone: s.tone,
      primaryColor: s.primaryColor,
      features: [...new Set([...autoFeatures, ...s.extraFeatures])],
      referenceUrls: s.referenceUrls
        .split(/\n|,/)
        .map((x) => x.trim())
        .filter(Boolean),
      prompt: s.prompt.trim(),
      images: { generate: s.generate, overrides: Object.entries(s.overrides).map(([id, o]) => ({ id, ...o })) },
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    clearSaved();
    startTransition(() => formAction(fd));
  };

  const toggle = <T,>(list: T[], v: T, max?: number): T[] => (list.includes(v) ? list.filter((x) => x !== v) : !max || list.length < max ? [...list, v] : list);

  const nav = (next = true, prev = true, nextLabel = "다음") => (
    <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
      {prev ? (
        <Button variant="ghost" onClick={() => goTo(s.step - 1)}>
          이전
        </Button>
      ) : (
        <span />
      )}
      {next ? (
        <Button onClick={() => goTo(s.step + 1)} disabled={!valid[s.step]}>
          {nextLabel}
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[190px_1fr]">
      {/* 단계 표시 (지나온 단계는 눌러서 돌아갈 수 있다) */}
      <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {STEPS.map((label, i) => {
          const done = i < s.step;
          const current = i === s.step;
          const open = i !== s.step && canOpen(i) && (i < s.step || s.mode !== null);
          return (
            <li key={label} className="shrink-0">
              <button
                type="button"
                onClick={() => open && goTo(i)}
                disabled={!open}
                className={cn("flex items-center gap-2 rounded px-1.5 py-1 text-left text-sm whitespace-nowrap", current ? "font-semibold text-ink-900" : open ? "text-ink-500 hover:text-ink-900" : "text-ink-400")}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-sm border text-xs",
                    done ? "border-sky-400 bg-sky-400 text-night-950" : current ? "border-sky-400 text-sky-600" : "border-ink-300",
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-w-0 rounded-md border border-ink-200 bg-surface p-5 sm:p-6">
        {hasSaved && !touched && !dismissed ? (
          <Alert tone="blue" className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span>작성하다 만 내용이 있어요. 이어서 쓸까요?</span>
            <span className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const saved = readSaved();
                  if (saved) {
                    setS(restore(saved, new Set(purchasedTemplates.map((t) => t.id))));
                    setTouched(true);
                  }
                  setDismissed(true);
                }}
              >
                이어서 쓰기
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearSaved();
                  setDismissed(true);
                }}
              >
                새로 시작
              </Button>
            </span>
          </Alert>
        ) : null}

        {s.step > 0 ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-ink-500">
              {s.step}/{STEPS.length - 1} 단계
            </span>
            <div className="inline-flex rounded-full border border-ink-200 p-0.5" role="group" aria-label="설명 방식">
              {(
                [
                  ["guided", "쉬운 모드"],
                  ["expert", "직접 구성"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patch({ mode: m })}
                  aria-pressed={mode === m}
                  className={cn("rounded-full px-3 py-1", mode === m ? "bg-ink-900 font-semibold text-ink-50" : "text-ink-500 hover:text-ink-900")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 0. 시작 */}
        {s.step === 0 ? (
          <div className="flex flex-col gap-6">
            <StepTitle title="웹사이트를 만들어 본 적 있으세요?" desc="답에 따라 설명을 더 하거나 줄여요. 진행하면서 언제든 바꿀 수 있어요." />
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard
                active={s.mode === "guided"}
                onClick={() => patch({ mode: "guided" })}
                icon={<GraduationCapIcon className="size-5" />}
                title="처음이에요"
                desc="질문에 차근차근 답하면 메뉴와 페이지 구성을 추천해 드려요. 어려운 말은 풀어서 설명해요."
              />
              <ModeCard
                active={s.mode === "expert"}
                onClick={() => patch({ mode: "expert" })}
                icon={<WrenchIcon className="size-5" />}
                title="잘 알아요"
                desc="메뉴·하위 페이지·페이지 종류·페이지별 내용·이미지 설명까지 직접 정해요."
              />
            </div>

            <div>
              <p className="text-sm font-semibold">무엇으로 시작할까요?</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <ModeCard active={s.start === "prompt"} onClick={() => patch({ start: "prompt" })} title="설명만으로" desc="회사와 원하는 사이트를 알려 주시면 처음부터 디자인해요." />
                <ModeCard active={s.start === "template"} onClick={() => patch({ start: "template" })} title="구매한 템플릿으로" desc="완성된 디자인 구조를 가져와 내용만 바꿔요." />
              </div>
              {s.start === "template" ? (
                purchasedTemplates.length === 0 ? (
                  <Alert tone="gray" className="mt-3">
                    구매한 템플릿이 없습니다.{" "}
                    <Link href="/templates" className="font-medium underline">
                      템플릿 둘러보기
                    </Link>
                  </Alert>
                ) : (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {purchasedTemplates.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => patch({ templateId: t.id, menuSource: "auto", menu: [] })}
                          className={cn("w-full overflow-hidden rounded-md border text-left", s.templateId === t.id ? "border-brand-600 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
                        >
                          <div className="relative aspect-[4/3] bg-ink-50">
                            <Image src={t.thumbnail_url} alt={t.name} fill className="object-cover" unoptimized />
                          </div>
                          <div className="flex items-center justify-between p-3">
                            <span className="text-sm font-medium">{t.name}</span>
                            <Badge tone={t.kind === "live" ? "blue" : "gray"}>{t.kind === "live" ? "운영" : "데모"}</Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </div>
            {nav(true, false, "시작하기")}
          </div>
        ) : null}

        {/* 1. 회사 · 서비스 */}
        {s.step === 1 ? (
          <div className="flex flex-col gap-5">
            <StepTitle title="어떤 회사인가요?" desc={guided ? "적어 주신 내용으로 첫 화면 문구와 메뉴를 만들어요. 정확하지 않아도 괜찮아요 — 나중에 언제든 고칠 수 있어요." : "첫 화면 문구 · 서비스 카드 · 푸터 연락처에 그대로 들어갑니다."} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="회사 · 브랜드 이름" required htmlFor="siteName" hint={guided ? "사이트 맨 위 로고 자리와 맨 아래에 들어가요." : undefined}>
                <Input id="siteName" value={s.siteName} onChange={(e) => patch({ siteName: e.target.value })} placeholder={`예: ${ex.name}`} maxLength={60} />
              </Field>
              <Field label="한 줄 소개" required htmlFor="tagline" hint={guided ? "우리를 한 문장으로 소개하면? 첫 화면의 큰 제목이 돼요." : "첫 화면 제목"}>
                <Input id="tagline" value={s.tagline} onChange={(e) => patch({ tagline: e.target.value })} placeholder={`예: ${ex.tagline}`} maxLength={80} />
              </Field>
            </div>

            <Field label="업종" required htmlFor="industry" hint={guided ? "업종에 맞춰 메뉴 구성과 이미지 자리를 추천해 드려요. 목록에 없으면 직접 적어 주세요." : undefined}>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {INDUSTRIES.filter((i) => i.code !== "etc").map((i) => (
                  <Chip key={i.code} active={s.industry.trim() === i.label} onClick={() => patch({ industry: i.label })} className="px-2.5 py-1 text-xs">
                    {i.label}
                  </Chip>
                ))}
              </div>
              <Input id="industry" value={s.industry} onChange={(e) => patch({ industry: e.target.value })} placeholder="직접 입력 (예: 꽃집, 세탁소, 피부과)" maxLength={60} className="max-w-sm" />
              {s.industry.trim() && !INDUSTRIES.some((i) => i.label === s.industry.trim()) ? (
                <p className="mt-1 text-xs text-ink-500">→ {category === "etc" ? "일반 회사 구성으로 추천해요" : `'${ind.label}' 구성으로 추천해요`}</p>
              ) : null}
            </Field>

            <Field
              label={`무엇을 제공하나요? (${ind.offeringMenu === "서비스" ? "서비스 · 상품 · 솔루션" : ind.offeringMenu})`}
              required
              hint={guided ? "하나하나가 첫 화면의 카드가 되고, 페이지가 넉넉하면 각각 소개 페이지도 만들어요. 1개 이상 적어 주세요." : `최대 ${MAX_OFFERINGS}개`}
            >
              <ul className="flex flex-col gap-2">
                {s.offerings.map((o, i) => (
                  <li key={i} className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={o.name}
                      onChange={(e) => patch({ offerings: s.offerings.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) })}
                      placeholder={`예: ${ex.offerings[i % ex.offerings.length].name}`}
                      maxLength={40}
                      aria-label={`${i + 1}번 이름`}
                      className="sm:w-56"
                    />
                    <Input
                      value={o.description}
                      onChange={(e) => patch({ offerings: s.offerings.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)) })}
                      placeholder={`한 줄 설명 (예: ${ex.offerings[i % ex.offerings.length].description})`}
                      maxLength={200}
                      aria-label={`${i + 1}번 설명`}
                      className="flex-1"
                    />
                    {s.offerings.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => patch({ offerings: s.offerings.filter((_, k) => k !== i) })}
                        className="grid size-11 shrink-0 place-items-center self-end rounded text-ink-400 hover:bg-ink-100 hover:text-mark sm:self-auto"
                        aria-label={`${i + 1}번 지우기`}
                        title="지우기"
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {s.offerings.length < MAX_OFFERINGS ? (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => patch({ offerings: [...s.offerings, { name: "", description: "" }] })}>
                  <PlusIcon className="size-3.5" /> 하나 더
                </Button>
              ) : null}
            </Field>

            <Field label="사이트로 하고 싶은 일" required hint={guided ? "여러 개 골라도 돼요. 고른 일에 맞는 페이지(예약·문의 등)를 메뉴에 넣어 드려요." : undefined}>
              <div className="flex flex-wrap gap-1.5">
                {PURPOSES.map((p) => (
                  <Chip key={p.code} active={s.purposes.includes(p.code)} onClick={() => patch({ purposes: toggle(s.purposes, p.code) })}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              <Textarea
                value={s.purposeDetail}
                onChange={(e) => patch({ purposeDetail: e.target.value })}
                placeholder="자세히 (선택) — 예: 동네 손님이 위치와 메뉴를 보고 예약 문의를 남기게 하고 싶어요"
                className="mt-2 min-h-16"
                maxLength={500}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="고객이 우리를 고르는 이유" optional hint={guided ? "강점이에요. 첫 화면에 '○○를 선택하는 이유' 로 들어가요." : undefined}>
                <div className="flex flex-col gap-2">
                  {s.strengths.map((v, i) => (
                    <Input
                      key={i}
                      value={v}
                      onChange={(e) => patch({ strengths: s.strengths.map((x, k) => (k === i ? e.target.value : x)) })}
                      placeholder={i === 0 ? `예: ${ex.strength}` : `강점 ${i + 1}`}
                      maxLength={80}
                      aria-label={`강점 ${i + 1}`}
                    />
                  ))}
                </div>
              </Field>
              <Field label="주요 고객" optional htmlFor="audience" hint={guided ? "주로 어떤 분들이 오시나요? 문구의 말투를 맞춰요." : undefined}>
                <Input id="audience" value={s.audience} onChange={(e) => patch({ audience: e.target.value })} placeholder={`예: ${ex.audience}`} maxLength={200} />
              </Field>
            </div>

            <OptionalBlock title="연락처 · 회사 소개 글" summary="사이트 맨 아래와 오시는 길 · 문의 페이지에 들어가요. 없으면 비워 두세요." defaultOpen={expert}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="전화" optional>
                  <Input value={s.contact.phone} onChange={(e) => patch({ contact: { ...s.contact, phone: e.target.value } })} placeholder="예: 02-123-4567" maxLength={40} />
                </Field>
                <Field label="이메일" optional>
                  <Input value={s.contact.email} onChange={(e) => patch({ contact: { ...s.contact, email: e.target.value } })} placeholder="예: hello@company.kr" maxLength={120} />
                </Field>
                <Field label="주소" optional>
                  <Input value={s.contact.address} onChange={(e) => patch({ contact: { ...s.contact, address: e.target.value } })} placeholder="예: 서울 마포구 연남로 12, 1층" maxLength={200} />
                </Field>
                <Field label="운영 시간" optional>
                  <Input value={s.contact.hours} onChange={(e) => patch({ contact: { ...s.contact, hours: e.target.value } })} placeholder="예: 평일 09:00 - 18:00" maxLength={120} />
                </Field>
              </div>
              <Field label="회사 소개 글" optional className="mt-3" hint="소개 페이지에 들어가요. 회사의 이야기 · 하는 일 · 철학을 편하게 적어 주세요.">
                <Textarea value={s.about} onChange={(e) => patch({ about: e.target.value })} maxLength={1000} className="min-h-24" />
              </Field>
            </OptionalBlock>

            {nav()}
          </div>
        ) : null}

        {/* 2. 메뉴 · 페이지 */}
        {s.step === 2 ? (
          <div className="flex flex-col gap-5">
            <StepTitle
              title="메뉴와 페이지를 정해요"
              desc={
                s.menuSource === "custom"
                  ? "직접 고친 메뉴를 그대로 두었어요. 지금 업종·목적에 맞춘 추천으로 바꾸려면 '추천 구성으로 되돌리기' 를 누르세요."
                  : template
                    ? `'${template.name}' 템플릿의 페이지로 시작했어요.`
                    : `${ind.label === "기타" ? "회사" : ind.label} 사이트에 많이 쓰는 구성으로 추천했어요.`
              }
            />
            <MenuEditor
              menu={s.menu}
              onChange={(menu) => patch({ menu, menuSource: "custom" })}
              siteName={s.siteName}
              cta={cta}
              primaryColor={s.primaryColor}
              maxPages={maxPages}
              planName={planName}
              expert={expert}
              guided={guided}
              offerings={offerings}
              homeNote={s.homeNote}
              onHomeNote={(homeNote) => patch({ homeNote })}
              onRecommend={() => patch({ menu: recommendation(), menuSource: "auto" })}
              recommended={s.menuSource === "auto"}
            />

            <Field label="필요한 기능" hint={guided ? "페이지 구성에 맞는 기능은 자동으로 들어가요. 더 필요한 게 있으면 골라 주세요." : undefined}>
              <div className="flex flex-wrap gap-1.5">
                {FEATURE_OPTIONS.map((f) => {
                  const auto = autoFeatures.includes(f.key);
                  const blocked = f.needsPlan && !paymentAllowed;
                  return (
                    <Chip
                      key={f.key}
                      active={auto || s.extraFeatures.includes(f.key)}
                      disabled={auto || blocked}
                      onClick={() => patch({ extraFeatures: toggle(s.extraFeatures, f.key) })}
                      title={auto ? "페이지 구성에 따라 자동으로 들어가요" : blocked ? "비즈니스 플랜 이상에서 가능" : undefined}
                      className={auto ? "opacity-100" : undefined}
                    >
                      {f.label}
                      {auto ? " · 자동" : blocked ? " (비즈니스↑)" : ""}
                    </Chip>
                  );
                })}
              </div>
            </Field>
            {!valid[2] && s.menu.some((m) => !m.label.trim() || m.children.some((c) => !c.label.trim())) ? <p className="text-xs text-mark">이름이 비어 있는 메뉴가 있어요.</p> : null}
            {nav()}
          </div>
        ) : null}

        {/* 3. 디자인 */}
        {s.step === 3 ? (
          <div className="flex flex-col gap-5">
            <StepTitle title="어떤 느낌이면 좋을까요?" desc={guided ? "잘 모르겠으면 넘어가도 괜찮아요. 담당자가 업종에 맞게 잡아 드려요." : undefined} />
            <Field label="디자인 톤 (최대 3개)">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <Chip key={t} active={s.tone.includes(t)} onClick={() => patch({ tone: toggle(s.tone, t, 3) })}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="메인 색상" hint={guided ? "버튼과 강조 글자에 쓰여요. 로고 색이 있다면 그 색을 골라 주세요." : undefined}>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => patch({ primaryColor: c })}
                    className={cn("size-8 rounded-sm border-2", s.primaryColor === c ? "border-ink-900" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={s.primaryColor} onChange={(e) => patch({ primaryColor: e.target.value })} className="h-8 w-10 cursor-pointer rounded-sm border border-ink-300" aria-label="직접 선택" />
                <span className="text-xs text-ink-500">{s.primaryColor}</span>
              </div>
              <div className="mt-3">
                <HeaderPreview menu={s.menu} siteName={s.siteName} cta={cta} primaryColor={s.primaryColor} />
              </div>
            </Field>
            <Field label="참고 사이트" optional htmlFor="refs" hint={guided ? "마음에 드는 사이트 주소가 있으면 알려 주세요. 분위기를 참고해요. 한 줄에 하나씩 (최대 5개)" : "한 줄에 하나씩 (최대 5개)"}>
              <Textarea id="refs" value={s.referenceUrls} onChange={(e) => patch({ referenceUrls: e.target.value })} placeholder="https://" className="min-h-16" />
            </Field>
            <Field label={template ? "템플릿에서 바꾸고 싶은 점" : expert ? "추가 요청 · 프롬프트" : "더 하고 싶은 말"} optional htmlFor="prompt">
              <Textarea
                id="prompt"
                value={s.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                placeholder={template ? "템플릿에서 바꾸고 싶은 점을 적어주세요." : "예: 첫 화면에 매장 사진을 크게 넣고, 메뉴는 카드 형태로. 하단에 네이버 지도와 인스타그램 링크."}
                className="min-h-28"
                maxLength={3000}
              />
            </Field>
            {nav()}
          </div>
        ) : null}

        {/* 4. 이미지 */}
        {s.step === 4 ? (
          <div className="flex flex-col gap-5">
            <StepTitle title="사진 · 이미지는 어떻게 할까요?" />
            <ImageStep
              plan={plan}
              generate={s.generate}
              onGenerate={(generate) => patch({ generate })}
              overrides={s.overrides}
              onOverride={setOverride}
              hasPlan={hasPlan}
              tokenBudget={tokenBudget}
              expert={expert}
              guided={guided}
              pageName={(path) => pageNameByPath.get(path) ?? path}
            />
            {nav()}
          </div>
        ) : null}

        {/* 5. 확인 */}
        {s.step === 5 ? (
          <form onSubmit={submit} className="flex flex-col gap-5">
            <StepTitle title="이대로 만들까요?" desc="제작을 시작하면 바로 구성 초안이 만들어지고 편집 화면으로 이동해요. 시작한 뒤에도 수정 요청으로 바꿀 수 있어요." />
            <dl className="divide-y divide-ink-100 rounded-md border border-ink-200 px-4">
              <SummaryRow k="시작 방식">{template ? `템플릿: ${template.name}` : "설명만으로"} · {guided ? "쉬운 모드" : "직접 구성"}</SummaryRow>
              <SummaryRow k="회사 · 브랜드">
                <span className="font-medium">{s.siteName}</span> <span className="text-ink-500">· {s.industry}</span>
                <p className="mt-0.5 text-ink-700">{s.tagline}</p>
              </SummaryRow>
              <SummaryRow k={ind.offeringMenu}>{offerings.map((o) => o.name).join(" · ")}</SummaryRow>
              <SummaryRow k="하고 싶은 일">{[s.purposes.map((c) => PURPOSES.find((p) => p.code === c)?.label).join(", "), s.purposeDetail.trim()].filter(Boolean).join(" — ")}</SummaryRow>
              {s.strengths.some((x) => x.trim()) ? <SummaryRow k="강점">{s.strengths.filter((x) => x.trim()).join(" · ")}</SummaryRow> : null}
              {Object.values(s.contact).some((x) => x.trim()) ? (
                <SummaryRow k="연락처">{[s.contact.phone, s.contact.email, s.contact.address, s.contact.hours].filter((x) => x.trim()).join(" · ")}</SummaryRow>
              ) : null}
              <SummaryRow k={`헤더 메뉴 · ${pageCount}페이지`}>
                <ul className="flex flex-col gap-1">
                  <li>홈</li>
                  {s.menu.map((m, i) => (
                    <li key={i}>
                      <span className="font-medium">{m.label}</span>
                      {m.children.length ? <span className="text-ink-500"> › {m.children.map((c) => c.label).join(" · ")}</span> : null}
                    </li>
                  ))}
                </ul>
                {expert ? (
                  <p className="mt-1.5 text-xs text-ink-500">
                    {plan.pages
                      .filter((p) => p.kind !== "home")
                      .map((p) => `${p.label}: ${PAGE_KIND_LABEL[p.kind]}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </SummaryRow>
              <SummaryRow k="디자인">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-4 rounded-sm" style={{ background: s.primaryColor }} /> {s.primaryColor}
                  {s.tone.length ? <span className="text-ink-500">· {s.tone.join(", ")}</span> : null}
                </span>
              </SummaryRow>
              <SummaryRow k="이미지">
                {imageCount > 0 ? (
                  <>
                    <span className="font-medium">AI로 {imageCount}장 만들기</span> <span className="text-ink-500">· 예상 약 {formatTokens(estimate)} 토큰</span>
                  </>
                ) : (
                  <span className="font-medium">비워 두기</span>
                )}
                {emptyImageCount(plan.images) > 0 ? <p className="mt-0.5 text-ink-500">비워 둘 사진 {emptyImageCount(plan.images)}장 — 자리마다 어떤 이미지가 필요한지 적어 둬요</p> : null}
              </SummaryRow>
            </dl>

            <Tip title="다음에 일어나는 일">
              <ol className="list-decimal pl-4">
                <li>지금 바로 메뉴 · 페이지 구성 초안이 만들어져요. 이미지 자리에는 어떤 이미지가 필요한지 적혀 있어요.</li>
                {imageCount > 0 ? <li>AI 이미지 {imageCount}장 생성 요청이 접수돼요. 진행 상황은 요청 내역에서 볼 수 있어요.</li> : null}
                <li>
                  첫 완성본은 {DELIVERY_DAYS.min}~{DELIVERY_DAYS.max}일 안에 올라와요. 고칠 곳은 화면에 빨간 네모를 그려 요청하면 돼요.
                </li>
              </ol>
            </Tip>

            {overBudget ? <Alert tone="red">남은 토큰보다 이미지 생성 예상 토큰이 많아요. 이미지 단계에서 만들 이미지를 줄여 주세요.</Alert> : null}
            {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
            <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-5">
              <Button variant="ghost" onClick={() => goTo(4)} disabled={pending}>
                이전
              </Button>
              <Button type="submit" size="lg" disabled={pending || !valid.every(Boolean)}>
                {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                {imageCount > 0 ? `제작 시작 · AI 이미지 ${imageCount}장` : "제작 시작"}
              </Button>
            </div>
          </form>
        ) : null}

        {touched && s.step < 5 ? (
          <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-400">
            <RotateCcwIcon className="size-3" /> 적은 내용은 이 브라우저에 임시 저장돼요. 나갔다 와도 이어서 쓸 수 있어요.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon?: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex gap-3 rounded-md border p-4 text-left transition-colors", active ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
    >
      {icon ? <span className={cn("mt-0.5 shrink-0", active ? "text-brand-700" : "text-ink-500")}>{icon}</span> : null}
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-[13px] leading-relaxed text-ink-500">{desc}</span>
      </span>
    </button>
  );
}

/** 선택 입력 묶음. 쉬운 모드에서는 접어 두어 꼭 필요한 칸만 먼저 보이게 한다 */
function OptionalBlock({ title, summary, defaultOpen, children }: { title: string; summary: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-ink-200">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span>
          <span className="text-sm font-semibold">
            {title} <span className="font-normal text-ink-400">(선택)</span>
          </span>
          <span className="mt-0.5 block text-xs text-ink-500">{summary}</span>
        </span>
        <PlusIcon className={cn("size-4 shrink-0 text-ink-500 transition-transform", open && "rotate-45")} />
      </button>
      {open ? <div className="border-t border-ink-100 px-4 py-4">{children}</div> : null}
    </div>
  );
}
