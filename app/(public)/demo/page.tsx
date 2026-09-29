import type { Metadata } from "next";

import { ProjectEditor } from "@/components/editor/editor";
import type { EditorPage } from "@/components/editor/types";
import { PLAN_BY_CODE } from "@/config/plans";
import samples from "@/config/samples.json";
import type { Screenshot } from "@/lib/types/db";

export const metadata: Metadata = { title: "편집 화면 체험" };

const S = samples as Record<string, Screenshot>;
const pick = (key: string): EditorPage["screenshots"] => ({ mobile: S[`${key}:mobile`], tablet: S[`${key}:tablet`], desktop: S[`${key}:desktop`] });

/** 로그인 없이 편집 화면(드래그·줌·네모 그리기·요청 작성)을 체험하는 페이지. 제출은 되지 않는다. */
const DEMO_PAGES: EditorPage[] = [
  { id: "demo-home", name: "홈", path: "/", screenshots: pick("home") },
  { id: "demo-about", name: "안내", path: "/about", screenshots: pick("about") },
  { id: "demo-reviews", name: "리뷰", path: "/reviews", screenshots: pick("reviews") },
  { id: "demo-products", name: "상품", path: "/products", screenshots: pick("products") },
  { id: "demo-admin", name: "관리자페이지", path: "/admin", screenshots: pick("admin") },
];

/** 체험용 고정 사용량. 렌더 중 Date.now 를 부르면 안 되므로 모듈 로드 시 한 번만 계산한다. */
const DEMO_USED_TOKENS = 123_400;
const DEMO_PERIOD_END = new Date(Date.now() + 20 * 86_400_000).toISOString();

export default function DemoPage() {
  const plan = PLAN_BY_CODE.business;
  const monthly = plan.monthlyAiTokens ?? 0;
  const usedTokens = DEMO_USED_TOKENS;
  return (
    <div className="theme-dark flex flex-1 flex-col">
      <ProjectEditor
        projectId="demo"
        projectName="카페 데일리 (체험)"
        pages={DEMO_PAGES}
        allowedDevices={plan.devices}
        existing={[
          { id: "e1", seq: 1, region: { x: 0.066, y: 0.05, w: 0.36, h: 0.06 }, status: "processing", kind: "ai", message: "", page_id: "demo-home", device: "desktop" },
        ]}
        quota={{
          ai: { monthly, used: usedTokens, remaining: monthly - usedTokens, credits: 0, periodEnd: DEMO_PERIOD_END },
          expert: { weekly: plan.weeklyExpert, used: 0, remaining: plan.weeklyExpert, credits: 0 },
        }}
        hasPlan
        demo
      />
    </div>
  );
}
