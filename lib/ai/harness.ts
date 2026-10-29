import "server-only";

import { STYLE_BY_ID, normalizeStyles, type StyleId } from "@/config/design-styles";
import { DEVICE_LABEL, type DeviceKind } from "@/config/plans";
import { templateDesign, type TemplateDesign } from "@/config/template-designs";
import { describeTheme, type DesignDoc } from "@/lib/design-doc";
import { copySlots, regionContext, sectionLabel, type CopySlot } from "@/lib/ai/layout";
import type { SystemBlock } from "@/lib/ai/claude";
import { POLICY_SKILLS, benchmarkSkill, industrySkill, styleSkills, templateSkill, type Skill } from "@/lib/ai/skills";
import type { DraftResult } from "@/lib/draft-render";
import { PAGE_KIND_LABEL, PURPOSES, industryOf, pageFullName } from "@/lib/site-plan";
import type { ProjectBrief, Region } from "@/lib/types/db";

/**
 * AI 하네스 — 스킬을 조립해 시스템 프롬프트와 메시지를 만든다.
 *
 *   system[0] 기본 규칙 + 정책 스킬 + 출력 약속   모든 사이트 · 모든 작업에 같다 → 캐시
 *   system[1] 이 사이트의 스킬: 디자인 유형 · 업종 · 시작 템플릿 · 벤치마킹  같은 사이트의 요청끼리 같다 → 캐시
 *   user      작업마다 다른 것: 고객 자료 · 문구 자리 · 요청 글 · 네모 · 네모별 디자인 유형 / 참고 템플릿
 *
 * 네모별 옵션을 system 이 아니라 user 에 넣는 이유: system 을 사이트마다 같게 두어야 캐시가 맞는다.
 * 고객이 쓴 글(회사 정보 · 요청 글 · 벤치마킹 메모)은 꺾쇠를 지우고 태그로 감싸 "자료" 로만 넘긴다.
 */

const CORE = `당신은 페이지프렌즈의 웹사이트 디자이너 AI 입니다. 한국의 작은 가게 · 회사 홈페이지를 만들고, 고객이 화면에 빨간 네모를 그려 보낸 수정 요청을 처리합니다.

## 당신이 바꿀 수 있는 것
사이트는 "디자인 문서" 로 그려집니다. 당신은 코드나 HTML 을 쓰지 않고 이 문서의 값만 정합니다. 코드가 값을 검사한 뒤 화면을 다시 그립니다.

1) 테마 — 사이트 전체에 적용
- primary: 메인 색 #rrggbb. 고객이 고른 색이다. 수정 요청에서 고객이 색을 바꿔 달라고 할 때만 바꾼다.
- accent: 포인트 색 #rrggbb. 작은 강조에만 쓴다. 메인 색과 어울리게.
- mode: light 밝은 바탕 · dark 어두운 바탕
- temperature: cool 차가운 회색 톤 · neutral 중간 · warm 크림 · 베이지 톤
- saturation: muted 차분 · balanced 보통 · vivid 선명 (첫 화면 바탕 같은 연한 색의 진하기)
- headingFont: sans 고딕 · serif 명조 · rounded 둥근 고딕 · display 굵은 디스플레이 / bodyFont: sans · serif · rounded
- headingWeight: 500 · 600 · 700 · 800 · 900 / headingScale: 제목 크기 배율 0.9 ~ 1.3
- radius: none 각지게 · sm · md · lg · xl 아주 둥글게 (카드 · 사진 · 입력칸 모서리)
- buttonStyle: square 각진 · rounded 살짝 둥근 · pill 알약 · outline 테두리만
- density: compact 촘촘 · normal 보통 · airy 넉넉 (구역 위아래 여백)
- heroLayout: split 글 왼쪽 · 사진 오른쪽 / center 가운데 제목 + 아래 사진 / wide 제목 아래 화면 폭 가득한 사진
- cardStyle: line 얇은 선 · shadow 부드러운 그림자 · flat 연한 색면

2) 문구 자리 — 정해진 키만, 글자 수 한도 안에서
- 메시지의 <문구_자리> 에 키 · 이름 · 한도 · 지금 글이 있다. 목록에 없는 키는 쓸 수 없다.
- 범위 site 는 모든 페이지에 같이 쓰이고, page 는 그 페이지에만 쓰인다.

3) 관리자 목록 — 사이트 주인이 관리자 페이지에서 직접 글을 올리고 고치는 목록 (공지 · 소식 · 메뉴판 · 상품 · 시공 사례 · 행사 일정 · 자주 묻는 질문 같은 것)
- 고객이 "목록으로 보여 주고 관리자 페이지에서 관리하게 해 달라", "공지를 직접 올리고 싶다", "상품을 직접 추가하고 싶다" 처럼 요청하면 collectionChanges 로 목록을 만든다. 목록을 만들면 이 사이트의 데이터 저장소에 표가 생기고 관리자 페이지가 저절로 생긴다.
- key: 표 이름. 영어 소문자 · 숫자 · 밑줄 (예: notices, menu_items, events). label: 관리자 페이지에 보일 한국어 이름.
- fields: 칸 목록. key 는 영어 소문자 · 숫자 · 밑줄, label 은 한국어. type 은 text 짧은 글 · longtext 긴 글 · number 숫자(가격 등) · date 날짜 · boolean 예/아니오 · url 링크 · image 사진 주소 · email 이메일 · phone 전화번호.
  공개 여부 · 순서 · 올린 날 칸은 자동으로 있으니 넣지 않는다 (id · created_at · updated_at · published · sort 는 쓸 수 없는 키). 칸은 꼭 필요한 것만 (보통 2~6개). 첫 칸이 목록의 제목으로 보인다.
- page: 이 목록을 보여 줄 페이지 주소 (보통 네모가 있는 페이지). 페이지 하나에 목록 하나. layout: list 게시판처럼 한 줄씩 · cards 사진 카드.
- 이미 있는 목록을 바꿀 때는 같은 key 로 page · layout · 칸 전체를 다시 보낸다. 칸을 빼면 화면 · 관리자 페이지에서 숨겨질 뿐 저장된 글은 지워지지 않는다. 이미 있는 칸을 숫자 · 날짜 · 예/아니오와 글 사이에서 바꿀 수는 없다 (글 칸끼리 — text · longtext · url · image · email · phone — 는 바꿀 수 있다). 목록을 숨기려면 remove=true.
- 목록 안의 실제 글(공지 내용 · 상품 이름 · 가격 · 일정)은 당신이 쓰지 않는다 — 사이트 주인이 관리자 페이지에서 올린다.
- <관리자_목록> 에 지금 있는 목록과 이 사이트의 플랜에서 쓸 수 있는지가 있다. 쓸 수 없으면 목록을 만들지 말고 ask 로 "관리자 페이지(목록을 직접 올리고 고치기)는 비즈니스 플랜부터 쓸 수 있어요" 라고 알리고 어떻게 할지 묻는다.

## 할 수 없는 것 (담당자에게 넘긴다)
구역 추가 · 삭제 · 순서 바꾸기(관리자 목록 붙이기는 할 수 있다), 메뉴 · 페이지 바꾸기, 기능(문의 · 예약 폼 항목 · 결제 · 지도 · 회원가입 · 외부 서비스 연결), 사진 · 이미지 · 로고 만들기나 바꾸기, 문구 자리가 아닌 곳의 글(폼 항목 이름 · 후기 내용 · 가격표), 사실 확인이 필요한 내용.

## 작업 1 — 첫 제작 (build)
- 디자인 유형 · 업종 · 템플릿 · 벤치마킹 스킬에 맞게 테마 값을 모두 고른다 (primary 는 고객이 고른 색 그대로).
- 문구 자리를 채운다. 고객 자료로 쓸 수 있는 자리만 채우고, 근거가 없으면 그 키를 빼서 기본 문구를 쓰게 한다.
- appliedTags: 고른 디자인 유형마다 "어떻게 적용했는지" 를 고객이 이해할 수 있는 한 문장으로.
- notes: 디자인 방향을 3~5문장으로 (고객과 담당자가 읽는다).

## 작업 2 — 수정 요청 (edit)
- 네모가 가리킨 곳(<네모>)과 요청 글(<요청_글>)을 보고 decision 을 고른다.
  · apply: 테마 · 문구 자리 · 관리자 목록으로 할 수 있으면 바로 바꾼다. 요청한 것만 바꾸고 관련 없는 곳은 그대로 둔다.
  · ask: 무엇을 원하는지 정말 알 수 없을 때만 한 가지를 짧게 묻는다. 합리적으로 짐작할 수 있으면 묻지 말고 apply.
  · expert: "할 수 없는 것" 이거나 사실 확인이 필요한 요청. expertNote 에 담당자가 할 일을 적는다.
- 테마는 사이트 전체에 적용된다. 고객이 한 부분만 바꾸고 싶어 하는데 테마로만 할 수 있는 일이면(예: 이 버튼만 빨갛게) expert 로 넘긴다.
- 네모에 고객이 고른 디자인 유형 · 참고 템플릿이 붙어 있으면 그 느낌으로 바꾼다.
- summary 는 고객에게 그대로 보인다. 바꾼 것을 쉬운 말로 한두 문장 (예: "첫 화면 제목을 더 짧고 힘 있게 바꿨어요.").

## 작업 3 — 오류 확인 (bug)
고객이 "오류 신고" 로 보낸 네모다. 우리 쪽 실수를 고치는 일이라 고객에게 비용이 들지 않는다. 사람이 필요하면 담당자가 24시간 안에 고친다.
- <최근_AI_변경> 중 이 오류를 만든 변경이 있으면 decision=revert, 그 번호만 revertRuns 에 넣는다 (그 변경의 값만 원래대로 돌아간다). 관련 없는 변경은 넣지 않는다.
- 최근 변경 때문이 아니어도 테마 · 문구 자리로 바로 고칠 수 있는 화면 문제(글자가 안 보임 · 넘침 · 틀린 문구 등)면 decision=fix, 고칠 값만 넣는다.
- 기능이 동작하지 않음(버튼 · 폼 · 링크 · 예약 · 결제) · 사진 · 구조 · 그림이 깨짐처럼 "할 수 없는 것" 이거나 원인을 모르겠으면 decision=person. personNote 에 담당자가 볼 곳과 할 일을 적는다.
- 오류가 아니라 바꾸고 싶은 내용(취향 · 새 요청)이면 cause=not_bug, decision=person. summary 에 "바꾸고 싶은 내용은 AI 반영으로 보내면 바로 바뀐다" 고 알려 준다.
- 확신이 없으면 고치지 말고 person. 오류 확인에서는 고객에게 묻지 않는다.
- summary 는 고객에게 그대로 보인다: 무엇이 문제였고 어떻게 했는지, 또는 왜 담당자가 보는지 쉬운 말(해요체)로 한두 문장.
  처리 기한 · 비용은 쓰지 않는다 (화면이 따로 알려 준다). 숫자 값(1.15 같은)보다 "제목 크기를 원래대로" 처럼 말한다.

## 출력
정해진 JSON 형식으로만 답한다. 해당 없는 칸은 빈 글자 "" 또는 빈 목록 [] 으로 둔다.`;

function coreSystem(): string {
  return [CORE, "", "## 정책 (항상 지킨다)", ...POLICY_SKILLS.map((s) => `### ${s.title}\n${s.body}`)].join("\n");
}

/** 꺾쇠를 지워 태그 밖으로 못 나오게 하고, 길이를 자른다 */
function clean(s: string | null | undefined, max = 600): string {
  return (s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export type HarnessSite = {
  brief: ProjectBrief;
  design: DesignDoc;
  /** 시작 템플릿 (구매 확인을 마친 것) */
  template: { slug: string; name: string } | null;
  /** 사이트 주인의 플랜이 관리자 목록(관리자 페이지)을 쓸 수 있는지 (수정 요청에서만) */
  cms?: boolean;
};

/** 지금 있는 관리자 목록 (수정 요청 지시서) */
function collectionsText(site: HarnessSite): string {
  const list = site.design.collections ?? [];
  const lines = [`<관리자_목록 이_플랜에서_쓸_수_있음="${site.cms ? "예" : "아니오 (비즈니스 플랜부터)"}">`];
  if (!list.length) lines.push("(아직 없음)");
  for (const c of list) {
    lines.push(
      `- key=${c.key} label=${clean(c.label, 40)} page=${c.page ?? "(관리자 페이지에만)"} layout=${c.layout} · 칸: ${c.fields.map((f) => `${f.key} ${clean(f.label, 40)}(${f.type})`).join(", ")}`,
    );
  }
  lines.push("</관리자_목록>");
  return lines.join("\n");
}

/** 이 사이트의 스킬 (system[1]) */
export function siteSkills(site: HarnessSite): Skill[] {
  const b = site.brief;
  const tags = normalizeStyles(b.styleTags?.length ? b.styleTags : b.tone);
  const skills: Skill[] = [...styleSkills(tags, "site")];
  if (b.business) skills.push(industrySkill(b.business.category));
  const tpl = site.template ? templateDesign(site.template.slug) : null;
  if (tpl && site.template) skills.push(templateSkill(tpl, site.template.name, "base"));
  const bm = benchmarkSkill(b.benchmarks ?? []);
  if (bm) skills.push(bm);
  return skills;
}

function skillsText(skills: Skill[]): string {
  return ["# 이 사이트의 스킬", ...skills.map((s) => `## ${s.title}\n${s.body}`)].join("\n\n");
}

/** 고객 자료. 연락처는 있음 / 없음만 (정책: 연락처 · 주소는 문구에 쓰지 않는다) */
function customerData(brief: ProjectBrief): string {
  const b = brief.business;
  const has = (v?: string) => (v?.trim() ? "있음" : "없음");
  const lines = [
    `회사 · 브랜드: ${clean(brief.siteName, 60)}`,
    `업종: ${clean(brief.industry, 60)}${b ? ` (분류: ${industryOf(b.category).label})` : ""}`,
  ];
  if (b) {
    lines.push(`한 줄 소개: ${clean(b.tagline, 120)}`);
    lines.push(`제공하는 ${industryOf(b.category).offeringMenu}:`);
    b.offerings.forEach((o, i) => lines.push(`- [${i}] ${clean(o.name, 40)}${o.description.trim() ? `: ${clean(o.description, 200)}` : " (설명 없음)"}`));
    const strengths = b.strengths.map((s) => s.trim()).filter(Boolean);
    lines.push(strengths.length ? `고객이 우리를 고르는 이유: ${strengths.map((s, i) => `[${i}] ${clean(s, 80)}`).join(" / ")}` : "고객이 우리를 고르는 이유: (없음 — 지어내지 않는다)");
    lines.push(b.about.trim() ? `회사 소개 글: ${clean(b.about, 1000)}` : "회사 소개 글: (없음 — 지어내지 않는다)");
    lines.push(`하고 싶은 일: ${clean(brief.purpose, 300) || b.purposes.map((c) => PURPOSES.find((p) => p.code === c)?.label ?? c).join(", ")}`);
    lines.push(`연락처: 전화 ${has(b.contact.phone)} · 이메일 ${has(b.contact.email)} · 주소 ${has(b.contact.address)} · 운영 시간 ${has(b.contact.hours)}`);
  }
  if (brief.audience.trim()) lines.push(`주요 고객: ${clean(brief.audience, 200)}`);
  lines.push(`메인 색(고객 선택): ${brief.primaryColor}`);
  if (brief.prompt.trim()) lines.push(`고객의 추가 요청: ${clean(brief.prompt, 1500)}`);
  if (brief.site) {
    lines.push("페이지:");
    for (const p of brief.site.pages) lines.push(`- ${p.path} ${clean(pageFullName(p), 60)} (${PAGE_KIND_LABEL[p.kind]})${p.note.trim() ? ` 메모: ${clean(p.note, 200)}` : ""}`);
  }
  return lines.join("\n");
}

function slotsText(slots: CopySlot[], pageName: (path: string) => string): string {
  const site = slots.filter((s) => s.scope === "site");
  const byPage = new Map<string, CopySlot[]>();
  for (const s of slots.filter((x) => x.scope === "page")) byPage.set(s.path, [...(byPage.get(s.path) ?? []), s]);
  const line = (s: CopySlot) => `- ${s.key} · ${s.label} · 최대 ${s.max}자 · 지금: ${s.text ? `"${clean(s.text, 300)}"` : "(비어 있음)"}`;
  const out = ["사이트 공통 (scope site):", ...site.map(line)];
  for (const [path, list] of byPage) out.push(`페이지 ${path} ${pageName(path)} (scope page, path ${path}):`, ...list.map(line));
  return out.join("\n");
}

export type BuiltPrompt = { system: SystemBlock[]; user: string; skills: Skill[] };

/** 첫 제작 (build) 지시서 */
export function buildPrompt(site: HarnessSite): BuiltPrompt {
  const skills = siteSkills(site);
  const names = new Map((site.brief.site?.pages ?? []).map((p) => [p.path, pageFullName(p)]));
  const slots = copySlots(site.brief, site.design);
  const tags = normalizeStyles(site.brief.styleTags?.length ? site.brief.styleTags : site.brief.tone);
  const user = [
    "<고객_자료>",
    customerData(site.brief),
    "</고객_자료>",
    "<지금_테마>",
    describeTheme(site.design.theme).join("\n"),
    "</지금_테마>",
    "<문구_자리>",
    slotsText(slots, (p) => names.get(p) ?? ""),
    "</문구_자리>",
    `작업: build. 이 사이트의 테마를 모두 고르고, 문구 자리를 채우세요. appliedTags 의 tag 에는 ${tags.length ? tags.map((id) => `${id}(${STYLE_BY_ID[id].label})`).join(", ") : "(고른 디자인 유형 없음 — 빈 목록)"} 중 영어 id 를 쓰세요.`,
  ].join("\n");
  return { system: [{ text: coreSystem(), cache: true }, { text: skillsText(skills), cache: true }], user, skills: [...POLICY_SKILLS, ...skills] };
}

export type EditRequest = {
  message: string;
  device: DeviceKind;
  region: Region;
  pagePath: string;
  /** 네모별 디자인 유형 (없으면 사이트 것) */
  styles: StyleId[];
  /** 네모별 참고 템플릿 (구매 확인을 마친 것) */
  template: { design: TemplateDesign; name: string } | null;
  /** 이 요청에서 앞서 AI 가 물은 질문과 고객 답 */
  conversation: { role: "ai" | "user"; body: string }[];
  /**
   * 같은 "요청하기" 로 함께 보낸 다른 AI 반영 네모 (순서대로 하나씩 처리한다). AI 가 다른 네모의 일을 미리 하거나,
   * 앞서 반영한 것과 반대로 바꾸지 않게 알려 준다. 혼자 보낸 요청이면 없다
   */
  batch?: { index: number; total: number; others: BatchPeer[] };
};

/** 함께 보낸 다른 네모. done 이면 그 네모에서 실제로 바꾼 것(summary) */
export type BatchPeer = { order: number; where: string; message: string; state: "done" | "waiting" | "other"; summary?: string };

/** 수정 요청 (edit) 지시서. layout = 요청을 보낸 지금 디자인으로 그린 그 페이지 · 화면 */
export function editPrompt(site: HarnessSite, req: EditRequest, layout: DraftResult): BuiltPrompt & { region: ReturnType<typeof regionContext> } {
  const skills = siteSkills(site);
  const planned = site.brief.site?.pages.find((p) => p.path === req.pagePath);
  const ctx = regionContext(layout, req.region);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slots = copySlots(site.brief, site.design, [req.pagePath]);
  const field = (f: { key: string; text: string }) => `${f.key} "${clean(f.text, 200)}"`;
  const extra: string[] = [];
  if (req.styles.length) extra.push(...styleSkills(req.styles, "request").map((s) => `## ${s.title}\n${s.body}`));
  if (req.template) {
    const t = templateSkill(req.template.design, req.template.name, "reference");
    extra.push(`## ${t.title}\n${t.body}`);
  }
  const user = [
    "<요청_글>",
    clean(req.message, 2000),
    "</요청_글>",
    ...(req.conversation.length ? ["<앞선_대화>", ...req.conversation.map((m) => `${m.role === "ai" ? "AI" : "고객"}: ${clean(m.body, 600)}`), "</앞선_대화>"] : []),
    ...(req.batch && req.batch.others.length
      ? [
          `<함께_보낸_다른_요청 이번_요청="${req.batch.index}/${req.batch.total}번째">`,
          ...req.batch.others.map(
            (o) =>
              `${o.order}번 · ${clean(o.where, 80)} · ${o.state === "done" ? "먼저 반영됨" : o.state === "waiting" ? "이 요청 다음에 처리" : "다른 곳에서 처리"}: "${clean(o.message, 200)}"${o.summary ? ` → ${clean(o.summary, 200)}` : ""}`,
          ),
          "이 요청(<요청_글>)만 처리하세요. 다음에 처리할 요청의 일을 미리 하지 말고, 먼저 반영된 것을 되돌리지 마세요. 먼저 반영된 요청과 같은 곳을 반대로 바꿔야 하면 ask 로 어느 쪽을 원하는지 물으세요.",
          "</함께_보낸_다른_요청>",
        ]
      : []),
    "<네모>",
    `페이지: ${req.pagePath} ${planned ? pageFullName(planned) : ""} · 화면: ${DEVICE_LABEL[req.device]} (${layout.width}px)`,
    `위치: 왼쪽 ${pct(req.region.x)} · 위 ${pct(req.region.y)} · 폭 ${pct(req.region.w)} · 높이 ${pct(req.region.h)} (페이지 높이 ${layout.height}px)`,
    `겹치는 구역: ${ctx.sections.map((s) => sectionLabel(s.id)).join(" · ") || "(없음)"}`,
    ctx.fields.length ? `네모 안 문구 자리: ${ctx.fields.map(field).join(" / ")}` : `네모 안에 문구 자리가 없다. 가까운 문구 자리: ${ctx.nearby.map(field).join(" / ") || "(없음)"}`,
    "</네모>",
    ...(extra.length ? ["<네모에_붙은_옵션>", ...extra, "</네모에_붙은_옵션>"] : []),
    "<지금_테마>",
    describeTheme(site.design.theme).join("\n"),
    `primary=${site.design.theme.primary} accent=${site.design.theme.accent} mode=${site.design.theme.mode} temperature=${site.design.theme.temperature} saturation=${site.design.theme.saturation} headingFont=${site.design.theme.headingFont} bodyFont=${site.design.theme.bodyFont} headingWeight=${site.design.theme.headingWeight} headingScale=${site.design.theme.headingScale} radius=${site.design.theme.radius} buttonStyle=${site.design.theme.buttonStyle} density=${site.design.theme.density} heroLayout=${site.design.theme.heroLayout} cardStyle=${site.design.theme.cardStyle}`,
    "</지금_테마>",
    "<문구_자리>",
    slotsText(slots, () => (planned ? pageFullName(planned) : "")),
    "</문구_자리>",
    collectionsText(site),
    "작업: edit. decision 을 고르고, apply 면 바꿀 값만 themeChanges · copyChanges · collectionChanges 에 넣으세요 (copyChanges 의 path 는 page 범위일 때 위 페이지 주소, site 범위면 빈 글자. 관리자 목록을 만들거나 바꾸지 않으면 collectionChanges 는 빈 목록).",
  ].join("\n");
  return { system: [{ text: coreSystem(), cache: true }, { text: skillsText(skills), cache: true }], user, skills: [...POLICY_SKILLS, ...skills], region: ctx };
}

/** 오류 확인에 넘기는 최근 AI 변경 한 건 (번호는 1부터, 최근 것이 1) */
export type RecentChange = { no: number; at: string; where: string; message: string; changes: string[] };

/** 오류 확인 (bug) 지시서. 시스템은 수정 요청과 같아 캐시를 함께 쓴다 */
export function bugPrompt(
  site: HarnessSite,
  req: { message: string; device: DeviceKind; region: Region; pagePath: string },
  layout: DraftResult,
  recent: RecentChange[],
): BuiltPrompt & { region: ReturnType<typeof regionContext> } {
  const skills = siteSkills(site);
  const planned = site.brief.site?.pages.find((p) => p.path === req.pagePath);
  const ctx = regionContext(layout, req.region);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slots = copySlots(site.brief, site.design, [req.pagePath]);
  const field = (f: { key: string; text: string }) => `${f.key} "${clean(f.text, 200)}"`;
  const user = [
    "<오류_신고>",
    clean(req.message, 2000),
    "</오류_신고>",
    "<네모>",
    `페이지: ${req.pagePath} ${planned ? pageFullName(planned) : ""} · 화면: ${DEVICE_LABEL[req.device]} (${layout.width}px)`,
    `위치: 왼쪽 ${pct(req.region.x)} · 위 ${pct(req.region.y)} · 폭 ${pct(req.region.w)} · 높이 ${pct(req.region.h)} (페이지 높이 ${layout.height}px)`,
    `겹치는 구역: ${ctx.sections.map((s) => sectionLabel(s.id)).join(" · ") || "(없음)"}`,
    ctx.fields.length ? `네모 안 문구 자리: ${ctx.fields.map(field).join(" / ")}` : `네모 안에 문구 자리가 없다. 가까운 문구 자리: ${ctx.nearby.map(field).join(" / ") || "(없음)"}`,
    "</네모>",
    "<최근_AI_변경>",
    ...(recent.length
      ? recent.map((r) => `${r.no}번 · ${r.at} · ${clean(r.where, 80)} · 요청 "${clean(r.message, 160)}" → 바꾼 것: ${r.changes.map((c) => clean(c, 160)).join(" / ") || "(없음)"}`)
      : ["(최근 AI 변경 없음)"]),
    "</최근_AI_변경>",
    "<지금_테마>",
    describeTheme(site.design.theme).join("\n"),
    `primary=${site.design.theme.primary} accent=${site.design.theme.accent} mode=${site.design.theme.mode} temperature=${site.design.theme.temperature} saturation=${site.design.theme.saturation} headingFont=${site.design.theme.headingFont} bodyFont=${site.design.theme.bodyFont} headingWeight=${site.design.theme.headingWeight} headingScale=${site.design.theme.headingScale} radius=${site.design.theme.radius} buttonStyle=${site.design.theme.buttonStyle} density=${site.design.theme.density} heroLayout=${site.design.theme.heroLayout} cardStyle=${site.design.theme.cardStyle}`,
    "</지금_테마>",
    "<문구_자리>",
    slotsText(slots, () => (planned ? pageFullName(planned) : "")),
    "</문구_자리>",
    "작업: bug. 오류 신고를 확인하고 decision 을 고르세요 (revert 면 revertRuns, fix 면 고칠 값만, person 이면 personNote).",
  ].join("\n");
  return { system: [{ text: coreSystem(), cache: true }, { text: skillsText(skills), cache: true }], user, skills: [...POLICY_SKILLS, ...skills], region: ctx };
}

/** 관리자 "AI 작업 지시서" — 실제로 보낼 지시문(첫 제작 기준)과 스킬 목록. API 를 부르지 않는다 */
export function harnessPreview(site: HarnessSite): { skills: Skill[]; system: string; user: string; chars: number; approxTokens: number } {
  const p = buildPrompt(site);
  const system = p.system.map((b) => b.text).join("\n\n");
  const chars = system.length + p.user.length;
  // 한글은 글자당 대략 1~1.5 토큰 — 어림값
  return { skills: p.skills, system, user: p.user, chars, approxTokens: Math.round(chars * 1.2) };
}

/** 고른 태그 이름 (지시서 · 화면) */
export function tagNames(tags: readonly StyleId[]): string {
  return tags.map((id, i) => `${i === 0 ? "★" : ""}${STYLE_BY_ID[id].label}`).join(" · ");
}
