"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/** 열린 리다이렉트 방지: next 는 사이트 내부 경로만 허용 */
function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export function AuthForm({ mode, next, plan }: { mode: "login" | "signup"; next?: string; plan?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 플랜을 고르고 가입하면 결제 페이지로, 아니면 대시보드로
  const destination = plan ? `/billing?plan=${encodeURIComponent(plan)}` : safeNext(next);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}` },
        });
        if (error) throw error;
        // 이메일 확인이 켜져 있으면 세션이 없다 → 안내만. 꺼져 있으면 바로 이동.
        if (!data.session) {
          setNotice("가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 로그인됩니다.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(destination);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setError(
        msg.includes("Invalid login credentials")
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : msg.includes("already registered")
            ? "이미 가입된 이메일입니다."
            : msg.includes("is invalid")
              ? "이메일 주소를 확인하세요. 실제로 받을 수 있는 메일 주소여야 합니다."
              : msg.includes("Password should")
                ? "비밀번호는 8자 이상이어야 합니다."
                : msg.includes("rate limit") || msg.includes("Too many")
                  ? "잠시 후 다시 시도하세요."
                  : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight">{mode === "login" ? "로그인" : "회원가입"}</h2>
      <p className="mt-1 text-sm text-ink-500">{mode === "login" ? "이메일 또는 Google 계정으로 로그인하세요." : "이메일 또는 Google 계정으로 시작하세요."}</p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" ? (
          <div>
            <Label htmlFor="name">이름</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
          />
          {mode === "signup" ? <p className="mt-1 text-xs text-ink-500">8자 이상</p> : null}
        </div>
        {error ? <Alert tone="red">{error}</Alert> : null}
        {notice ? <Alert tone="blue">{notice}</Alert> : null}
        <Button type="submit" variant="dark" size="lg" className="w-full" disabled={busy}>
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {mode === "login" ? "계속" : "가입하기"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
        <span className="h-px flex-1 bg-ink-200" />
        또는
        <span className="h-px flex-1 bg-ink-200" />
      </div>
      <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
        <GoogleMark />
        Google 로 {mode === "login" ? "로그인" : "시작하기"}
      </Button>

      {mode === "signup" ? (
        <p className="mt-4 text-xs leading-relaxed text-ink-500">가입하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주됩니다.</p>
      ) : null}

      {/* 디자인 피클 로그인 하단의 "NEW HERE?" 블록 */}
      <div className="mt-12 border-t border-ink-200 pt-6">
        <p className="eyebrow text-sky-600">{mode === "login" ? "처음이신가요?" : "이미 계정이 있나요?"}</p>
        <p className="mt-1 text-lg font-extrabold tracking-tight">{mode === "login" ? "작게 시작하거나, 한 번에 다 만들거나" : "바로 이어서 만드세요"}</p>
        <Link href={mode === "login" ? "/signup" : "/login"} className="mt-4 inline-flex h-9 items-center rounded-full bg-sky-400 px-4 text-[13px] font-semibold text-night-950 hover:bg-sky-300">
          {mode === "login" ? "회원가입" : "로그인"}
        </Link>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
