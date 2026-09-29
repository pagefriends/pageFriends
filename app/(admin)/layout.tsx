import { InboxIcon, LayoutGridIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { Badge } from "@/components/ui/card";
import { signOut } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/session";

/** 관리자(운영자·전문가) 영역. 관리자가 아니면 requireAdmin 이 대시보드로 보낸다. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin("/admin");
  return (
    <div className="theme-dark flex min-h-full flex-1 flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-night-950 text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Logo href="/admin" light />
            <Badge tone="sky">관리자</Badge>
            <nav className="ml-4 hidden items-center gap-1 sm:flex">
              <Link href="/admin" className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/75 hover:bg-white/10 hover:text-white">
                <InboxIcon className="size-3.5" /> 수정 요청
              </Link>
              <Link href="/dashboard" className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/75 hover:bg-white/10 hover:text-white">
                <LayoutGridIcon className="size-3.5" /> 사용자 화면
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-white/50 md:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="grid size-8 place-items-center rounded text-white/75 hover:bg-white/10 hover:text-white" title="로그아웃">
                <LogOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <nav className="flex items-center gap-1 border-t border-white/10 px-2 py-1.5 sm:hidden">
          <Link href="/admin" className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] whitespace-nowrap text-white/75 hover:bg-white/10 hover:text-white">
            <InboxIcon className="size-3.5" /> 수정 요청
          </Link>
          <Link href="/dashboard" className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[13px] whitespace-nowrap text-white/75 hover:bg-white/10 hover:text-white">
            <LayoutGridIcon className="size-3.5" /> 사용자 화면
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
