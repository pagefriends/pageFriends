import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { DEVICE_LABEL, PLANS, formatKrw, type PlanCode } from "@/config/plans";
import { cn } from "@/lib/utils";

/**
 * 4개 플랜 카드. 공개 요금제·메인(어두운 바탕)과 결제 페이지(흰 바탕)가 공유한다.
 * tone="dark" 면 디자인 피클식 어두운 카드, 추천 플랜은 하늘색 테두리로 강조.
 */
export function PlanGrid({
  currentPlan,
  ctaHref,
  tone = "light",
}: {
  currentPlan?: PlanCode | null;
  ctaHref: (code: PlanCode) => string;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((plan) => {
        const isCurrent = plan.code === currentPlan;
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
              {formatKrw(plan.priceKrw)}
              <span className={cn("text-sm font-normal", dark ? "text-white/50" : "text-ink-500")}> / 월</span>
            </p>
            <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-ink-500")}>{plan.devices.map((d) => DEVICE_LABEL[d]).join(" · ")} 대응</p>
            <ul className={cn("mt-5 flex flex-1 flex-col gap-2.5 text-[13px]", dark ? "text-white/80" : "text-ink-700")}>
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <CheckIcon className={cn("mt-0.5 size-3.5 shrink-0", dark ? "text-sky-400" : "text-brand-600")} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={ctaHref(plan.code)}
              className={buttonClass(plan.recommended ? "primary" : dark ? "outlineLight" : "outline", "md", "mt-6 w-full")}
            >
              {isCurrent ? "플랜 관리" : `${plan.name} 시작`}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
