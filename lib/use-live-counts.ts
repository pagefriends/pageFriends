"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** 읽음 처리처럼 숫자가 바뀔 일이 생기면 이 이벤트를 쏜다. 배지가 바로 다시 센다. */
export const COUNTS_EVENT = "pf:counts";

/**
 * 상단 바의 알림 숫자. 레이아웃은 페이지를 옮겨 다녀도 다시 그려지지 않으므로 숫자만 따로 받아 온다:
 * 페이지를 옮길 때 · 탭으로 돌아올 때 · 보고 있는 동안 일정 간격으로.
 */
export function useLiveCounts<T extends Record<string, number>>(url: string, initial: T, seconds = 45): T {
  const [counts, setCounts] = useState(initial);
  // 글을 보내거나 화면이 새로 받아질 때 서버가 레이아웃을 다시 그려 새 숫자를 주면 바로 쓴다 (다음 차례를 기다리지 않는다)
  const fromServer = JSON.stringify(initial);
  const [seen, setSeen] = useState(fromServer);
  if (seen !== fromServer) {
    setSeen(fromServer);
    setCounts(initial);
  }
  const pathname = usePathname();
  // 처음 뜰 때는 서버가 방금 준 initial 이 최신이다. 다시 받지 않는다.
  const first = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as T;
        if (alive) setCounts(data);
      } catch {
        /* 네트워크가 끊겼으면 다음 차례에 다시 받는다 */
      }
    };
    if (first.current) first.current = false;
    else load();
    const timer = window.setInterval(load, seconds * 1000);
    window.addEventListener("focus", load);
    window.addEventListener(COUNTS_EVENT, load);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener(COUNTS_EVENT, load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [url, seconds, pathname]);

  return counts;
}
