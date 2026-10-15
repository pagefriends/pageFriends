"use client";

import { InboxIcon, LayoutGridIcon, MailIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AdminCounts } from "@/lib/admin";
import { useLiveCounts } from "@/lib/use-live-counts";
import { cn } from "@/lib/utils";

/**
 * 관리자 상단 메뉴. 숫자는 지금 손댈 것의 수다 — 수정 요청: 할 일(사용자의 새 답글이 있으면 액센트 색), 메시지: 새 메시지가 온 사이트.
 * 레이아웃은 페이지를 옮겨도 다시 그려지지 않으므로 숫자는 따로 받아 온다.
 */
export function AdminNav({ initial, className, linkClassName }: { initial: AdminCounts; className?: string; linkClassName?: string }) {
  const counts = useLiveCounts("/api/notifications?scope=admin", initial);
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "수정 요청", icon: InboxIcon, count: counts.todo, strong: counts.replies > 0, title: counts.replies > 0 ? `할 일 ${counts.todo}건 · 새 답글 ${counts.replies}건` : `할 일 ${counts.todo}건`, active: pathname === "/admin" || pathname.startsWith("/admin/requests") },
    { href: "/admin/messages", label: "메시지", icon: MessageSquareIcon, count: counts.messages, strong: true, title: `새 메시지가 온 사이트 ${counts.messages}곳`, active: pathname.startsWith("/admin/messages") },
    { href: "/admin/inquiries", label: "문의", icon: MailIcon, count: 0, strong: false, title: "공개 사이트 폼 접수", active: pathname.startsWith("/admin/inquiries") },
    { href: "/dashboard", label: "사용자 화면", icon: LayoutGridIcon, count: 0, strong: false, title: "사용자 화면으로", active: false },
  ];
  return (
    <nav className={className} aria-label="관리자 메뉴">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          title={l.title}
          className={cn("flex items-center gap-1.5 rounded text-[13px] whitespace-nowrap hover:bg-white/10 hover:text-white", l.active ? "bg-white/10 text-white" : "text-white/75", linkClassName)}
        >
          <l.icon className="size-3.5" /> {l.label}
          {l.count > 0 ? (
            <span className={cn("grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold", l.strong ? "bg-sky-400 text-night-950" : "bg-white/15 text-white")}>{l.count > 99 ? "99+" : l.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
