import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 폼 컨트롤. 디자인 피클 상담 폼처럼 라벨은 작고 굵게, 필수는 별표, 입력은 여유 있는 높이.
 */
const base =
  "w-full rounded-md border border-ink-300 bg-surface px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:bg-ink-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(base, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(base, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "h-11 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, required, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-[12px] font-semibold text-ink-700", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-sky-600">*</span> : null}
    </label>
  );
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-xs text-ink-500", className)} {...props} />;
}
