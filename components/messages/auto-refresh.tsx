"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 대화 화면을 최신으로 유지한다: 탭으로 돌아왔을 때와, 보고 있는 동안 일정 간격으로 서버 데이터를 다시 받는다.
 * 입력 중인 글은 클라이언트 상태라 그대로 남는다. 편집기처럼 드래그 중일 수 있는 화면에는 쓰지 않는다.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      // focus 와 visibilitychange 가 같이 오므로 2초 안의 중복은 건너뛴다
      if (document.visibilityState !== "visible" || Date.now() - last < 2000) return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);

  return null;
}
