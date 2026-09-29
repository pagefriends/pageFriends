import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "페이지프렌즈 — AI 웹사이트 제작", template: "%s | 페이지프렌즈" },
  description: "템플릿 또는 프롬프트만으로 3~7일 안에 완성되는 AI 웹사이트 제작 서비스. 캡처 화면에 네모를 그려 수정 요청하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
