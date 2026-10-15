"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * 대화 입력칸. 보내는 동작은 서버 액션을 그대로 받는다 (사용자 화면과 관리자 화면이 같이 쓴다).
 * Ctrl(⌘)+Enter 로도 보낸다. quick 은 자주 쓰는 문장 — 누르면 입력칸에 들어간다.
 */
export function ReplyForm({
  send,
  placeholder,
  label = "보내기",
  quick,
  className,
}: {
  send: (body: string) => Promise<SendResult>;
  placeholder?: string;
  label?: string;
  quick?: string[];
  className?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    const text = body.trim();
    if (!text || pending) return;
    setError(null);
    start(async () => {
      const res = await send(text);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  };

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {quick && quick.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => setBody((b) => (b.trim() ? `${b.trimEnd()}\n${q}` : q))} className="rounded-full border border-ink-200 px-2.5 py-1 text-[11px] text-ink-700 hover:border-ink-400">
              {q}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder ?? "메시지"}
          maxLength={2000}
          className="min-h-11 flex-1 text-[13px]"
          rows={2}
        />
        <Button type="submit" size="md" disabled={pending || !body.trim()} className="shrink-0" title="Ctrl+Enter 로도 보낼 수 있습니다">
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
          {label}
        </Button>
      </div>
      {error ? <p className="text-xs text-mark">{error}</p> : null}
    </form>
  );
}
