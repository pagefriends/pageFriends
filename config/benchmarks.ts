import type { BenchmarkPermission } from "@/lib/types/db";

/**
 * 벤치마킹 사이트 — 첫 요청(새 사이트 위저드)에서 받는다.
 *
 * 허락 상태가 AI 에게 넘기는 내용을 정한다 (lib/ai/benchmark.ts · lib/ai/harness.ts 가 코드로 지킨다):
 *   own     우리 회사 사이트 — 글 · 사진 · 구성 모두 다시 써도 된다
 *   granted 운영자에게 허락 받음 — 배치 · 구성 · 분위기를 가깝게 참고. 글 · 사진 · 로고는 쓰지 않는다
 *   none    허락 없음 — 색 느낌 · 글꼴 계열 · 밝기 같은 추상적인 신호만. 그 사이트의 글 · 메뉴 이름 · 제목은 AI 에게 넘기지 않는다
 */

export const MAX_BENCHMARKS = 3;

export const BENCHMARK_ASPECTS: { key: string; label: string }[] = [
  { key: "mood", label: "전체 분위기" },
  { key: "color", label: "색감" },
  { key: "font", label: "글꼴" },
  { key: "layout", label: "배치" },
  { key: "menu", label: "메뉴 구성" },
  { key: "photo", label: "사진 느낌" },
  { key: "feature", label: "기능" },
];

export const BENCHMARK_ASPECT_LABEL: Record<string, string> = Object.fromEntries(BENCHMARK_ASPECTS.map((a) => [a.key, a.label]));

export const BENCHMARK_PERMISSION: Record<BenchmarkPermission, { label: string; short: string; desc: string; tone: "dark" | "blue" | "gray"; rule: string }> = {
  own: {
    label: "우리 회사 사이트예요",
    short: "우리 사이트",
    desc: "지금 쓰는 우리 홈페이지예요. 글 · 사진 · 구성을 다시 써도 돼요.",
    tone: "dark",
    rule: "고객 소유 사이트 — 구성 · 배치 · 글 · 사진을 다시 써도 된다. 더 좋게 다듬는다.",
  },
  granted: {
    label: "운영자에게 허락 받았어요",
    short: "허락 받음",
    desc: "사이트 운영자에게 참고해도 된다는 허락을 받았어요.",
    tone: "blue",
    rule: "운영자 허락을 받은 사이트 — 배치 · 구성 · 분위기를 가깝게 참고해도 된다. 그 사이트의 글 · 사진 · 로고 · 아이콘은 쓰지 않고 이 고객의 것으로 채운다.",
  },
  none: {
    label: "허락은 받지 않았어요 — 분위기만 참고",
    short: "분위기만",
    desc: "허락 없이 그대로 따라 하면 저작권 문제가 생길 수 있어서, 색 느낌 · 글꼴 · 밝기 같은 분위기만 참고해요.",
    tone: "gray",
    rule: "허락 없는 사이트 — 색 느낌 · 글꼴 계열 · 밝기 같은 추상적인 분위기만 참고한다. 특징적인 배치 · 그림 · 문구를 따라 하지 않고, 누가 봐도 다른 사이트로 만든다.",
  },
};

export const BENCHMARK_ATTESTATION = "참고 사이트의 글 · 사진 · 로고 · 코드는 그대로 쓰지 않고, 허락 여부를 사실대로 적었습니다.";
