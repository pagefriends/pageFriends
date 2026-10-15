"use client";

import { useEffect } from "react";

/**
 * 주소의 #id 가 가리키는 항목에 data-focus 를 붙이고 그리로 스크롤한다.
 * CSS :target 은 앱 안에서 링크로 넘어올 때(주소만 바뀔 때) 적용되지 않아 직접 표시한다.
 */
export function HashFocus() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("[data-focus]").forEach((el) => el.removeAttribute("data-focus"));
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      el.setAttribute("data-focus", "");
      el.scrollIntoView({ block: "start" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return null;
}
