import { CreditCardIcon, LayoutGridIcon, LayoutTemplateIcon, LogOutIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { getSubscription, isAdmin, requireUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";

const NAV = [
  { href: "/dashboard", label: "내 프로젝트", icon: LayoutGridIcon },
  { href: "/templates", label: "템플릿", icon: LayoutTemplateIcon },
  { href: "/billing", label: "플랜 · 결제", icon: CreditCardIcon },
] as const;

/** 로그인 후 영역 공통 셸. 좁은 상단 바 + 콘텐츠. 편집기는 화면을 넓게 써야 해서 사이드바 대신 상단 바만 둔다. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ plan }, admin] = await Promise.all([getSubscription(user.id), isAdmin(user.id)]);

  return (
    <div className="theme-dark flex min-h-full flex-1 flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-night-950">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Logo href="/dashboard" />
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-white/75 hover:bg-white/10 hover:text-white">
                  <n.icon className="size-3.5" />
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {admin ? (
              <Link href="/admin" className={buttonClass("outlineLight", "sm")}>
                관리자
              </Link>
            ) : null}
            {plan ? <Badge tone="blue">{plan.name} 플랜</Badge> : <Badge tone="gray">플랜 없음</Badge>}
            <Link href="/projects/new" className={buttonClass("primary", "sm")}>
              <PlusIcon className="size-3.5" /> 새 프로젝트
            </Link>
            <span className="hidden text-xs text-white/50 md:inline">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" title="로그아웃">
                <LogOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
