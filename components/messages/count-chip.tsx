import { cn } from "@/lib/utils";

/** 아직 확인하지 않은 것의 수. strong 이면(담당자가 내 답을 기다리면) 액센트 색 */
export function CountChip({ strong = false, children }: { strong?: boolean; children: React.ReactNode }) {
  return <span className={cn("grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold", strong ? "bg-sky-400 text-night-950" : "bg-brand-500 text-white")}>{children}</span>;
}
