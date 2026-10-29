"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import type { RowActionState } from "@/app/(app)/projects/[id]/admin/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/card";
import { Hint, Input, Label, Textarea } from "@/components/ui/input";
import { COLLECTION_LIMITS, FIELD_TYPE_LABEL, type CollectionField } from "@/lib/collections";

/**
 * 관리자 목록의 글 쓰기 · 고치기 폼. 칸 종류마다 맞는 입력칸을 그린다 (값 검사는 서버의 coerceRow 가 다시 한다).
 * 새 글을 저장하면 폼을 비우고, 고치던 글을 저장하면 목록으로 돌아간다.
 */
export function RowForm({
  action,
  fields,
  initial,
  published = true,
  sort = 0,
  editing = false,
  doneHref,
}: {
  action: (prev: RowActionState, formData: FormData) => Promise<RowActionState>;
  fields: CollectionField[];
  /** 고칠 글의 지금 값 (칸 키 → 글 · 예/아니오) */
  initial?: Record<string, string | boolean>;
  published?: boolean;
  sort?: number;
  editing?: boolean;
  /** 고치기를 끝내거나 취소하면 갈 곳 */
  doneHref: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (!state?.saved) return;
    if (editing) router.push(doneHref);
    else formRef.current?.reset();
  }, [state, editing, doneHref, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {fields.map((f, i) => {
        const id = `f_${f.key}`;
        const value = initial?.[f.key];
        if (f.type === "boolean") {
          return (
            <label key={f.key} className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" name={f.key} defaultChecked={value === true} className="size-4 accent-brand-600" />
              {f.label}
            </label>
          );
        }
        const common = { id, name: f.key, defaultValue: typeof value === "string" ? value : "", required: i === 0 };
        return (
          <div key={f.key}>
            <Label htmlFor={id} required={i === 0}>
              {f.label} <span className="font-normal text-ink-400">· {FIELD_TYPE_LABEL[f.type]}</span>
            </Label>
            {f.type === "longtext" ? (
              <Textarea {...common} rows={5} maxLength={COLLECTION_LIMITS.longtext} />
            ) : (
              <Input
                {...common}
                type={f.type === "date" ? "date" : f.type === "url" || f.type === "image" ? "url" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                inputMode={f.type === "number" ? "decimal" : undefined}
                placeholder={f.type === "url" || f.type === "image" ? "https://" : undefined}
                maxLength={f.type === "text" ? COLLECTION_LIMITS.text : f.type === "url" || f.type === "image" ? COLLECTION_LIMITS.url : undefined}
              />
            )}
            {f.type === "image" ? <Hint>사진이 올라가 있는 인터넷 주소를 넣어 주세요.</Hint> : null}
          </div>
        );
      })}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" name="published" defaultChecked={published} className="size-4 accent-brand-600" />
          사이트에 보이기
        </label>
        <div className="w-28">
          <Label htmlFor="f_sort">순서</Label>
          <Input id="f_sort" name="sort" type="number" defaultValue={sort} className="h-9" />
        </div>
        <Hint className="mt-0 pb-2">순서 숫자가 작을수록 위에 보여요. 같으면 최근 글이 위로.</Hint>
      </div>
      {state?.error ? <Alert tone="red">{state.error}</Alert> : null}
      {state?.saved && !editing ? <Alert tone="blue">저장했어요. 사이트 목록에 바로 보여요.</Alert> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="dark" disabled={pending}>
          {pending ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
          {editing ? "고친 내용 저장" : "글 올리기"}
        </Button>
        {editing ? (
          <Link href={doneHref} className={buttonClass("ghost")}>
            취소
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/** 글 지우기 (확인 후). 지운 글은 되돌릴 수 없다 */
export function DeleteRowButton({ remove }: { remove: () => Promise<{ error?: string }> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("이 글을 지울까요? 지운 글은 되돌릴 수 없어요.")) return;
          start(async () => {
            const r = await remove();
            setError(r.error ?? null);
          });
        }}
        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-mark disabled:opacity-50"
      >
        {pending ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />} 지우기
      </button>
      {error ? <span className="text-xs text-mark">{error}</span> : null}
    </span>
  );
}
