"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 담당자가 요청 화면을 실제로 열어 보는 순간 "확인 완료" 로 바꾼다 (미리 불러오기 · 뒤에 열어 둔 탭은 제외).
 * 바꾼 뒤 화면을 다시 불러와 상태 배지와 대화의 "담당자가 요청을 확인했습니다" 기록이 보이게 한다.
 */
export function AutoCheck({ requestId, mark }: { requestId: string; mark: (id: string) => Promise<void> }) {
  const router = useRouter();

  useEffect(() => {
    let done = false;
    const run = () => {
      if (done || document.visibilityState !== "visible") return;
      done = true;
      mark(requestId)
        .then(() => router.refresh())
        .catch(() => {
          /* 실패하면 다음에 열 때 다시 시도된다 */
        });
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
    // mark 는 서버 액션이라 다시 그릴 때마다 새 참조가 온다. 같은 요청을 또 보내지 않도록 id 만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return null;
}
