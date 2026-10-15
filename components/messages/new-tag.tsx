"use client";

import { useState } from "react";

/**
 * "새 글" 표시. 화면에 뜨는 순간 읽음 처리가 되므로, 처음 값을 붙잡아 두어 이번 방문 동안은 계속 보이게 한다
 * (읽음 처리 뒤 화면이 다시 그려져도 사라지지 않는다).
 */
export function NewTag({ unread, label = "새 글" }: { unread: boolean; label?: string }) {
  const [show] = useState(unread);
  if (!show) return null;
  return <span className="rounded-sm bg-sky-400 px-1 text-[10px] leading-4 font-semibold whitespace-nowrap text-night-950">{label}</span>;
}
