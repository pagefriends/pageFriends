"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW, DEVICE_LABEL, PLAN_BY_CODE, formatKrw, type PlanCode } from "@/config/plans";

/**
 * 플랜 결제 카드. 비즈니스 플랜은 "결제 시스템 포함" 옵션을 고르면 첫 달 289,000원 고지를 보여준다.
 * 실제 결제: 포트원 빌링키 발급(카드 등록) → /api/payments/subscribe 가 첫 달을 결제하고 구독을 활성화.
 */
export function SubscribeCard({
  planCode,
  currentPlan,
  storeId,
  channelKey,
  customerEmail,
  mock,
}: {
  planCode: PlanCode;
  currentPlan: PlanCode | null;
  storeId: string;
  channelKey: string;
  customerEmail: string;
  mock: boolean;
}) {
  const router = useRouter();
  const plan = PLAN_BY_CODE[planCode];
  const [addon, setAddon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isBusinessAddon = planCode === "business" && addon;
  const firstMonth = isBusinessAddon ? BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW : plan.priceKrw;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      let billingKey: string | null = null;
      if (!mock) {
        if (!storeId || !channelKey) throw new Error("결제 설정(NEXT_PUBLIC_PORTONE_*)이 없습니다.");
        const issueId = `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const res = await PortOne.requestIssueBillingKey({
          storeId,
          channelKey,
          billingKeyMethod: "CARD",
          issueId,
          issueName: `페이지프렌즈 ${plan.name} 플랜`,
          customer: { email: customerEmail },
          redirectUrl: `${window.location.origin}/billing?plan=${planCode}&billingReturn=1`,
        });
        if (!res || res.code !== undefined || !res.billingKey) throw new Error(res?.message ?? "카드 등록이 취소되었습니다.");
        billingKey = res.billingKey;
      }
      const r = await fetch("/api/payments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, paymentAddon: isBusinessAddon, billingKey }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "구독 결제에 실패했습니다.");
      setDone(true);
      router.replace("/billing");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-brand-600 bg-surface p-5 ring-1 ring-brand-600">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{plan.name} 플랜 시작</h2>
        {currentPlan === planCode ? <Badge tone="dark">현재 플랜</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {plan.tagline} · {plan.devices.map((d) => DEVICE_LABEL[d]).join(" · ")} 대응
      </p>

      {planCode === "business" ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded border border-ink-200 p-3">
          <input type="checkbox" checked={addon} onChange={(e) => setAddon(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span className="text-sm">
            <span className="font-medium">결제 시스템 포함 (쇼핑몰 결제 연동)</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
              결제 연동 초기 구축 비용이 포함되어 <span className="font-medium text-ink-900">첫 달 {formatKrw(BUSINESS_PAYMENT_ADDON_FIRST_MONTH_KRW)}</span>이 청구되고, 다음 달부터는 월{" "}
              {formatKrw(plan.priceKrw)}입니다.
            </span>
          </span>
        </label>
      ) : null}

      <dl className="mt-4 flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">첫 달 결제</dt>
          <dd className="font-semibold">{formatKrw(firstMonth)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">다음 달부터</dt>
          <dd>{formatKrw(plan.priceKrw)} / 월</dd>
        </div>
      </dl>

      {mock ? <Alert tone="gray" className="mt-4 text-xs">개발용 mock 결제 모드입니다. 포트원 결제창 없이 바로 활성화됩니다.</Alert> : null}
      {error ? <Alert tone="red" className="mt-4">{error}</Alert> : null}
      {done ? <Alert tone="blue" className="mt-4">구독이 활성화되었습니다.</Alert> : null}

      <div className="mt-4 flex gap-2">
        <Button size="lg" className="flex-1" onClick={pay} disabled={busy || done}>
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {mock ? "플랜 활성화" : `카드 등록 후 ${formatKrw(firstMonth)} 결제`}
        </Button>
        <Link href="/billing" className="inline-flex h-12 items-center px-3 text-sm text-ink-500 hover:text-ink-900">
          취소
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">결제는 포트원(토스페이먼츠)을 통해 안전하게 처리되며 카드 정보는 저장되지 않습니다.</p>
    </div>
  );
}
