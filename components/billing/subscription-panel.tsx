"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelSubscriptionAction, resumeSubscriptionAction, retryPaymentAction, type BillingActionResult } from "@/app/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { PLAN_BY_CODE, formatKrw, type PlanCode } from "@/config/plans";
import type { SubscriptionState } from "@/lib/subscriptions";
import type { SubscriptionRow } from "@/lib/types/db";
import { formatDate } from "@/lib/utils";

/**
 * 현재 구독 카드: 상태별 안내 + 해지/해지 취소/재결제/결제 수단 변경.
 * 상태 판정은 서버(effectiveSubscription)가 하고 여기서는 표시와 버튼만 담당한다.
 */
export function SubscriptionPanel({
  subscription,
  state,
  graceUntil,
  storeId,
  channelKey,
  customerEmail,
  mock,
  maxAttempts,
}: {
  subscription: SubscriptionRow;
  state: SubscriptionState;
  graceUntil: string | null;
  storeId: string;
  channelKey: string;
  customerEmail: string;
  mock: boolean;
  maxAttempts: number;
}) {
  const router = useRouter();
  const plan = PLAN_BY_CODE[subscription.plan_code as PlanCode];
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillingActionResult | null>(null);

  const run = (fn: () => Promise<BillingActionResult>) =>
    start(async () => {
      setResult(await fn());
      router.refresh();
    });

  async function changeCard() {
    setBusy(true);
    setResult(null);
    try {
      let billingKey: string | null = null;
      if (!mock) {
        if (!storeId || !channelKey) throw new Error("결제 설정(NEXT_PUBLIC_PORTONE_*)이 없습니다.");
        const res = await PortOne.requestIssueBillingKey({
          storeId,
          channelKey,
          billingKeyMethod: "CARD",
          issueId: `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          issueName: `페이지프렌즈 결제 수단 변경`,
          customer: { email: customerEmail },
          redirectUrl: `${window.location.origin}/billing?cardReturn=1`,
        });
        if (!res || res.code !== undefined || !res.billingKey) throw new Error(res?.message ?? "카드 등록이 취소되었습니다.");
        billingKey = res.billingKey;
      }
      const r = await fetch("/api/payments/change-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billingKey }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "결제 수단 변경에 실패했습니다.");
      setResult({ ok: true, message: body.chargedNow ? "새 카드로 결제되어 구독이 정상화되었습니다." : "결제 수단을 변경했습니다. 다음 갱신부터 새 카드로 결제됩니다." });
      router.refresh();
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  async function simulate(outcome: "paid" | "failed") {
    setBusy(true);
    const r = await fetch("/api/payments/dev/renewal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) });
    const body = await r.json();
    setResult(r.ok ? { ok: true, message: `모의 갱신 ${outcome === "paid" ? "성공" : "실패"} 처리 (${body.paymentId})` } : { ok: false, error: body?.error?.message ?? "실패" });
    setBusy(false);
    router.refresh();
  }

  const periodEnd = formatDate(subscription.current_period_end);
  const disabled = pending || busy;

  return (
    <div className="rounded-md border border-ink-200 bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{plan.name} 플랜</h2>
        <StateBadge state={state} />
        {subscription.payment_addon ? <Badge tone="gray">결제 시스템 포함</Badge> : null}
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <Row k="월 요금" v={`${formatKrw(plan.priceKrw)} / 월`} />
        <Row k="현재 기간" v={`${formatDate(subscription.current_period_start)} ~ ${periodEnd}`} />
        {state === "active" && subscription.next_payment_at ? <Row k="다음 결제" v={formatDate(subscription.next_payment_at)} /> : null}
        {state === "cancelling" ? <Row k="이용 종료" v={`${periodEnd} (해지 예약됨)`} /> : null}
        {state === "past_due" ? <Row k="재시도" v={`${subscription.failed_attempts}/${maxAttempts}회 실패 · 다음 자동 재시도 ${subscription.next_payment_at ? formatDate(subscription.next_payment_at) : "-"}`} /> : null}
      </dl>

      {state === "past_due" ? (
        <Alert tone="red" className="mt-4">
          갱신 결제에 실패했습니다{subscription.last_failure_reason ? ` (${subscription.last_failure_reason})` : ""}.{" "}
          {graceUntil ? `${formatDate(graceUntil)}까지는 그대로 이용할 수 있고, ` : ""}
          {maxAttempts}회 연속 실패하면 구독이 해지됩니다. 지금 다시 결제하거나 다른 카드를 등록하세요.
        </Alert>
      ) : null}
      {state === "cancelling" ? <Alert tone="gray" className="mt-4">해지가 예약되어 있습니다. {periodEnd}까지 이용할 수 있고 이후 자동 결제되지 않습니다. 마음이 바뀌면 해지를 취소하세요.</Alert> : null}
      {state === "expired" || state === "cancelled" ? (
        <Alert tone="gray" className="mt-4">
          구독이 종료되었습니다. 수정 요청을 계속하려면 아래에서 플랜을 다시 선택하세요.
        </Alert>
      ) : null}

      {result ? (
        <Alert tone={result.ok ? "blue" : "red"} className="mt-4">
          {result.ok ? result.message : result.error}
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {state === "past_due" ? (
          <Button onClick={() => run(retryPaymentAction)} disabled={disabled}>
            {disabled ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
            지금 다시 결제
          </Button>
        ) : null}
        {state !== "expired" && state !== "cancelled" ? (
          <Button variant="outline" onClick={changeCard} disabled={disabled}>
            {mock ? "결제 수단 변경 (mock)" : "결제 수단 변경"}
          </Button>
        ) : null}
        {state === "active" || state === "past_due" ? (
          <Button
            variant="ghost"
            className="text-ink-500"
            disabled={disabled}
            onClick={() => {
              if (window.confirm(`구독을 해지할까요? ${periodEnd}까지는 계속 이용할 수 있고, 그 뒤로는 결제되지 않습니다.`)) run(cancelSubscriptionAction);
            }}
          >
            구독 해지
          </Button>
        ) : null}
        {state === "cancelling" ? (
          <Button variant="secondary" onClick={() => run(resumeSubscriptionAction)} disabled={disabled}>
            해지 취소
          </Button>
        ) : null}
        {state === "expired" || state === "cancelled" ? (
          <Link href="/billing?plan=business" className="text-sm font-medium text-brand-600 hover:underline">
            플랜 다시 선택
          </Link>
        ) : null}
      </div>

      {mock && (state === "active" || state === "past_due") ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded border border-dashed border-ink-300 p-3 text-xs text-ink-500">
          <span>개발용 · 갱신 웹훅 시뮬레이션:</span>
          <Button size="sm" variant="outline" onClick={() => simulate("paid")} disabled={disabled}>
            갱신 성공
          </Button>
          <Button size="sm" variant="outline" onClick={() => simulate("failed")} disabled={disabled}>
            갱신 실패
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StateBadge({ state }: { state: SubscriptionState }) {
  const map: Record<SubscriptionState, { label: string; tone: "blue" | "sky" | "gray" | "red" | "dark" }> = {
    none: { label: "없음", tone: "gray" },
    active: { label: "이용 중", tone: "blue" },
    cancelling: { label: "해지 예약", tone: "gray" },
    past_due: { label: "결제 실패", tone: "red" },
    expired: { label: "만료", tone: "gray" },
    cancelled: { label: "해지됨", tone: "dark" },
  };
  return <Badge tone={map[state].tone}>{map[state].label}</Badge>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
