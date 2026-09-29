import Link from "next/link";

import { Logo } from "@/components/site/logo";
import { buttonClass } from "@/components/ui/button";

/** 없는 주소·남의 프로젝트 등. Next 기본 영문 404 대신 브랜드 톤으로. */
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-night-950 px-6 py-20 text-center text-white">
      <Logo light />
      <p className="eyebrow mt-10 text-sky-400">404</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-4 max-w-md text-white/60">주소가 잘못되었거나, 삭제되었거나, 내 계정에서 볼 수 없는 페이지입니다.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className={buttonClass("primary", "md")}>
          내 사이트로
        </Link>
        <Link href="/" className={buttonClass("outlineLight", "md")}>
          홈으로
        </Link>
      </div>
    </div>
  );
}
