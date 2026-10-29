import { z } from "zod";

import { FIELD_TYPES, LIST_LAYOUTS } from "@/lib/collections";
import { BUTTON_STYLES, CARD_STYLES, DENSITIES, FONT_CLASSES, HERO_LAYOUTS, RADII, SATURATIONS, TEMPERATURES, THEME_KEYS } from "@/lib/design-doc";

/**
 * AI 가 돌려주는 형식 (구조화 출력). Claude 는 이 형식대로만 답하고, 코드는 받은 값을 다시 검사한 뒤 반영한다
 * (lib/design-doc.ts applyChanges · sanitizeTheme). 구조화 출력은 최소 · 최대 같은 제약을 지원하지 않으므로
 * 값 범위는 열거형으로만 묶고 길이 · 개수는 코드가 자른다. 해당 없는 칸은 null 대신 빈 글자 · 빈 목록으로 받는다.
 */

const enumOf = <T extends string>(list: readonly T[]) => z.enum(list as [T, ...T[]]);

export const BuildOutput = z.object({
  theme: z.object({
    accent: z.string().describe("포인트 색 #rrggbb"),
    mode: z.enum(["light", "dark"]),
    temperature: enumOf(TEMPERATURES),
    saturation: enumOf(SATURATIONS),
    headingFont: enumOf(FONT_CLASSES),
    bodyFont: z.enum(["sans", "serif", "rounded"]),
    headingWeight: z.number().int().describe("500 · 600 · 700 · 800 · 900 중 하나"),
    headingScale: z.number().describe("0.9 ~ 1.3"),
    radius: enumOf(RADII),
    buttonStyle: enumOf(BUTTON_STYLES),
    density: enumOf(DENSITIES),
    heroLayout: enumOf(HERO_LAYOUTS),
    cardStyle: enumOf(CARD_STYLES),
  }),
  siteCopy: z.array(z.object({ key: z.string(), value: z.string() })).describe("사이트 공통 문구 자리"),
  pageCopy: z.array(z.object({ path: z.string(), key: z.string(), value: z.string() })).describe("페이지별 문구 자리"),
  appliedTags: z.array(z.object({ tag: z.string(), how: z.string() })).describe("고른 디자인 유형마다 어떻게 적용했는지 한 문장"),
  notes: z.string().describe("디자인 설명 3~5문장 (고객과 담당자가 읽는다)"),
});
export type BuildOutput = z.infer<typeof BuildOutput>;

export const EditOutput = z.object({
  decision: z.enum(["apply", "ask", "expert"]).describe("apply 바로 반영 · ask 고객에게 질문 · expert 담당자에게 넘김"),
  summary: z.string().describe("고객에게 보일 한두 문장: 무엇을 바꿨는지(apply) 또는 왜 질문 · 담당자인지"),
  question: z.string().describe("ask 일 때 고객에게 물을 질문. 아니면 빈 글자"),
  expertNote: z.string().describe("expert 일 때 담당자가 할 일. 아니면 빈 글자"),
  themeChanges: z.array(z.object({ key: enumOf(THEME_KEYS), value: z.string() })),
  copyChanges: z.array(z.object({ scope: z.enum(["site", "page"]), path: z.string(), key: z.string(), value: z.string() })),
  collectionChanges: z
    .array(
      z.object({
        key: z.string().describe("목록 키 = 표 이름. 영어 소문자 · 숫자 · 밑줄 (예: notices, menu_items)"),
        label: z.string().describe("관리자 페이지에 보일 한국어 이름 (예: 공지사항)"),
        page: z.string().describe("이 목록을 보여 줄 페이지 주소. 관리자 페이지에만 두려면 빈 글자"),
        layout: enumOf(LIST_LAYOUTS).describe("list 게시판처럼 한 줄씩 · cards 사진 카드"),
        remove: z.boolean().describe("목록을 사이트 · 관리자 페이지에서 숨길 때만 true (저장된 글은 지워지지 않는다)"),
        fields: z
          .array(z.object({ key: z.string().describe("칸 키. 영어 소문자 · 숫자 · 밑줄"), label: z.string().describe("칸 이름 (한국어)"), type: enumOf(FIELD_TYPES) }))
          .describe("칸 전체 목록. 첫 칸이 목록의 제목으로 보인다"),
      }),
    )
    .describe("관리자 목록을 만들거나 바꿀 때만. 아니면 빈 목록"),
});
export type EditOutput = z.infer<typeof EditOutput>;

/** 오류 확인 (bug). 앞쪽 decision · summary 는 답을 쓰는 동안 먼저 보여 준다 */
export const BugOutput = z.object({
  decision: z.enum(["revert", "fix", "person"]).describe("revert 최근 AI 변경 되돌리기 · fix 테마 · 문구로 바로 고치기 · person 담당자에게"),
  summary: z.string().describe("고객에게 보일 한두 문장: 무엇이 문제였고 어떻게 했는지, 또는 왜 담당자가 보는지"),
  cause: z.enum(["ai_change", "display", "content", "feature", "not_bug", "unknown"]).describe("원인: 최근 AI 변경 · 화면 표시 · 문구 · 기능 · 오류 아님 · 모름"),
  revertRuns: z.array(z.number().int()).describe("되돌릴 <최근_AI_변경> 번호. revert 가 아니면 빈 목록"),
  themeChanges: z.array(z.object({ key: enumOf(THEME_KEYS), value: z.string() })).describe("fix 일 때 고칠 테마 값. 아니면 빈 목록"),
  copyChanges: z.array(z.object({ scope: z.enum(["site", "page"]), path: z.string(), key: z.string(), value: z.string() })).describe("fix 일 때 고칠 문구. 아니면 빈 목록"),
  personNote: z.string().describe("person 일 때 담당자가 볼 곳과 할 일. 아니면 빈 글자"),
});
export type BugOutput = z.infer<typeof BugOutput>;
