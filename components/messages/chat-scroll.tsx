"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * 대화 목록 상자. 처음 열 때 맨 아래(가장 최근 글)로 내리고, 글이 늘 때는 맨 아래 근처를 보고 있을 때만 따라 내려간다
 * (위로 올려 예전 글을 읽는 중이면 자리를 지킨다).
 */
export function ChatScroll({ count, className, children }: { count: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={cn("overflow-y-auto", className)}
    >
      {children}
    </div>
  );
}
