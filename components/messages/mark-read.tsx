"use client";

import { useEffect } from "react";

import { COUNTS_EVENT } from "@/lib/use-live-counts";

/**
 * 화면에 보여준 상대편 글을 읽음으로 표시한다. 서버가 그릴 때가 아니라 브라우저에 실제로 떠서 보이는 순간에만 실행한다
 * (미리 불러오기나 뒤에 열어 둔 탭 때문에 안 본 글이 읽음 처리되지 않게). ids 는 이번에 그린 안 읽은 글만 넘긴다.
 */
export function MarkRead({ ids, mark }: { ids: string[]; mark: (ids: string[]) => Promise<void> }) {
  const key = ids.join(",");

  useEffect(() => {
    if (!key) return;
    let done = false;
    const run = () => {
      if (done || document.visibilityState !== "visible") return;
      done = true;
      mark(key.split(","))
        .then(() => window.dispatchEvent(new Event(COUNTS_EVENT)))
        .catch(() => {
          /* 실패하면 다음에 열 때 다시 표시된다 */
        });
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
    // mark 는 서버 액션이라 다시 그릴 때마다 새 참조가 온다. 같은 글을 또 보내지 않도록 ids 만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
