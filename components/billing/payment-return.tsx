"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/card";

/**
 * 모바일 결제처럼 redirectUrl 로 돌아온 경우 URL 의 paymentId 로 결제를 확정한다.
 * (데스크톱은 결제창이 닫힌 뒤 PayButton 이 바로 /complete 를 부른다.)
 */
export function PaymentReturnHandler() {
  const sp = useSearchParams();
  const router = useRouter();
  const paymentId = sp.get("paymentId");
  const [msg, setMsg] = useState<{ tone: "blue" | "red"; text: string } | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    const code = sp.get("code");
    if (code) {
      // 동기 setState 대신 마이크로태스크로 미뤄 렌더 연쇄를 피한다
      queueMicrotask(() => setMsg({ tone: "red", text: sp.get("message") ?? "결제가 취소되었습니다." }));
      return;
    }
    fetch("/api/payments/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b?.error?.message ?? "결제 확인 실패");
        setMsg({ tone: "blue", text: "결제가 완료되었습니다." });
        router.replace("/billing");
        router.refresh();
      })
      .catch((e) => setMsg({ tone: "red", text: e instanceof Error ? e.message : "결제 확인 실패" }));
  }, [paymentId, router, sp]);

  if (!msg) return null;
  return <Alert tone={msg.tone}>{msg.text}</Alert>;
}
