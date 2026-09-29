"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

export type OneTimePurchase = { kind: "template"; templateId: string } | { kind: "credits"; packCode: string };

/**
 * 단건 결제 버튼 (템플릿·크레딧). 흐름:
 * 1) 서버에 주문 생성(/api/payments/create) → paymentId·금액·주문명 확보 (금액은 서버가 정한다)
 * 2) 포트원 브라우저 SDK 로 결제창 호출 (PG: 토스페이먼츠)
 * 3) 서버에 완료 통보(/api/payments/complete) → 서버가 포트원에 재조회해 금액 검증 후 지급
 * mock 모드면 서버가 2) 를 건너뛰라고 알려준다.
 */
export function PayButton({
  purchase,
  storeId,
  channelKey,
  customerEmail,
  children,
  onDone,
  ...btn
}: ButtonProps & { purchase: OneTimePurchase; storeId: string; channelKey: string; customerEmail: string; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchase),
      }).then(async (r) => ({ ok: r.ok, body: await r.json() }));
      if (!created.ok) throw new Error(created.body?.error?.message ?? "주문을 만들지 못했습니다.");
      const { paymentId, amountKrw, orderName, mock } = created.body as { paymentId: string; amountKrw: number; orderName: string; mock: boolean };

      if (!mock) {
        if (!storeId || !channelKey) throw new Error("결제 설정(NEXT_PUBLIC_PORTONE_*)이 없습니다.");
        const res = await PortOne.requestPayment({
          storeId,
          channelKey,
          paymentId,
          orderName,
          totalAmount: amountKrw,
          currency: "CURRENCY_KRW",
          payMethod: "CARD",
          customer: { email: customerEmail },
          redirectUrl: `${window.location.origin}/billing?paymentId=${encodeURIComponent(paymentId)}`,
        });
        if (!res || res.code !== undefined) throw new Error(res?.message ?? "결제가 취소되었습니다.");
      }

      const done = await fetch("/api/payments/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      }).then(async (r) => ({ ok: r.ok, body: await r.json() }));
      if (!done.ok) throw new Error(done.body?.error?.message ?? "결제 확인에 실패했습니다.");
      onDone?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} disabled={busy || btn.disabled} {...btn}>
        {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        {children}
      </Button>
      {error ? <p className="text-xs text-mark">{error}</p> : null}
    </div>
  );
}
