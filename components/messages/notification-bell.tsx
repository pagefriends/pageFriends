"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";

import { useLiveCounts } from "@/lib/use-live-counts";

/** 상단 바 종 아이콘. 담당자의 새 답변·메시지와 내 답을 기다리는 요청을 합친 수를 보여주고, 누르면 대시보드의 "확인할 내용" 으로 간다. */
export function NotificationBell({ initial }: { initial: { unread: number; awaiting: number } }) {
  const { unread, awaiting } = useLiveCounts("/api/notifications", initial);
  const total = unread + awaiting;
  const label = total === 0 ? "새 소식 없음" : [awaiting > 0 ? `확인 필요 ${awaiting}건` : null, unread > 0 ? `새 답변 · 메시지 ${unread}건` : null].filter(Boolean).join(" · ");
  return (
    <Link href="/dashboard#news" className="relative grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" title={label} aria-label={`알림: ${label}`}>
      <BellIcon className="size-4" />
      {total > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-sky-400 px-1 text-[10px] leading-4 font-bold text-night-950">{total > 99 ? "99+" : total}</span>
      ) : null}
    </Link>
  );
}
