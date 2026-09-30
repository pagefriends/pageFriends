"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitConsultationAction, type InquiryState } from "@/app/actions/inquiries";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/input";

const BUDGETS = ["월 3만원대", "월 9만원대", "월 35만원대", "월 130만원대", "미정"] as const;
const URGENCY = ["이번 주", "이번 달", "3개월 안", "미정"] as const;

/** 상담 신청 폼 (/consultation). 사이트 종류 목록은 서버에서 SOLUTIONS 이름을 넘긴다. */
export function ConsultationForm({ siteTypes }: { siteTypes: string[] }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitConsultationAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cs-name" required>
            이름
          </Label>
          <Input id="cs-name" name="name" required maxLength={60} autoComplete="name" placeholder="홍길동" />
        </div>
        <div>
          <Label htmlFor="cs-email" required>
            이메일
          </Label>
          <Input id="cs-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="cs-phone">연락처</Label>
          <Input id="cs-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="010-0000-0000" />
        </div>
        <div>
          <Label htmlFor="cs-company">회사 · 매장명</Label>
          <Input id="cs-company" name="company" maxLength={100} autoComplete="organization" placeholder="예: 카페 모닝" />
        </div>
        <div>
          <Label htmlFor="cs-siteType">만들고 싶은 사이트</Label>
          <Select id="cs-siteType" name="siteType" defaultValue="">
            <option value="">선택</option>
            {siteTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cs-budget">예산</Label>
          <Select id="cs-budget" name="budget" defaultValue="">
            <option value="">선택</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cs-urgency">언제까지 필요한가요?</Label>
          <Select id="cs-urgency" name="urgency" defaultValue="">
            <option value="">선택</option>
            {URGENCY.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="cs-message">하고 싶은 말</Label>
        <Textarea id="cs-message" name="message" maxLength={3000} placeholder="어떤 사이트가 필요한지, 참고할 사이트가 있는지 편하게 적어 주세요." />
        <Hint>30분 통화에서 다룰 내용을 미리 적어 두면 상담이 빨라집니다.</Hint>
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700">
        <input type="checkbox" name="agree" required className="mt-0.5 size-4 shrink-0 accent-brand-600" />
        <span>
          <Link href="/terms" className="font-semibold text-brand-600 hover:underline">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="font-semibold text-brand-600 hover:underline">
            개인정보처리방침
          </Link>
          에 따라 상담 목적의 개인정보 수집 · 이용에 동의합니다.
        </span>
      </label>
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="blue">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        상담 신청
      </Button>
    </form>
  );
}
