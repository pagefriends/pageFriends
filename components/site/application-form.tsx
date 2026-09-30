"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { submitApplicationAction, type InquiryState } from "@/app/actions/inquiries";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/input";

export const APPLICATION_ROLES = ["웹 디자이너", "프론트엔드", "콘텐츠 · 카피", "QA · 검수"] as const;
const EXPERIENCE = ["1년 미만", "1~3년", "3~5년", "5년 이상"] as const;

/** 전문가 지원 폼 (/creative-application). inquiries 테이블에 kind=application 으로 저장된다. */
export function ApplicationForm({ defaultRole }: { defaultRole?: string }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitApplicationAction, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="ap-name" required>
            이름
          </Label>
          <Input id="ap-name" name="name" required maxLength={60} autoComplete="name" placeholder="홍길동" />
        </div>
        <div>
          <Label htmlFor="ap-email" required>
            이메일
          </Label>
          <Input id="ap-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@example.com" />
        </div>
        <div>
          <Label htmlFor="ap-phone">연락처</Label>
          <Input id="ap-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="010-0000-0000" />
        </div>
        <div>
          <Label htmlFor="ap-role" required>
            지원 분야
          </Label>
          <Select id="ap-role" name="role" required defaultValue={defaultRole && (APPLICATION_ROLES as readonly string[]).includes(defaultRole) ? defaultRole : ""}>
            <option value="" disabled>
              선택하세요
            </option>
            {APPLICATION_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ap-portfolio" required>
            포트폴리오 URL
          </Label>
          <Input id="ap-portfolio" name="portfolio" type="url" required maxLength={300} placeholder="https://" />
          <Hint>비핸스 · 노션 · 개인 사이트 · 깃허브 등 공개 링크</Hint>
        </div>
        <div>
          <Label htmlFor="ap-experience">경력</Label>
          <Select id="ap-experience" name="experience" defaultValue="">
            <option value="">선택</option>
            {EXPERIENCE.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="ap-message">자기소개 · 하고 싶은 말</Label>
        <Textarea id="ap-message" name="message" maxLength={3000} className="min-h-32" placeholder="주로 어떤 사이트를 만들어 왔는지, 어떤 툴을 쓰는지, 주당 가능한 시간을 적어 주세요." />
      </div>
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-700">
        <input type="checkbox" name="agree" required className="mt-0.5 size-4 shrink-0 accent-brand-600" />
        <span>
          지원서 검토를 위한 개인정보 수집 · 이용에 동의합니다.{" "}
          <Link href="/privacy" className="font-semibold text-brand-600 hover:underline">
            개인정보처리방침
          </Link>
        </span>
      </label>
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="blue">{state.message}</Alert> : null}
      <Button type="submit" size="lg" disabled={pending} className="sm:self-start">
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        지원서 보내기
      </Button>
    </form>
  );
}
