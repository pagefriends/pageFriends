"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { updateRequestAction, type AdminActionState } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Hint, Input, Label, Select, Textarea } from "@/components/ui/input";
import type { RequestKind } from "@/config/plans";
import { isOpenStatus, requestStatus } from "@/config/requests";
import type { RequestStatus } from "@/lib/types/db";

const STATUS_OPTIONS: { value: RequestStatus; hint: string }[] = [
  { value: "pending", hint: "아직 열어 보지 않음" },
  { value: "processing", hint: "담당자가 확인함 · 질문하고 답을 기다리는 중" },
  { value: "done", hint: "답변·반영을 마침" },
  { value: "rejected", hint: "이유를 글로 적어 주세요. 전문가 주간 한도에서 제외됨" },
];

/** 자주 쓰는 문장. 누르면 입력칸에 들어가고, 고쳐서 보낼 수 있다. */
const QUICK_REPLIES = ["반영했습니다. 확인 부탁드립니다.", "작업을 시작했습니다.", "어떻게 바꾸면 좋을지 조금 더 알려 주시겠어요?", "사람이 직접 해야 하는 작업입니다. 전문가 요청으로 다시 보내 주세요."];

/**
 * 사용자에게 답하기 + 상태. 상태는 저절로 정해진다: 글을 보내면 "답변 완료", 사용자의 답이 필요하다고 체크하면(질문) "확인 완료",
 * 글 없이 저장하면 그대로. 예외일 때만(반영 불가 · 되돌리기) 콤보에서 직접 고른다 — 고르면 그 값이 자동보다 우선한다.
 * 저장하면 글과 상태 변경이 요청 대화에 쌓이고 사용자에게 알림으로 보인다.
 * "확인 필요" 를 켜면 사용자의 답을 기다리는 요청으로 표시된다 (사용자가 답글을 달면 자동으로 풀린다).
 * AI 반영이면 실제 사용 토큰도 함께 기록한다 (오류 신고·전문가 요청은 토큰 없음).
 *
 * 입력값은 모두 여기서 직접 들고 있고, <form action> 이 아니라 onSubmit 으로 보낸다. <form action> 은 저장이 끝날 때마다
 * 브라우저 폼을 초깃값으로 되돌리는데, 그러면 화면의 상태 선택·체크가 실제 값과 어긋나고(저장한 상태가 예전 값으로 보임)
 * 그 어긋난 값이 다음 저장에 그대로 실린다. 저장이 거절돼도(질문 없이 확인 필요만 켠 경우 등) 쓰던 글이 남는 것도 같은 이유다.
 */
export function RequestForm({
  requestId,
  status,
  awaiting,
  kind,
  tokensUsed,
  messaging,
}: {
  requestId: string;
  status: RequestStatus;
  awaiting: boolean;
  kind: RequestKind;
  tokensUsed: number;
  /** false 면 0006 적용 전 DB: 대화 없이 예전처럼 답변 한 줄만 저장된다 */
  messaging: boolean;
}) {
  const tokenText = (n: number) => (n > 0 ? String(n) : "");
  const [note, setNote] = useState("");
  const [current, setCurrent] = useState(status);
  const [waiting, setWaiting] = useState(awaiting);
  const [tokens, setTokens] = useState(tokenText(tokensUsed));
  // 콤보에서 상태를 직접 골랐는지. 고르지 않았으면 하려는 일에 맞춰 저절로 정해진다
  const [manual, setManual] = useState(false);
  // 화면을 열어 둔 사이 서버 값이 바뀌면(사용자가 답글을 달아 확인 필요가 풀림, 다른 관리자가 상태를 바꿈) 그 값으로 맞춘다.
  // 그대로 두면 오래된 체크 상태로 저장해 방금 풀린 "확인 필요" 를 다시 켜 버린다.
  const [server, setServer] = useState({ status, awaiting, tokensUsed });
  if (server.status !== status || server.awaiting !== awaiting || server.tokensUsed !== tokensUsed) {
    setServer({ status, awaiting, tokensUsed });
    setCurrent(status);
    setManual(false);
    setWaiting(awaiting);
    setTokens(tokenText(tokensUsed));
  }
  const [state, setState] = useState<AdminActionState>(null);
  const [pending, start] = useTransition();
  // 직접 고른 상태가 있으면 그것, 아니면 하려는 일에 맞는 상태
  const auto: RequestStatus = note.trim() ? (waiting ? "processing" : "done") : server.status;
  const effective = manual ? current : auto;
  const open = isOpenStatus(effective);
  // 자동일 때는 "사용자 답 필요" 를 켜면 상태가 확인 완료로 바뀌므로 언제든 켤 수 있다
  const canAwait = manual ? open : true;

  const submit = () => {
    if (pending) return;
    start(async () => {
      const data = new FormData();
      data.set("requestId", requestId);
      data.set("status", effective);
      data.set("note", note);
      if (waiting && open) data.set("awaiting", "on");
      if (kind === "ai") data.set("tokensUsed", tokens);
      const res = await updateRequestAction(null, data);
      setState(res);
      if (res?.ok) {
        setNote("");
        setManual(false);
      }
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {kind === "ai" ? (
        <div>
          <Label htmlFor="tokensUsed">사용 토큰 (AI 반영)</Label>
          <Input id="tokensUsed" name="tokensUsed" type="number" min={0} step={1} inputMode="numeric" value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="예: 8200" />
          <Hint>처리에 쓴 입력+출력 토큰. 비워 두면 바꾸지 않습니다. 플랜 월 한도를 넘는 만큼 사용자의 토큰 크레딧에서 차감됩니다.</Hint>
        </div>
      ) : null}
      <div>
        <Label htmlFor="status">상태 {manual ? <span className="font-normal text-mark">· 직접 고름</span> : <span className="font-normal text-ink-500">· 자동</span>}</Label>
        <Select
          id="status"
          name="status"
          value={effective}
          onChange={(e) => {
            setCurrent(e.target.value as RequestStatus);
            setManual(true);
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {requestStatus(kind, o.value).label} — {o.hint}
            </option>
          ))}
        </Select>
        <Hint>
          {manual ? (
            <>
              직접 고른 상태로 저장됩니다.{" "}
              <button type="button" onClick={() => setManual(false)} className="font-medium text-brand-600 underline">
                자동으로 되돌리기
              </button>
            </>
          ) : (
            "글을 보내면 '답변 완료', 사용자 답이 필요하다고 체크하면 '확인 완료'로 저절로 정해집니다. 예외일 때만 직접 고르세요."
          )}
        </Hint>
      </div>
      <div>
        <Label htmlFor="note">{messaging ? "사용자에게 보낼 글" : "답변 (사용자에게 표시)"}</Label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button key={q} type="button" onClick={() => setNote((n) => (n.trim() ? `${n.trimEnd()}\n${q}` : q))} className="rounded-full border border-ink-200 px-2.5 py-1 text-left text-[11px] text-ink-700 hover:border-ink-400">
              {q}
            </button>
          ))}
        </div>
        <Textarea id="note" name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 제목을 2줄로 줄이고 강조색을 적용했습니다. 확인 부탁드립니다." className="min-h-28" maxLength={2000} />
        <Hint>{messaging ? "비워 두면 상태만 바뀝니다. 글과 상태 변경은 요청 대화에 쌓이고 사용자에게 알림으로 보입니다." : "비워 두면 기존 답변을 그대로 둡니다."}</Hint>
      </div>
      {messaging ? (
        <label className={`flex items-start gap-2.5 text-[13px] leading-relaxed ${canAwait ? "text-ink-700" : "text-ink-400"}`}>
          <input type="checkbox" name="awaiting" checked={waiting && canAwait} disabled={!canAwait} onChange={(e) => setWaiting(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-sky-400" />
          <span>
            사용자의 답이 필요합니다 (질문) <span className="text-ink-500">— 사용자 화면에 &lsquo;확인 필요&rsquo; 로 뜨고, 답글이 오면 자동으로 풀립니다.{canAwait ? "" : " (접수 · 확인 완료일 때만)"}</span>
          </span>
        </label>
      ) : null}
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="blue">{state.message}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
        {!note.trim() ? "저장" : effective === "done" ? "답변 보내기 · 답변 완료" : effective === "rejected" ? "반영 불가로 답변" : waiting ? "질문 보내기" : "보내기"}
      </Button>
    </form>
  );
}
