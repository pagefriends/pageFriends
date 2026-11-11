import { DatabaseIcon } from "lucide-react";

import { describeCollection, type Collection } from "@/lib/collections";
import type { CollectionCounts } from "@/lib/site-data";

/** 관리자 "제작 정보" 의 관리자 목록 칸: 목록마다 정의 · 글 수 (글은 공용 DB 의 site_records 에 사이트별로 있다) */
export function SiteDataPanel({ collections, counts }: { collections: Collection[]; counts: CollectionCounts }) {
  return (
    <div className="rounded-md border border-ink-200 bg-surface px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <DatabaseIcon className="size-4" /> 관리자 목록
        </span>
        <span className="text-xs text-ink-500">글은 공용 DB(site_records)에 사이트별로 저장돼요</span>
      </div>
      {!counts.available ? <p className="mt-2 text-xs text-mark">0013_site_records.sql 을 먼저 실행해 주세요.</p> : null}
      {collections.length ? (
        <ul className="mt-2 space-y-1 text-xs text-ink-600">
          {collections.map((c) => {
            const n = counts.counts[c.key];
            return (
              <li key={c.key}>
                <span className="font-mono text-ink-900">{c.key}</span> · {describeCollection(c)}
                {n ? (
                  <span className="ml-1 text-ink-500">
                    · 글 {n.total.toLocaleString("ko-KR")}개 (보임 {n.published.toLocaleString("ko-KR")})
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-500">아직 없어요. 사이트 주인이 AI 에게 목록을 요청하면 생겨요.</p>
      )}
    </div>
  );
}
