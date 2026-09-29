import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({ className, light = false, href = "/" }: { className?: string; light?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap", light ? "text-white" : "text-ink-900", className)}>
      <span className="grid size-6 place-items-center rounded-sm bg-brand-600">
        <span className="block size-2.5 rounded-[2px] bg-sky-200" />
      </span>
      <span>페이지프렌즈</span>
    </Link>
  );
}
