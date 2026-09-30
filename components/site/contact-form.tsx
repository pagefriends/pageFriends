"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitContactAction, type InquiryState } from "@/app/actions/inquiries";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

/** 도움말 센터 하단의 간단한 문의 폼. inquiries 테이블에 kind=contact 로 저장된다. */
export function ContactForm() {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitContactAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ct-name" required>
            이름
          </Label>
          <Input id="ct-name" name="name" required maxLength={60} autoComplete="name" placeholder="홍길동" />
        </div>
        <div>
          <Label htmlFor="ct-email" required>
            이메일
          </Label>
          <Input id="ct-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@example.com" />
        </div>
      </div>
      <div>
        <Label htmlFor="ct-message" required>
          문의 내용
        </Label>
        <Textarea id="ct-message" name="message" required maxLength={3000} className="min-h-32" placeholder="어떤 화면에서 무엇이 궁금한지 적어 주세요. 사이트 이름을 함께 적으면 더 빨리 답할 수 있습니다." />
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700">
        <input type="checkbox" name="agree" required className="mt-0.5 size-4 shrink-0 accent-brand-600" />
        <span>
          답변을 위한 개인정보 수집 · 이용에 동의합니다.{" "}
          <Link href="/privacy" className="font-semibold text-brand-600 hover:underline">
            개인정보처리방침
          </Link>
        </span>
      </label>
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="blue">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending} className="sm:self-start">
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        문의 보내기
      </Button>
    </form>
  );
}
