"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createProjectAction, type CreateProjectState } from "@/app/(app)/projects/new/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { Hint, Input, Label, Textarea } from "@/components/ui/input";
import type { TemplateRow } from "@/lib/types/db";
import { cn } from "@/lib/utils";

const TONES = ["깔끔한", "신뢰감 있는", "따뜻한", "고급스러운", "활기찬", "미니멀", "전문적인", "친근한"];
const PAGE_OPTIONS = ["홈", "안내", "리뷰", "상품", "문의", "예약", "관리자페이지"];
const FEATURE_OPTIONS = [
  { key: "contact-form", label: "문의 폼" },
  { key: "reservation", label: "예약" },
  { key: "map", label: "지도 · 오시는 길" },
  { key: "gallery", label: "갤러리" },
  { key: "board", label: "게시판 · 공지" },
  { key: "membership", label: "회원가입 · 로그인" },
  { key: "payment", label: "결제 (쇼핑몰)", needsPlan: true },
  { key: "blog", label: "블로그" },
];
const COLORS = ["#2563eb", "#0ea5e9", "#1e40af", "#0f172a", "#334155", "#0284c7"];

type Step = 0 | 1 | 2;

export function ProjectWizard({
  purchasedTemplates,
  preselectSlug,
  planName,
  hasPlan,
  maxPages,
  paymentAllowed,
}: {
  purchasedTemplates: TemplateRow[];
  preselectSlug: string | null;
  planName: string;
  hasPlan: boolean;
  maxPages: number;
  paymentAllowed: boolean;
}) {
  const preselected = purchasedTemplates.find((t) => t.slug === preselectSlug) ?? null;
  const [step, setStep] = useState<Step>(0);
  const [mode, setMode] = useState<"template" | "prompt">(preselected ? "template" : "prompt");
  const [templateId, setTemplateId] = useState<string | null>(preselected?.id ?? null);

  const [siteName, setSiteName] = useState("");
  const [industry, setIndustry] = useState("");
  const [purpose, setPurpose] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<string[]>([]);
  const [primaryColor, setPrimaryColor] = useState(COLORS[0]);
  const [pages, setPages] = useState<string[]>(preselected?.pages ?? ["홈", "안내", "문의"]);
  const [customPage, setCustomPage] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [referenceUrls, setReferenceUrls] = useState("");
  const [prompt, setPrompt] = useState("");

  const [state, formAction, pending] = useActionState<CreateProjectState, FormData>(createProjectAction, null);

  const payload = useMemo(
    () =>
      JSON.stringify({
        templateId: mode === "template" ? templateId : null,
        siteName,
        industry,
        purpose,
        audience,
        tone,
        primaryColor,
        pages,
        features,
        referenceUrls: referenceUrls
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean),
        prompt,
      }),
    [mode, templateId, siteName, industry, purpose, audience, tone, primaryColor, pages, features, referenceUrls, prompt],
  );

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max?: number) => {
    if (list.includes(v)) set(list.filter((x) => x !== v));
    else if (!max || list.length < max) set([...list, v]);
  };

  const step1Valid = siteName.trim() && industry.trim() && purpose.trim() && pages.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      {/* 단계 표시 */}
      <ol className="flex gap-2 lg:flex-col">
        {["시작 방식", "필수 정보", "확인"].map((label, i) => (
          <li key={label} className={cn("flex items-center gap-2 text-sm", i === step ? "font-semibold text-ink-900" : "text-ink-400")}>
            <span className={cn("grid size-6 place-items-center rounded-sm border text-xs", i < step ? "border-sky-400 bg-sky-400 text-night-950" : i === step ? "border-sky-400 text-sky-600" : "border-ink-300")}>
              {i < step ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-ink-200 bg-surface p-6">
        {step === 0 ? (
          <div>
            <h2 className="text-lg font-semibold">어떻게 시작할까요?</h2>
            <p className="mt-1 text-sm text-ink-500">템플릿은 선택 사항입니다. 프롬프트만으로도 똑같이 제작됩니다.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("prompt")}
                className={cn("rounded-md border p-4 text-left transition-colors", mode === "prompt" ? "border-brand-600 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
              >
                <p className="font-semibold">프롬프트만으로</p>
                <p className="mt-1 text-[13px] text-ink-500">원하는 사이트를 글로 설명하면 처음부터 디자인합니다.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("template")}
                className={cn("rounded-md border p-4 text-left transition-colors", mode === "template" ? "border-brand-600 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
              >
                <p className="font-semibold">구매한 템플릿으로</p>
                <p className="mt-1 text-[13px] text-ink-500">완성된 디자인 구조를 가져와 내용만 바꿉니다.</p>
              </button>
            </div>

            {mode === "template" ? (
              purchasedTemplates.length === 0 ? (
                <Alert tone="gray" className="mt-4">
                  구매한 템플릿이 없습니다.{" "}
                  <Link href="/templates" className="font-medium underline">
                    템플릿 둘러보기
                  </Link>
                </Alert>
              ) : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {purchasedTemplates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateId(t.id);
                          setPages(t.pages);
                        }}
                        className={cn("w-full overflow-hidden rounded-md border text-left", templateId === t.id ? "border-brand-600 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
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

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setStep(1)} disabled={mode === "template" && !templateId}>
                다음
              </Button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold">필수 정보</h2>
              <p className="mt-1 text-sm text-ink-500">
                {planName} 플랜 기준 최대 {maxPages}페이지.{!hasPlan ? " 플랜을 선택하지 않아 스타터 기준으로 안내합니다." : ""}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="siteName">사이트 이름 *</Label>
                <Input id="siteName" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="예: 카페 데일리" maxLength={60} />
              </div>
              <div>
                <Label htmlFor="industry">업종 *</Label>
                <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="예: 카페, 피부과, 학원" maxLength={60} />
              </div>
            </div>
            <div>
              <Label htmlFor="purpose">사이트 목적 *</Label>
              <Textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 매장 위치와 메뉴를 알리고 예약 문의를 받고 싶어요" maxLength={500} />
            </div>
            <div>
              <Label htmlFor="audience">주요 고객</Label>
              <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="예: 20~30대 직장인, 동네 주민" maxLength={200} />
            </div>

            <div>
              <Label>디자인 톤 (최대 3개)</Label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <Chip key={t} active={tone.includes(t)} onClick={() => toggle(tone, setTone, t, 3)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <Label>메인 색상</Label>
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => setPrimaryColor(c)}
                    className={cn("size-8 rounded-sm border-2", primaryColor === c ? "border-ink-900" : "border-transparent")}
                    style={{ background: c }}
                  />
                ))}
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 w-10 cursor-pointer rounded-sm border border-ink-300" aria-label="직접 선택" />
                <span className="text-xs text-ink-500">{primaryColor}</span>
              </div>
              <Hint>파랑·하늘색 계열을 권장합니다. 다른 색도 직접 고를 수 있습니다.</Hint>
            </div>

            <div>
              <Label>
                페이지 구성 * <span className="font-normal text-ink-400">({pages.length}/{maxPages})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map((p) => (
                  <Chip key={p} active={pages.includes(p)} onClick={() => toggle(pages, setPages, p, maxPages)}>
                    {p}
                  </Chip>
                ))}
                {pages
                  .filter((p) => !PAGE_OPTIONS.includes(p))
                  .map((p) => (
                    <Chip key={p} active onClick={() => setPages(pages.filter((x) => x !== p))}>
                      {p} ×
                    </Chip>
                  ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={customPage}
                  onChange={(e) => setCustomPage(e.target.value)}
                  placeholder="직접 추가 (예: 갤러리)"
                  maxLength={20}
                  className="max-w-56"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = customPage.trim();
                      if (v && !pages.includes(v) && pages.length < maxPages) setPages([...pages, v]);
                      setCustomPage("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const v = customPage.trim();
                    if (v && !pages.includes(v) && pages.length < maxPages) setPages([...pages, v]);
                    setCustomPage("");
                  }}
                >
                  추가
                </Button>
              </div>
            </div>

            <div>
              <Label>필요한 기능</Label>
              <div className="flex flex-wrap gap-2">
                {FEATURE_OPTIONS.map((f) => {
                  const blocked = f.needsPlan && !paymentAllowed;
                  return (
                    <Chip key={f.key} active={features.includes(f.key)} disabled={blocked} onClick={() => toggle(features, setFeatures, f.key)} title={blocked ? "비즈니스 플랜 이상에서 가능" : undefined}>
                      {f.label}
                      {blocked ? " (비즈니스↑)" : ""}
                    </Chip>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="refs">참고 사이트 URL</Label>
              <Textarea id="refs" value={referenceUrls} onChange={(e) => setReferenceUrls(e.target.value)} placeholder="한 줄에 하나씩 (최대 5개)" className="min-h-16" />
            </div>

            <div>
              <Label htmlFor="prompt">{mode === "prompt" ? "원하는 사이트 설명 (프롬프트)" : "추가 요청 사항"}</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "prompt"
                    ? "예: 첫 화면에 매장 사진을 크게 넣고, 메뉴는 카드 형태로. 하단에 네이버 지도와 인스타그램 링크."
                    : "템플릿에서 바꾸고 싶은 점을 적어주세요."
                }
                className="min-h-32"
                maxLength={3000}
              />
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                이전
              </Button>
              <Button onClick={() => setStep(2)} disabled={!step1Valid}>
                다음
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="payload" value={payload} />
            <div>
              <h2 className="text-lg font-semibold">확인</h2>
              <p className="mt-1 text-sm text-ink-500">아래 내용으로 제작을 시작합니다. 제작 중에도 수정 요청으로 바꿀 수 있습니다.</p>
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row k="시작 방식" v={mode === "template" ? `템플릿: ${purchasedTemplates.find((t) => t.id === templateId)?.name ?? ""}` : "프롬프트만으로"} />
              <Row k="사이트 이름" v={siteName} />
              <Row k="업종" v={industry} />
              <Row k="주요 고객" v={audience || "-"} />
              <Row k="디자인 톤" v={tone.join(", ") || "-"} />
              <Row k="메인 색상" v={primaryColor} />
              <Row k="페이지" v={pages.join(" · ")} />
              <Row k="기능" v={features.map((f) => FEATURE_OPTIONS.find((o) => o.key === f)?.label ?? f).join(", ") || "-"} />
            </dl>
            <div className="text-sm">
              <p className="text-ink-500">목적</p>
              <p className="mt-0.5 whitespace-pre-wrap">{purpose}</p>
            </div>
            {prompt ? (
              <div className="text-sm">
                <p className="text-ink-500">{mode === "prompt" ? "프롬프트" : "추가 요청"}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{prompt}</p>
              </div>
            ) : null}
            {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                이전
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                제작 시작
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ active, disabled, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "rounded border px-3 py-1.5 text-[13px] transition-colors",
        active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:border-ink-400",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink-500">{k}</dt>
      <dd className="mt-0.5 font-medium">{v}</dd>
    </div>
  );
}
