import Link from "next/link";

import { cn } from "@/lib/utils";

/** 브랜드 로고: 네모 마크 + 두 줄 워드마크(PAGE / FRIENDS). 화면 읽기 프로그램에는 한글 이름으로 읽힌다. */
export function Logo({ className, light = false, href = "/" }: { className?: string; light?: boolean; href?: string }) {
  return (
    <Link href={href} aria-label="페이지프렌즈" className={cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap", light ? "text-white" : "text-ink-900", className)}>
      <span className="grid size-7 place-items-center rounded-sm bg-brand-600">
        <span className="block size-3 rounded-[2px] bg-sky-200" />
      </span>
      <span className="flex flex-col gap-0.5 text-[13px] leading-none font-extrabold tracking-[0.06em]">
        <span>PAGE</span>
        <span>FRIENDS</span>
      </span>
    </Link>
  );
}
