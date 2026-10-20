"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import {
  ANNUAL_MONTHS,
  BILLING_CYCLE_UNIT,
  DEVICE_LABEL,
  PLANS,
  annualSavings,
  formatKrw,
  planPrice,
  type BillingCycle,
  type PlanCode,
} from "@/config/plans";
import { josa } from "@/lib/site-plan";
import { cn } from "@/lib/utils";

/**
 * 플랜 카드 3장 + 월간 · 연간 전환. 공개 요금제(어두운 바탕)와 결제 페이지가 공유한다.
 * tone="dark" 면 디자인 피클식 어두운 카드, 추천 플랜은 하늘색 테두리로 강조.
 * 버튼은 고른 결제 주기를 주소에 담아 넘긴다 (?plan=starter&cycle=year).
 */
export function PlanGrid({
  currentPlan,
  currentCycle,
  ctaBase,
  initialCycle = "month",
  tone = "light",
}: {
  currentPlan?: PlanCode | null;
  currentCycle?: BillingCycle | null;
  /** 버튼이 가는 곳: 가입(공개 요금제) 또는 결제 페이지 */
  ctaBase: "/signup" | "/billing";
  initialCycle?: BillingCycle;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="결제 주기"
        className={cn("inline-flex rounded-full border p-1 text-sm", dark ? "border-night-700 bg-night-900" : "border-ink-200 bg-white")}
      >
        {(["month", "year"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cycle === c}
            onClick={() => setCycle(c)}
            className={cn(
              "rounded-full px-4 py-1.5 font-semibold transition-colors",
              cycle === c ? (dark ? "bg-white text-night-950" : "bg-ink-900 text-white") : dark ? "text-white/70 hover:text-white" : "text-ink-600 hover:text-ink-900",
            )}
          >
            {c === "month" ? "월간 결제" : "연간 결제"}
            {c === "year" ? <span className={cn("ml-1.5 text-xs font-bold", cycle === c ? "text-brand-600" : dark ? "text-sky-400" : "text-brand-600")}>2개월 무료</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.code === currentPlan && (currentCycle ?? "month") === cycle;
          const href = `${ctaBase}?plan=${plan.code}${cycle === "year" ? "&cycle=year" : ""}`;
          return (
            <div
              key={plan.code}
              className={cn(
                "flex flex-col rounded-2xl border p-6",
                dark ? "border-night-700 bg-night-900 text-white" : "border-ink-200 bg-white",
                plan.recommended && (dark ? "border-sky-400 ring-1 ring-sky-400" : "border-brand-600 ring-1 ring-brand-600"),
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                {isCurrent ? <Badge tone="dark">현재 플랜</Badge> : plan.recommended ? <Badge tone={dark ? "sky" : "blue"}>추천</Badge> : null}
              </div>
              <p className={cn("mt-1 text-[13px]", dark ? "text-white/60" : "text-ink-500")}>{plan.tagline}</p>
              <p className="mt-5 text-3xl font-extrabold tracking-tight">
                {formatKrw(planPrice(plan, cycle))}
                <span className={cn("text-sm font-normal", dark ? "text-white/50" : "text-ink-500")}> / {BILLING_CYCLE_UNIT[cycle]}</span>
              </p>
              <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-ink-500")}>
                {cycle === "year" ? (
                  <span className={dark ? "text-sky-300" : "text-brand-700"}>
                    월 {formatKrw(plan.priceKrw)} × {ANNUAL_MONTHS}개월 · {formatKrw(annualSavings(plan))} 아껴요
                  </span>
                ) : (
                  <>연간 결제 시 {formatKrw(planPrice(plan, "year"))} (2개월 무료)</>
                )}
              </p>
              <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-ink-500")}>{plan.devices.map((d) => DEVICE_LABEL[d]).join(" · ")} 대응</p>
              <ul className={cn("mt-5 flex flex-1 flex-col gap-2.5 text-[13px]", dark ? "text-white/80" : "text-ink-700")}>
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckIcon className={cn("mt-0.5 size-3.5 shrink-0", dark ? "text-sky-400" : "text-brand-600")} />
                    <span>{f}</span>
                  </li>
                ))}
                {cycle === "year" ? (
                  <li className="flex gap-2">
                    <CheckIcon className={cn("mt-0.5 size-3.5 shrink-0", dark ? "text-sky-400" : "text-brand-600")} />
                    <span className="font-semibold">전문가에게 첫 제작 맡기기 포함</span>
                  </li>
                ) : null}
              </ul>
              <Link href={href} className={buttonClass(plan.recommended ? "primary" : dark ? "outlineLight" : "outline", "md", "mt-6 w-full")}>
                {isCurrent ? "플랜 관리" : currentPlan ? `${josa(`${plan.name}${cycle === "year" ? " 연간" : ""}`, "으로/로")} 변경` : `${plan.name} 시작`}
              </Link>
            </div>
          );
        })}
      </div>

      <p className={cn("mt-4 text-xs leading-relaxed", dark ? "text-white/50" : "text-ink-500")}>
        금액은 부가세 포함입니다. 연간 결제는 월 요금의 {ANNUAL_MONTHS}배이고, 토큰과 전문가 요청 한도는 연간 결제도 매달 다시 채워집니다. 사이트 10개 이상이나 앱 제작이 필요하면{" "}
        <Link href="/consultation" className={cn("font-medium underline", dark ? "text-white/80" : "text-ink-700")}>
          별도 상담
        </Link>
        으로 안내해 드려요.
      </p>
    </div>
  );
}
