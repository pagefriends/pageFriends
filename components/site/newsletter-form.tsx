"use client";

import { ArrowRightIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";

import { subscribeNewsletterAction, type InquiryState } from "@/app/actions/inquiries";

/** 푸터 뉴스레터 폼 (이메일 하나 + 화살표 버튼) */
export function NewsletterForm() {
  const [state, action, pending] = useActionState<InquiryState, FormData>(subscribeNewsletterAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="업무용 이메일"
          className="h-11 w-full max-w-xs rounded-full border border-white/30 bg-transparent px-5 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
        />
        <button type="submit" disabled={pending} className="grid size-11 shrink-0 place-items-center rounded-full border border-white/30 text-white hover:border-white disabled:opacity-60" aria-label="구독">
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : <ArrowRightIcon className="size-4" />}
        </button>
      </div>
      {state?.error ? <p className="text-xs text-red-300">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-sky-300">{state.message}</p> : null}
    </form>
  );
}
