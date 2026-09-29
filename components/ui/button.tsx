import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 버튼. 디자인 피클처럼 알약형(rounded-full).
 * - primary: 하늘색 바탕 + 짙은 글자 (디자인 피클의 라임 버튼 역할). 어두운·흰 바탕 어디서나 쓴다.
 * - dark: 네이비 바탕 + 흰 글자 (흰 섹션의 보조 CTA)
 * - outline / outlineLight: 흰 바탕용 / 어두운 바탕용 테두리 버튼
 */
type Variant = "primary" | "dark" | "secondary" | "outline" | "outlineLight" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-sky-400 text-night-950 hover:bg-sky-300 disabled:bg-sky-200 disabled:text-ink-500",
  dark: "bg-ink-900 text-ink-50 hover:opacity-90 disabled:opacity-60",
  secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-60",
  outline: "border border-ink-300 bg-surface text-ink-900 hover:border-ink-900 disabled:opacity-60",
  outlineLight: "border border-white/40 bg-transparent text-white hover:border-white hover:bg-white/10 disabled:opacity-60",
  ghost: "text-ink-700 hover:bg-ink-100 disabled:opacity-60",
  danger: "bg-mark text-white hover:bg-red-700 disabled:opacity-60",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none disabled:cursor-not-allowed";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

/** 링크에 버튼 스타일만 입힐 때 */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}
