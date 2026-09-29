import type { Metadata } from "next";
import { Suspense } from "react";

import { PayButton } from "@/components/billing/pay-button";
import { PaymentReturnHandler } from "@/components/billing/payment-return";
import { SubscribeCard } from "@/components/billing/subscribe-card";
import { SubscriptionPanel } from "@/components/billing/subscription-panel";
import { PlanGrid } from "@/components/pricing/plan-grid";
import { Alert } from "@/components/ui/card";
import { CREDIT_PACKS, PLAN_BY_CODE, REQUEST_KIND_LABEL, formatKrw, type PlanCode } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { getClientEnv, paymentsAvailable } from "@/lib/env";
import { getQuota } from "@/lib/quota";
import { MAX_RENEWAL_ATTEMPTS } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import type { PaymentRow } from "@/lib/types/db";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "플랜 · 결제" };
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requireUser("/billing");
  const sp = await searchParams;
  const selected = typeof sp.plan === "string" && sp.plan in PLAN_BY_CODE ? (sp.plan as PlanCode) : null;

  const [{ subscription, plan, state, graceUntil }, payments] = await Promise.all([getSubscription(user.id), listPayments(user.id)]);
  const quota = await getQuota(user.id, plan);
  const env = getClientEnv();
  const avail = paymentsAvailable();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">플랜 · 결제</h1>
      <p className="mt-1 text-sm text-ink-500">
        {plan ? (
          <>
            현재 <span className="font-medium text-ink-900">{plan.name}</span> 플랜 · 기간 종료 {formatDate(subscription!.current_period_end)}
          </>
        ) : (
          "아직 사용 가능한 플랜이 없습니다. 플랜을 선택하면 제작과 수정 요청이 시작됩니다."
        )}
      </p>

      <Suspense>
        <PaymentReturnHandler />
      </Suspense>

      {subscription ? (
        <div className="mt-6 max-w-2xl">
          <SubscriptionPanel
            subscription={subscription}
            state={state}
            graceUntil={graceUntil ? graceUntil.toISOString() : null}
            storeId={env.NEXT_PUBLIC_PORTONE_STORE_ID}
            channelKey={env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY}
            customerEmail={user.email}
            mock={avail.mock}
            maxAttempts={MAX_RENEWAL_ATTEMPTS}
          />
        </div>
      ) : null}

      {!avail.enabled ? (
        <Alert tone="gray" className="mt-4">
          결제 설정이 없어 실제 결제가 비활성화되어 있습니다. .env.local 에 {avail.missing.join(", ")} 를 채우거나 개발용 <code>PAYMENTS_MOCK=true</code> 를 켜세요.
        </Alert>
      ) : null}

      {selected ? (
        <div className="mt-6 max-w-xl">
          <SubscribeCard
            planCode={selected}
            currentPlan={plan?.code ?? null}
            storeId={env.NEXT_PUBLIC_PORTONE_STORE_ID}
            channelKey={env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY}
            customerEmail={user.email}
            mock={avail.mock}
          />
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">플랜 선택</h2>
        <div className="mt-4">
          <PlanGrid tone="dark" currentPlan={plan?.code ?? null} ctaHref={(code) => `/billing?plan=${code}`} />
        </div>
      </section>

      <section id="credits" className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-lg font-semibold">이번 주 사용량 · 크레딧</h2>
          <div className="mt-3 overflow-hidden rounded-md border border-ink-200 bg-surface text-sm">
            <UsageRow label={REQUEST_KIND_LABEL.ai} q={quota.ai} />
            <UsageRow label={REQUEST_KIND_LABEL.expert} q={quota.expert} />
          </div>
          <p className="mt-2 text-xs text-ink-500">주간 한도는 매주 월요일에 초기화됩니다. 크레딧은 한도를 넘는 요청에만 차감되며 만료되지 않습니다.</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold">추가 요청 크레딧 구매</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {CREDIT_PACKS.map((p) => (
              <div key={p.code} className="flex items-center justify-between rounded-md border border-ink-200 bg-surface p-4">
                <div>
                  <p className="text-sm font-medium">
                    {REQUEST_KIND_LABEL[p.kind]} {p.count}회
                  </p>
                  <p className="text-xs text-ink-500">{formatKrw(p.priceKrw)}</p>
                </div>
                <PayButton
                  purchase={{ kind: "credits", packCode: p.code }}
                  storeId={env.NEXT_PUBLIC_PORTONE_STORE_ID}
                  channelKey={env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY}
                  customerEmail={user.email}
                  size="sm"
                  variant="outline"
                  disabled={!avail.enabled}
                >
                  구매
                </PayButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">결제 내역</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">결제 내역이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-ink-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs text-ink-500">
                <tr>
                  <th className="px-4 py-2 font-medium">일시</th>
                  <th className="px-4 py-2 font-medium">내용</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 text-right font-medium">금액</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-ink-100">
                    <td className="px-4 py-2.5 text-ink-500">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-2.5">{p.order_name}</td>
                    <td className="px-4 py-2.5">{{ pending: "대기", paid: "완료", failed: "실패", cancelled: "취소" }[p.status]}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatKrw(p.amount_krw)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UsageRow({ label, q }: { label: string; q: { weekly: number | null; used: number; credits: number } }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 last:border-b-0">
      <span>{label}</span>
      <span className="tabular-nums text-ink-700">
        {q.weekly === null ? "무제한" : `${q.used} / ${q.weekly}`}
        <span className="ml-3 text-ink-400">크레딧 {q.credits}</span>
      </span>
    </div>
  );
}

async function listPayments(userId: string): Promise<PaymentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
  return (data as PaymentRow[]) ?? [];
}
