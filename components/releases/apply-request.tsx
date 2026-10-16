"use client";

import { LoaderCircleIcon, RocketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelReleaseAction, requestReleaseAction } from "@/app/(app)/projects/[id]/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Hint, Label, Textarea } from "@/components/ui/input";

/**
 * "웹사이트에 적용 요청" 폼. 담당자에게 남길 말은 선택. 보내면 화면을 다시 받아 진행 단계가 보이게 한다.
 * 입력값을 직접 들고 있으므로 <form action> 대신 onSubmit 으로 보낸다 (실패해도 쓰던 글이 남게).
 */
export function ApplyRequestForm({ projectId, label, disabledReason }: { projectId: string; label: string; disabledReason: string | null }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (pending || disabledReason) return;
    setError(null);
    start(async () => {
      const res = await requestReleaseAction(projectId, note);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label htmlFor="release-note">담당자에게 남길 말 (선택)</Label>
        <Textarea
          id="release-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 이번 주 금요일 오전 전에 적용해 주세요."
          maxLength={1000}
          className="min-h-20 text-[13px]"
          disabled={Boolean(disabledReason)}
        />
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || Boolean(disabledReason)}>
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : <RocketIcon className="size-4" />}
          {label}
        </Button>
        {disabledReason ? <Hint className="mt-0">{disabledReason}</Hint> : null}
      </div>
    </form>
  );
}

/** 적용 요청 취소 (담당자가 확인용 서버에 올리기 전에만 보인다) */
export function CancelReleaseButton({ projectId, releaseId }: { projectId: string; releaseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("웹사이트 적용 요청을 취소할까요? 실렸던 수정은 다시 '적용 대기' 로 돌아가요.")) return;
          setError(null);
          start(async () => {
            const res = await cancelReleaseAction(projectId, releaseId);
            if (!res.ok) setError(res.error);
            router.refresh();
          });
        }}
      >
        {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : null}
        적용 요청 취소
      </Button>
      {error ? <span className="text-xs text-mark">{error}</span> : null}
    </span>
  );
}
