"use client";

import { MessageSquareIcon } from "lucide-react";
import { useState } from "react";

import { ReplyForm, type SendResult } from "@/components/messages/reply-form";

/**
 * 요청 대화의 답글 칸. 평소에는 "답글 쓰기" 버튼만 보이고 누르면 입력칸이 열린다.
 * 담당자가 답을 기다리는 요청(open)은 처음부터 열어 둔다.
 */
export function ReplyToggle({ send, open = false, placeholder }: { send: (body: string) => Promise<SendResult>; open?: boolean; placeholder?: string }) {
  const [shown, setShown] = useState(open);
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
        <MessageSquareIcon className="size-3.5" /> 답글 쓰기
      </button>
    );
  }
  return <ReplyForm send={send} placeholder={placeholder} />;
}
