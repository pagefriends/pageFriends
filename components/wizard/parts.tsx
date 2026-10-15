"use client";

import { LightbulbIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** 위저드 공통 부품: 칩 · 안내 상자 · 단계 제목 · 입력 묶음 */

export function Chip({ active, disabled, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
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

/** 처음 만드는 사람을 위한 설명 상자 (쉬운 모드에서만 보인다) */
export function Tip({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700", className)}>
      <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-sky-600" />
      <div>
        {title ? <p className="font-semibold text-ink-900">{title}</p> : null}
        <div className={title ? "mt-0.5" : undefined}>{children}</div>
      </div>
    </div>
  );
}

export function StepTitle({ title, desc }: { title: string; desc?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc ? <p className="mt-1 text-sm text-ink-500">{desc}</p> : null}
    </div>
  );
}

/** 라벨 + 내용 + 도움말 한 덩어리 */
export function Field({ label, required, optional, hint, htmlFor, children, className }: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-semibold text-ink-700">
        {label}
        {required ? <span className="ml-0.5 text-sky-600">*</span> : null}
        {optional ? <span className="ml-1 font-normal text-ink-400">(선택)</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</p> : null}
    </div>
  );
}

/** 요약 화면의 한 줄 */
export function SummaryRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[120px_1fr] sm:gap-4">
      <dt className="text-[13px] text-ink-500">{k}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}
