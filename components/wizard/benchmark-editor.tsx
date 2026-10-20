"use client";

import { CheckIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";

import { Field, Tip } from "@/components/wizard/parts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { BENCHMARK_ASPECTS, BENCHMARK_ATTESTATION, BENCHMARK_PERMISSION, MAX_BENCHMARKS } from "@/config/benchmarks";
import { josa } from "@/lib/site-plan";
import type { BenchmarkPermission } from "@/lib/types/db";
import { cn } from "@/lib/utils";

/** 위저드에서 쓰는 벤치마킹 한 줄. 허락 상태는 고객이 직접 골라야 한다 (기본값 없음) */
export type BenchmarkDraft = { url: string; aspects: string[]; note: string; permission: BenchmarkPermission | null; permissionNote: string };

export const EMPTY_BENCHMARK: BenchmarkDraft = { url: "", aspects: [], note: "", permission: null, permissionNote: "" };

const PERMISSIONS: BenchmarkPermission[] = ["own", "granted", "none"];

/** 주소 형식 (http · https 만). 앞에 주소 형식이 없으면 https:// 를 붙여 본다 */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** 이 줄에서 고칠 것 (없으면 null). 주소가 비어 있는 줄은 검사하지 않는다 */
export function benchmarkProblem(b: BenchmarkDraft): string | null {
  if (!b.url.trim()) return null;
  if (!normalizeUrl(b.url)) return "사이트 주소 형식을 확인해 주세요 (예: https://example.com)";
  if (!b.permission) return "허락 상태를 골라 주세요";
  if (b.permission === "granted" && !b.permissionNote.trim()) return "어떻게 허락받았는지 한 줄 적어 주세요";
  return null;
}

/**
 * 벤치마킹 사이트 입력. 첫 요청에 꼭 받는다 (템플릿을 골랐으면 템플릿이 그 역할을 하므로 주소는 선택).
 * 허락 상태에 따라 AI 가 참고하는 범위가 달라진다 — config/benchmarks.ts.
 */
export function BenchmarkEditor({
  rows,
  onChange,
  attested,
  onAttest,
  templateName,
  guided,
}: {
  rows: BenchmarkDraft[];
  onChange: (rows: BenchmarkDraft[]) => void;
  attested: boolean;
  onAttest: (v: boolean) => void;
  /** 고른 템플릿 이름 (있으면 벤치마킹으로 함께 쓴다) */
  templateName: string | null;
  guided: boolean;
}) {
  const set = (i: number, patch: Partial<BenchmarkDraft>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const filled = rows.some((r) => r.url.trim());

  return (
    <div className="flex flex-col gap-3">
      {guided ? (
        <Tip title="벤치마킹이 뭔가요?">
          &ldquo;이런 느낌으로 만들고 싶다&rdquo; 하는 참고 사이트예요. 다른 회사의 사이트를 허락 없이 그대로 따라 하면 저작권 문제가 생길 수 있어서, 허락을 받았는지 함께 여쭤봐요. 허락이 없으면 색감 · 글꼴 · 밝기 같은 분위기만 참고해요.
        </Tip>
      ) : null}

      {templateName ? (
        <div className="flex items-start gap-2.5 rounded-md border border-brand-600 bg-brand-50 px-4 py-3 text-[13px]">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <span>
            <b className="text-ink-900">템플릿 &lsquo;{templateName}&rsquo;</b>
            {josa(templateName, "을/를").slice(templateName.length)} 첫 벤치마킹으로 써요 · 사용 허락 포함
            <span className="mt-0.5 block text-xs text-ink-500">참고하고 싶은 다른 사이트가 있으면 아래에 더 적어 주세요 (선택).</span>
          </span>
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {rows.map((b, i) => {
          const problem = benchmarkProblem(b);
          return (
            <li key={i} className="rounded-md border border-ink-200 p-4">
              <div className="flex items-start gap-2">
                <Field label={`벤치마킹 사이트 ${i + 1}`} required={i === 0 && !templateName} htmlFor={`bm-url-${i}`} className="flex-1">
                  <Input id={`bm-url-${i}`} value={b.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="https://" inputMode="url" maxLength={300} />
                </Field>
                {rows.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, k) => k !== i))}
                    className="mt-6 grid size-11 shrink-0 place-items-center rounded text-ink-400 hover:bg-ink-100 hover:text-mark"
                    aria-label={`벤치마킹 사이트 ${i + 1} 지우기`}
                    title="지우기"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                ) : null}
              </div>

              <p className="mt-3 text-[12px] font-semibold text-ink-700">
                이 사이트의 허락을 받았나요? <span className="text-sky-600">*</span>
              </p>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`벤치마킹 사이트 ${i + 1} 허락 상태`}>
                {PERMISSIONS.map((p) => {
                  const on = b.permission === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set(i, { permission: p })}
                      className={cn("flex gap-2 rounded-md border px-3 py-2.5 text-left text-[13px]", on ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
                    >
                      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border", on ? "border-brand-600 bg-brand-600 text-ink-50" : "border-ink-300")}>
                        {on ? <CheckIcon className="size-3" /> : null}
                      </span>
                      <span>
                        <span className="block font-semibold">{BENCHMARK_PERMISSION[p].label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{BENCHMARK_PERMISSION[p].desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {b.permission === "granted" ? (
                <Field label="어떻게 허락받았나요?" required htmlFor={`bm-perm-${i}`} className="mt-3" hint="나중에 문제가 생기지 않게 기록해 둬요. 받은 메일이나 문서가 있으면 담당자에게 메시지로 보내 주세요.">
                  <Input id={`bm-perm-${i}`} value={b.permissionNote} onChange={(e) => set(i, { permissionNote: e.target.value })} placeholder="예: 10월 12일 운영자에게 이메일로 동의 받음" maxLength={200} />
                </Field>
              ) : null}

              <p className="mt-3 text-[12px] font-semibold text-ink-700">참고할 점</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {BENCHMARK_ASPECTS.map((a) => {
                  const on = b.aspects.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set(i, { aspects: on ? b.aspects.filter((x) => x !== a.key) : [...b.aspects, a.key] })}
                      className={cn("rounded border px-2.5 py-1 text-xs", on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:border-ink-400")}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
              <Field label="이 사이트의 어떤 점이 좋았나요?" optional htmlFor={`bm-note-${i}`} className="mt-3" hint={guided ? "적어 주신 내용을 AI 와 담당자가 그대로 참고해요. 구체적일수록 좋아요." : undefined}>
                <Textarea id={`bm-note-${i}`} value={b.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="예: 첫 화면에 사진이 크게 있고, 메뉴가 단순해서 찾기 쉬워요" className="min-h-16" maxLength={300} />
              </Field>
              {problem ? <p className="mt-2 text-xs text-mark">{problem}</p> : null}
            </li>
          );
        })}
      </ol>

      {rows.length < MAX_BENCHMARKS ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([...rows, { ...EMPTY_BENCHMARK }])}>
          <PlusIcon className="size-3.5" /> 사이트 하나 더 (최대 {MAX_BENCHMARKS}개)
        </Button>
      ) : null}

      {filled ? (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-ink-200 px-4 py-3 text-[13px]">
          <input type="checkbox" checked={attested} onChange={(e) => onAttest(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            {BENCHMARK_ATTESTATION} <span className="text-sky-600">*</span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
