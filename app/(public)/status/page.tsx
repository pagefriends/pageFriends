import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/card";
import { SUPPORT } from "@/content/site";

export const metadata: Metadata = { title: "시스템 상태" };

/** 실시간 상태 연동 전 정적 페이지. 상태 모니터링이 붙으면 이 목록을 API 결과로 바꾼다. */
const COMPONENTS = [
  { name: "웹사이트", desc: "pagefriends.kr 공개 페이지" },
  { name: "대시보드 · 편집기", desc: "로그인, 프로젝트, 수정 요청" },
  { name: "결제 (포트원)", desc: "플랜 결제, 정기 결제, 크레딧 · 템플릿 구매" },
  { name: "AI 처리", desc: "초안 생성, AI 반영 요청" },
  { name: "이메일", desc: "가입 확인, 알림, 문의 답변" },
];

export default function StatusPage() {
  return (
    <section className="bg-white text-ink-900">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="eyebrow text-brand-600">시스템 상태</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">모든 시스템 정상</h1>
        <p className="mt-3 text-sm text-ink-500">현재 알려진 장애가 없습니다.</p>

        <ul className="mt-10 divide-y divide-ink-200 rounded-2xl border border-ink-200">
          {COMPONENTS.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-[15px] font-semibold">{c.name}</p>
                <p className="mt-0.5 text-xs text-ink-500">{c.desc}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink-700">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-sky-400" />
                </span>
                정상
              </span>
            </li>
          ))}
        </ul>

        <Alert tone="gray" className="mt-6">
          실시간 상태 모니터링은 곧 연결됩니다. 지금은 운영팀이 확인한 상태를 수동으로 표시합니다. 이용 중 문제가 있으면{" "}
          <Link href="/live-chat" className="font-semibold text-brand-600 hover:underline">
            실시간 채팅
          </Link>{" "}
          또는{" "}
          <a href={`mailto:${SUPPORT.email}`} className="font-semibold text-brand-600 hover:underline">
            {SUPPORT.email}
          </a>
          로 알려 주세요.
        </Alert>

        <div className="mt-12">
          <h2 className="text-lg font-bold">최근 장애 이력</h2>
          <p className="mt-2 rounded-2xl border border-dashed border-ink-300 bg-ink-50 p-6 text-center text-sm text-ink-500">최근 90일 안에 기록된 장애가 없습니다.</p>
        </div>
      </div>
    </section>
  );
}
