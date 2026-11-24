"use client";

import { GiftIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startBetaAction } from "@/app/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";

/** 무료 베타 시작 카드 (플랜이 없고 처음인 사람에게). 시작하면 새 사이트 만들기로 보낸다 */
export function BetaCard({ planName, months, seatsLeft, monthlyExpert, tokens }: { planName: string; months: number; seatsLeft: number; monthlyExpert: number; tokens: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div id="beta" className="rounded-md border border-brand-300 bg-surface p-5">
      <div className="flex items-center gap-2">
        <GiftIcon className="size-5 text-brand-600" />
        <h2 className="text-lg font-semibold">무료 베타 · {planName} 플랜 {months}개월 무료</h2>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink-700">
        <li>· 결제 정보 없이 바로 시작해요. 기간이 끝나도 자동으로 결제되지 않아요.</li>
        <li>
          · 토큰 매달 {tokens} · 전문가 수정 요청 매달 {monthlyExpert}회 · 관리자 페이지 포함
        </li>
        <li>· 선착순이에요. 남은 자리 {seatsLeft}곳</li>
      </ul>
      {error ? (
        <Alert tone="red" className="mt-3">
          {error}
        </Alert>
      ) : null}
      <Button
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await startBetaAction();
            if (!r.ok) {
              setError(r.error);
              return;
            }
            router.push("/projects/new");
          })
        }
      >
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        무료로 시작하기
      </Button>
    </div>
  );
}
