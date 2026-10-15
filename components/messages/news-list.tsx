import Link from "next/link";

import { DEVICE_LABEL } from "@/config/plans";
import type { NewsItem } from "@/lib/messages";
import { cn, formatDateTime } from "@/lib/utils";

const LABEL: Record<NewsItem["type"], string> = { awaiting: "확인 필요", answer: "새 답변", message: "새 메시지" };
/** 한 번에 보여줄 줄 수. 나머지는 사이트 카드의 숫자로 찾아 들어간다. */
const LIMIT = 8;

/**
 * 대시보드의 "확인할 내용": 담당자가 내 답을 기다리는 요청 → 새 답변·상태 변경 → 새 메시지.
 * 한 줄을 누르면 그 요청의 대화(또는 사이트 메시지)로 바로 간다. 종 아이콘이 여기(#news)로 데려온다.
 */
export function NewsList({ items, projectName }: { items: NewsItem[]; projectName: Map<string, string> }) {
  if (items.length === 0) return null;
  return (
    <section id="news" className="scroll-mt-28 rounded-md border border-brand-200 bg-surface">
      <h2 className="border-b border-ink-100 px-4 py-2.5 text-sm font-semibold">
        확인할 내용 <span className="ml-1 font-normal text-ink-500">{items.length}건</span>
      </h2>
      <ul className="divide-y divide-ink-100">
        {items.slice(0, LIMIT).map((n) => (
          <li key={n.key}>
            <Link href={n.type === "message" ? `/projects/${n.projectId}/messages` : `/projects/${n.projectId}/requests#r-${n.requestId}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50">
              <span className={cn("shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] leading-none font-semibold", n.type === "awaiting" ? "bg-sky-400 text-night-950" : "bg-brand-50 text-brand-700")}>{LABEL[n.type]}</span>
              <span className="shrink-0 font-medium">{projectName.get(n.projectId) ?? "사이트"}</span>
              {n.type === "message" ? null : (
                <span className="hidden shrink-0 text-xs text-ink-500 sm:inline">
                  {n.pageName} · {DEVICE_LABEL[n.device]} · {n.seq}번
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-ink-700">
                {n.text}
                {n.type === "message" && n.count > 1 ? <span className="ml-1 text-xs text-ink-500">외 {n.count - 1}개</span> : null}
              </span>
              {n.at ? <span className="hidden shrink-0 text-xs text-ink-400 md:inline">{formatDateTime(n.at)}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > LIMIT ? <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">외 {items.length - LIMIT}건은 아래 사이트의 요청 내역 · 메시지에서 볼 수 있습니다.</p> : null}
    </section>
  );
}
