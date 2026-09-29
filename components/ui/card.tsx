import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-ink-200 bg-surface", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-ink-100 px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold text-ink-900", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

type BadgeTone = "blue" | "sky" | "gray" | "red" | "dark";
const tones: Record<BadgeTone, string> = {
  blue: "bg-brand-50 text-brand-700 border-brand-200",
  sky: "bg-sky-50 text-sky-600 border-sky-200",
  gray: "bg-ink-100 text-ink-700 border-ink-200",
  red: "bg-red-50 text-mark border-red-200",
  dark: "bg-ink-900 text-ink-50 border-ink-900",
};

export function Badge({ tone = "gray", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none", tones[tone], className)}
      {...props}
    />
  );
}

export function Alert({ tone = "blue", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: "blue" | "red" | "gray" }) {
  const t = { blue: "border-brand-200 bg-brand-50 text-brand-800", red: "border-red-200 bg-red-50 text-red-800", gray: "border-ink-200 bg-ink-50 text-ink-700" }[tone];
  return <div className={cn("rounded border px-4 py-3 text-sm leading-relaxed", t, className)} {...props} />;
}
