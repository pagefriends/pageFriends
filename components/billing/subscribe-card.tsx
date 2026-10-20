"use client";

import * as PortOne from "@portone/browser-sdk/v2";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import {
  ANNUAL_MONTHS,
  BILLING_CYCLE_LABEL,
  BILLING_CYCLE_UNIT,
  DEVICE_LABEL,
  PAYMENT_SETUP_FEE_KRW,
  PLAN_BY_CODE,
  annualSavings,
  cycleMonths,
  formatKrw,
  planPrice,
  type BillingCycle,
  type PlanCode,
} from "@/config/plans";
import { quoteChange, type CurrentTerms } from "@/lib/billing-quote";
import { cn, formatDate } from "@/lib/utils";

/**
 * 플랜 시작 · 변경 카드. 결제 주기(월간 · 연간)와 결제 시스템 연동을 고르면 지금 낼 금액을 바로 보여 준다.
 * 금액 계산은 서버와 같은 quoteChange — 실제 결제 금액은 서버가 다시 계산한다.
 * - 시작 · 올리기 · 결제 시스템 켜기: 포트원 빌링키 발급(카드 등록) → /api/payments/subscribe 가 결제
 * - 내리기 · 연간 → 월간: 카드 등록 없이 다음 결제부터 바뀌게 예약
 */
export function SubscribeCard({
  planCode,
  initialCycle,
  current,
  hadAddon,
  storeId,
  channelKey,
  customerEmail,
  mock,
  now,
}: {
  planCode: PlanCode;
  initialCycle: BillingCycle;
  current: CurrentTerms | null;
  /** 결제 시스템 연동비를 이미 냈는가 */
  hadAddon: boolean;
  storeId: string;
  channelKey: string;
  customerEmail: string;
  mock: boolean;
  /** 서버가 화면을 그린 시각 — 남은 기간 금액을 서버 · 브라우저가 같게 계산하도록 (실제 결제 금액은 서버가 결제 순간에 다시 계산) */
  now: string;
}) {
  const router = useRouter();
  const plan = PLAN_BY_CODE[planCode];
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [addon, setAddon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const at = new Date(now);
  const q = quoteChange({ current, hadAddon }, { planCode, cycle, paymentAddon: addon }, at);
  const paysNow = q.mode === "new" || q.mode === "now" || q.mode === "addon";
  const from = current ? `${PLAN_BY_CODE[current.planCode].name} (${BILLING_CYCLE_LABEL[current.cycle]})` : null;
  const to = `${plan.name} (${BILLING_CYCLE_LABEL[cycle]})`;
  const title =
    q.mode === "new"
      ? `${plan.name} 플랜 시작`
      : q.mode === "addon"
        ? "결제 시스템 연동 켜기"
        : q.mode === "same"
          ? `${to} 이용 중`
          : `${from} → ${to}`;
  const canAddon = plan.paymentSystem === "addon" && !hadAddon && q.mode !== "later";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let billingKey: string | null = null;
      if (paysNow && !mock) {
        if (!storeId || !channelKey) throw new Error("결제 설정(NEXT_PUBLIC_PORTONE_*)이 없습니다.");
        const issueId = `bk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const res = await PortOne.requestIssueBillingKey({
          storeId,
          channelKey,
          billingKeyMethod: "CARD",
          issueId,
          issueName: `페이지프렌즈 ${plan.name} 플랜`,
          customer: { email: customerEmail },
          redirectUrl: `${window.location.origin}/billing?plan=${planCode}${cycle === "year" ? "&cycle=year" : ""}&billingReturn=1`,
        });
        if (!res || res.code !== undefined || !res.billingKey) throw new Error(res?.message ?? "카드 등록이 취소되었습니다.");
        billingKey = res.billingKey;
      }
      const r = await fetch("/api/payments/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, cycle, paymentAddon: addon, billingKey }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "구독 결제에 실패했습니다.");
      setDone(
        body.mode === "later"
          ? `${formatDate(body.effectiveAt)}부터 ${to}로 바뀌어요. 그때까지는 지금 플랜 그대로 써요.`
          : body.mode === "same"
            ? "예약해 둔 플랜 변경을 취소했어요."
            : body.mode === "addon"
              ? "결제 시스템 연동을 켰어요."
              : "구독이 활성화되었습니다.",
      );
      router.replace("/billing");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const nextPayment = new Date(at);
  nextPayment.setMonth(nextPayment.getMonth() + cycleMonths(cycle));
  const nextStart = nextPayment.toISOString();

  return (
    <div className="rounded-md border border-brand-600 bg-surface p-5 ring-1 ring-brand-600">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {q.mode === "same" ? <Badge tone="dark">현재 플랜</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {plan.tagline} · {plan.devices.map((d) => DEVICE_LABEL[d]).join(" · ")} 대응
      </p>

      {/* 결제 주기 */}
      <div role="radiogroup" aria-label="결제 주기" className="mt-4 grid gap-2 sm:grid-cols-2">
        {(["month", "year"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cycle === c}
            onClick={() => setCycle(c)}
            className={cn("rounded-md border p-3 text-left", cycle === c ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-400")}
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {BILLING_CYCLE_LABEL[c]} 결제{c === "year" ? <span className="text-xs font-bold text-brand-700">2개월 무료</span> : null}
            </span>
            <span className="mt-0.5 block text-sm tabular-nums">
              {formatKrw(planPrice(plan, c))} <span className="text-ink-500">/ {BILLING_CYCLE_UNIT[c]}</span>
            </span>
            <span className="mt-0.5 block text-xs text-ink-500">
              {c === "year" ? `월 요금 × ${ANNUAL_MONTHS} · ${formatKrw(annualSavings(plan))} 절약 · 전문가 첫 제작 포함` : "언제든 해지 · 첫 제작은 AI로"}
            </span>
          </button>
        ))}
      </div>

      {canAddon ? (
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded border border-ink-200 p-3">
          <input type="checkbox" checked={addon} onChange={(e) => setAddon(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span className="text-sm">
            <span className="font-medium">결제 시스템 연동 (쇼핑몰 결제)</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">
              사이트 안에서 결제를 받아야 할 때 켜요. 연동비 <span className="font-medium text-ink-900">{formatKrw(PAYMENT_SETUP_FEE_KRW)}</span>은 처음 한 번만
              받고, 플랜을 바꿔도 다시 받지 않아요.
            </span>
          </span>
        </label>
      ) : null}

      {/* 금액 */}
      <dl className="mt-4 flex flex-col gap-1.5 text-sm">
        {q.mode === "later" ? (
          <>
            <Line k="바뀌는 날" v={`${formatDate(q.effectiveAt!)} (다음 결제일)`} />
            <Line k="그날 결제" v={`${formatKrw(q.planKrw)} / ${BILLING_CYCLE_UNIT[cycle]}`} />
            <Line k="지금 결제" v="없음" strong />
          </>
        ) : q.mode === "same" ? (
          <Line k="지금 결제" v="없음" />
        ) : (
          <>
            {q.mode !== "addon" ? <Line k={`${to} 금액`} v={formatKrw(q.planKrw)} /> : null}
            {q.creditKrw > 0 ? <Line k="지금 플랜 남은 기간 빼기" v={`- ${formatKrw(q.creditKrw)}`} /> : null}
            {q.setupFeeKrw > 0 ? <Line k="결제 시스템 연동 (1회)" v={formatKrw(q.setupFeeKrw)} /> : null}
            <Line k="지금 결제" v={formatKrw(q.chargeKrw)} strong />
            {q.mode !== "addon" ? <Line k="다음 결제" v={`${formatDate(nextStart)} · ${formatKrw(q.planKrw)}`} /> : null}
          </>
        )}
      </dl>

      {q.mode === "now" ? <p className="mt-2 text-xs text-ink-500">새 기간은 오늘부터 다시 시작돼요. 지금 플랜의 남은 날만큼은 빼고 결제해요.</p> : null}
      {q.mode === "later" ? (
        <p className="mt-2 text-xs text-ink-500">
          {current?.cycle === "year" && cycle === "month" ? "연간 결제 중에는 " : "아래 플랜으로 내릴 때는 "}남은 기간을 다 쓴 뒤 바뀌어요. 그때까지는 지금 플랜 그대로 써요.
        </p>
      ) : null}
      {cycle === "year" && paysNow && q.mode !== "addon" ? (
        <p className="mt-2 text-xs text-ink-500">
          연간 결제를 중간에 해지하면, 쓴 달 수만큼 월간 요금으로 계산해 뺀 나머지를 돌려드려요 (
          <Link href="/terms#cancel" className="underline">
            약관
          </Link>
          ).
        </p>
      ) : null}
      {current?.pending && q.mode === "same" ? (
        <Alert tone="gray" className="mt-3 text-xs">
          {formatDate(current.periodEnd)}부터 {PLAN_BY_CODE[current.pending.planCode].name} ({BILLING_CYCLE_LABEL[current.pending.cycle]})로 바꾸기로 예약되어 있어요. 아래
          버튼을 누르면 예약을 취소하고 지금 플랜을 그대로 이어 가요.
        </Alert>
      ) : null}

      {mock && paysNow ? <Alert tone="gray" className="mt-4 text-xs">개발용 mock 결제 모드입니다. 포트원 결제창 없이 바로 처리됩니다.</Alert> : null}
      {error ? <Alert tone="red" className="mt-4">{error}</Alert> : null}
      {done ? <Alert tone="blue" className="mt-4">{done}</Alert> : null}

      <div className="mt-4 flex gap-2">
        <Button size="lg" className="flex-1" onClick={submit} disabled={busy || Boolean(done) || (q.mode === "same" && !current?.pending)}>
          {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {q.mode === "later"
            ? "다음 결제부터 바꾸기"
            : q.mode === "same"
              ? current?.pending
                ? "예약한 변경 취소"
                : "이용 중인 플랜이에요"
              : mock
                ? `${formatKrw(q.chargeKrw)} 결제 (mock)`
                : `카드 등록 후 ${formatKrw(q.chargeKrw)} 결제`}
        </Button>
        <Link href="/billing" className="inline-flex h-12 items-center px-3 text-sm text-ink-500 hover:text-ink-900">
          취소
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">결제는 포트원(토스페이먼츠)을 통해 안전하게 처리되며 카드 정보는 저장되지 않습니다. 금액은 부가세 포함입니다.</p>
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-500">{k}</dt>
      <dd className={cn("text-right tabular-nums", strong && "font-semibold")}>{v}</dd>
    </div>
  );
}
