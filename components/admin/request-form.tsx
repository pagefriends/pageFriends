"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";

import { updateRequestAction, type AdminActionState } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import type { RequestStatus } from "@/lib/types/db";

const STATUS_OPTIONS: { value: RequestStatus; label: string; hint: string }[] = [
  { value: "pending", label: "접수", hint: "아직 손대지 않음" },
  { value: "processing", label: "처리중", hint: "작업 중. 사용자 캔버스에 점선으로 표시" },
  { value: "done", label: "반영 완료", hint: "사이트에 반영됨" },
  { value: "rejected", label: "반영 불가", hint: "답변에 이유를 적어주세요. 주간 한도에서 제외됨" },
];

/** 요청 상태 변경 + 답변 작성 폼 */
export function RequestForm({ requestId, status, note }: { requestId: string; status: RequestStatus; note: string | null }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(updateRequestAction, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <Label htmlFor="status">상태</Label>
        <Select id="status" name="status" defaultValue={status}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="note">답변 (사용자에게 표시)</Label>
        <Textarea id="note" name="note" defaultValue={note ?? ""} placeholder="예: 제목을 2줄로 줄이고 강조색을 적용했습니다. 확인 부탁드립니다." className="min-h-28" maxLength={2000} />
      </div>
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="blue">{state.message}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        저장
      </Button>
    </form>
  );
}
