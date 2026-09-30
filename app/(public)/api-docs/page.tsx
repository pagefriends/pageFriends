import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/card";
import { SUPPORT } from "@/content/site";

export const metadata: Metadata = { title: "API 문서" };

/** 공개 API 는 아직 없다. 계획 중인 엔드포인트만 안내한다. */
const ENDPOINTS = [
  { method: "GET", path: "/api/v1/projects", desc: "내 사이트(프로젝트) 목록과 제작 상태" },
  { method: "POST", path: "/api/v1/projects/{id}/requests", desc: "수정 요청 보내기 (페이지 · 디바이스 · 영역 · 종류 · 내용)" },
  { method: "GET", path: "/api/v1/usage", desc: "이번 결제 기간의 AI 토큰 · 전문가 요청 사용량과 크레딧 잔액" },
];

export default function ApiDocsPage() {
  return (
    <section className="bg-white text-ink-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow text-brand-600">개발자</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">API 문서</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
          페이지프렌즈 API 는 사이트 목록 조회, 수정 요청 전송, 사용량 확인을 외부 도구에서 할 수 있게 하는 것을 목표로 합니다. 에이전시처럼 여러 고객사 사이트를 관리하거나, 자체 관리 화면에 페이지프렌즈를 붙이고 싶을 때 쓰게 될 것입니다.
        </p>

        <Alert tone="blue" className="mt-6">
          <span className="font-semibold">준비 중입니다.</span> 공개 API 와 API 키 발급은 아직 제공하지 않습니다. 아래 엔드포인트는 계획이며 출시 시 바뀔 수 있습니다. 먼저 써 보고 싶다면{" "}
          <a href={`mailto:${SUPPORT.email}`} className="font-semibold underline">
            {SUPPORT.email}
          </a>
          로 알려 주세요.
        </Alert>

        <h2 className="mt-12 text-lg font-bold">계획 중인 엔드포인트</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-night-950 p-5 text-[13px] leading-relaxed text-white">
          <pre className="font-mono">
            <code>
              {`# Base URL (예정)
https://api.pagefriends.kr

# 인증 (예정)
Authorization: Bearer <API_KEY>

`}
              {ENDPOINTS.map((e) => `${e.method.padEnd(5)} ${e.path}\n      # ${e.desc}\n\n`).join("")}
            </code>
          </pre>
        </div>

        <h2 className="mt-12 text-lg font-bold">지금 할 수 있는 것</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-600">
          <li>
            대시보드와 편집기에서 모든 기능을 사용할 수 있습니다.{" "}
            <Link href="/demo" className="font-semibold text-brand-600 hover:underline">
              편집 화면 체험
            </Link>
          </li>
          <li>
            사용량은 편집기와 결제 페이지에서 실시간으로 확인합니다.{" "}
            <Link href="/help" className="font-semibold text-brand-600 hover:underline">
              도움말 센터
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
