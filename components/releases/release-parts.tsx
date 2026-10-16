import { CheckIcon } from "lucide-react";

import { RegionThumb } from "@/components/messages/region-thumb";
import { Badge } from "@/components/ui/card";
import { DEVICE_LABEL, REQUEST_KIND_LABEL } from "@/config/plans";
import { REQUEST_KIND_TONE } from "@/config/requests";
import { userStep } from "@/config/releases";
import type { ChangeRequestRow, ProjectPageRow, ReleaseRow } from "@/lib/types/db";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * 사용자 화면의 웹사이트 적용 단계: 1 적용 요청 → 2 점검 중(확인용 서버) → 3 적용 완료.
 * 담당자가 개발 서버에서 문제를 찾아 다시 고치는 동안에도 사용자에게는 "점검 중" 으로 보인다.
 */
export function UserReleaseSteps({ release }: { release: ReleaseRow }) {
  const now = userStep(release);
  const steps = [
    { n: 1, label: "적용 요청", detail: "요청을 받았어요", at: release.requested_at },
    { n: 2, label: "점검 중", detail: "확인용 서버에 먼저 올려 점검해요", at: release.staging_at },
    { n: 3, label: "적용 완료", detail: "실제 웹사이트에 올라가요", at: release.live_at },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {steps.map((s) => {
        const done = s.n < now || (s.n === 3 && now === 3);
        const current = s.n === now && !done;
        return (
          <li
            key={s.n}
            className={cn(
              "rounded-md border px-3 py-2.5",
              done ? "border-ink-900 bg-ink-900 text-ink-50" : current ? "border-sky-400 bg-sky-50" : "border-ink-200 text-ink-400",
            )}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <span className={cn("grid size-5 place-items-center rounded-full text-[11px]", done ? "bg-sky-400 text-night-950" : current ? "bg-sky-400 text-night-950" : "bg-ink-100 text-ink-500")}>
                {done ? <CheckIcon className="size-3" /> : s.n}
              </span>
              {s.label}
              {current ? <span className="ml-auto text-[11px] font-medium text-sky-600">지금</span> : null}
            </p>
            <p className={cn("mt-1 text-xs", done ? "text-ink-50/75" : current ? "text-ink-700" : "")}>{s.detail}</p>
            {s.at && (done || current) ? <p className={cn("mt-0.5 text-[11px] tabular-nums", done ? "text-ink-50/60" : "text-ink-500")}>{formatDateTime(s.at)}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** 적용에 실리는(실린) 수정 목록. 네모 미리보기 · 번호 · 페이지 · 화면 · 종류 · 요청 글 */
export function ReleaseItemList({ items, pages, empty }: { items: ChangeRequestRow[]; pages: Pick<ProjectPageRow, "id" | "name" | "screenshots">[]; empty?: string }) {
  if (items.length === 0) return empty ? <p className="text-sm text-ink-500">{empty}</p> : null;
  const pageOf = new Map(pages.map((p) => [p.id, p]));
  return (
    <ul className="divide-y divide-ink-100 rounded-md border border-ink-200">
      {items.map((r) => {
        const page = pageOf.get(r.page_id);
        const shot = page?.screenshots[r.device];
        return (
          <li key={r.id} className="flex gap-3 px-3 py-2.5">
            <span className="grid size-6 shrink-0 place-items-center bg-mark text-[11px] font-semibold text-white">{r.seq}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span className="font-medium text-ink-900">{page?.name ?? "페이지"}</span>
                <span>{DEVICE_LABEL[r.device]}</span>
                <Badge tone={REQUEST_KIND_TONE[r.kind]}>{REQUEST_KIND_LABEL[r.kind]}</Badge>
                {r.resolved_at ? <span>끝난 시각 {formatDateTime(r.resolved_at)}</span> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm break-words">{r.message}</p>
            </div>
            {shot ? (
              <div className="hidden sm:block">
                <RegionThumb shot={shot} region={r.region} width={96} height={64} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
