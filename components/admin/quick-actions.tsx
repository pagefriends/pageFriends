"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateBatchAction, updateProjectStatusAction } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { PROJECT_STATUS } from "@/config/requests";
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
        <option value="">묶음 전체 직접 고치기…</option>
        <option value="processing">확인 완료로</option>
        <option value="done">답변 완료로</option>
        <option value="pending">접수로 되돌리기</option>
      </Select>
      {msg ? <span className="text-[11px] text-ink-500">{msg}</span> : null}
    </span>
  );
}

const PROJECT_OPTIONS: ProjectStatus[] = ["brief", "building", "review", "live"];

/**
 * 프로젝트 상태. 직접 고르기보다 일에 따라 바뀐다: 만들면 "제작 중" → 담당자가 "제작 완료" 를 누르면 "제작 완료".
 * 완료 뒤 새 수정 요청이 오면 "수정 반영 중" 이 되고, 요청을 모두 답하면 저절로 "제작 완료" 로 돌아온다.
 * 예외일 때만 "직접 고치기" 콤보를 연다.
 */
export function ProjectStatusControl({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const st = PROJECT_STATUS[status];
  const run = (next: ProjectStatus) =>
    start(async () => {
      const r = await updateProjectStatusAction(projectId, next);
      setMsg(r?.error ?? null);
      setEditing(false);
      router.refresh();
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge tone={st.tone}>{st.label}</Badge>
      {status === "building" || status === "brief" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (window.confirm("사이트 제작을 마쳤나요? 사용자에게 '제작 완료' 알림이 갑니다.")) run("live");
          }}
        >
          {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <CheckIcon className="size-3.5" />} 제작 완료
        </Button>
      ) : null}
      {status === "review" ? <span className="text-xs text-ink-500">수정 요청을 모두 답하면 저절로 &lsquo;제작 완료&rsquo; 로 돌아가요</span> : null}
      {editing ? (
        <Select
          defaultValue={status}
          disabled={pending}
          className="h-8 w-auto py-0 text-xs"
          aria-label="프로젝트 상태 직접 고치기"
          onChange={(e) => run(e.target.value as ProjectStatus)}
        >
          {PROJECT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {PROJECT_STATUS[v].label}
            </option>
          ))}
        </Select>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-500 underline hover:text-ink-900">
          직접 고치기
        </button>
      )}
      {msg ? <span className="text-xs text-mark">{msg}</span> : null}
    </span>
  );
}
