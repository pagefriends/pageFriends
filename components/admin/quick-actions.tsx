"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateBatchAction, updateProjectStatusAction } from "@/app/(admin)/admin/actions";
import { Select } from "@/components/ui/input";
import type { ProjectStatus, RequestStatus } from "@/lib/types/db";
import { cn } from "@/lib/utils";

/** 목록에서 묶음 전체 상태를 한 번에 바꾸는 작은 셀렉트 */
export function BatchStatusSelect({ batchId, className }: { batchId: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Select
        defaultValue=""
        disabled={pending}
        className="h-7 w-auto py-0 text-xs"
        onChange={(e) => {
          const v = e.target.value as RequestStatus | "";
          if (!v) return;
          start(async () => {
            const r = await updateBatchAction(batchId, v);
            setMsg(r?.error ?? r?.message ?? null);
            router.refresh();
          });
        }}
      >
        <option value="">묶음 전체…</option>
        <option value="processing">처리중으로</option>
        <option value="done">반영 완료로</option>
        <option value="pending">접수로 되돌리기</option>
      </Select>
      {msg ? <span className="text-[11px] text-ink-500">{msg}</span> : null}
    </span>
  );
}

const PROJECT_STATUS: { value: ProjectStatus; label: string }[] = [
  { value: "brief", label: "정보 입력 중" },
  { value: "building", label: "제작 중" },
  { value: "review", label: "수정 반영 중" },
  { value: "live", label: "운영 중" },
];

export function ProjectStatusSelect({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      defaultValue={status}
      disabled={pending}
      className="h-8 w-auto py-0 text-xs"
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          await updateProjectStatusAction(projectId, v);
          router.refresh();
        });
      }}
    >
      {PROJECT_STATUS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
