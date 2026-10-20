import type { ButtonStyle, CardStyle, FontClass, HeroLayout } from "@/lib/design-doc";

/**
 * 디자인 유형 (배지). 사이트마다 여러 개를 고르고, 처음 고른 것이 "대표" 다.
 *
 * 태그 하나 = AI 하네스의 "스타일 스킬" 하나. 태그마다
 *   - 축 값: 여백 · 글자 무게 · 모서리 · 색 · 온도 · 말투 (-2 ~ 2)
 *   - 글꼴 계열 · 화면 플래그(다크 · 첫 화면 배치 · 이미지 성격)
 *   - 써야 할 패턴 / 피해야 할 패턴 / 문구 말투 — AI 지시문에 그대로 들어간다
 * 를 가진다. 여러 개를 고르면 mergeStyles() 가 대표 태그에 가중치를 더 줘서 합치고, 서로 반대인 축은 "충돌" 로 알려 준다.
 *
 * 왜 피해야 할 패턴을 구체적으로 적나: Claude 는 "세련되게" 같은 막연한 말보다 피할 패턴 목록을 훨씬 잘 지킨다.
 * 태그를 고치거나 늘릴 때는 이 파일만 바꾸면 위저드 · 템플릿 · 지시서 · 초안이 함께 바뀐다.
 */

export type StyleId =
  | "modern"
  | "minimal"
  | "luxury"
  | "warm"
  | "friendly"
  | "cute"
  | "trust"
  | "vivid"
  | "calm"
  | "natural"
  | "tech"
  | "editorial"
  | "retro"
  | "bold"
  | "classic"
  | "dark"
  | "photo"
  | "illust";

export type StyleGroup = "mood" | "style" | "screen";

export const STYLE_GROUPS: { code: StyleGroup; label: string; desc: string }[] = [
  { code: "mood", label: "분위기", desc: "사이트 전체의 느낌" },
  { code: "style", label: "스타일", desc: "뚜렷한 디자인 방식" },
  { code: "screen", label: "화면", desc: "바탕 · 이미지 쓰는 방식" },
];

export type StyleAxis = "space" | "weight" | "shape" | "color" | "temp" | "formal";

export const STYLE_AXES: Record<StyleAxis, { label: string; neg: string; pos: string; mid: string; accent: string }> = {
  space: { label: "여백", neg: "촘촘하게", pos: "넉넉하게", mid: "보통", accent: "일부 구역의 간격" },
  weight: { label: "제목 무게", neg: "가볍고 가늘게", pos: "굵고 크게", mid: "보통 굵기", accent: "첫 화면 제목 하나" },
  shape: { label: "모서리", neg: "각지게", pos: "둥글게", mid: "살짝 둥글게", accent: "버튼 모양" },
  color: { label: "색", neg: "무채색 + 포인트 1색", pos: "선명한 색", mid: "차분한 포인트 색", accent: "버튼 · 강조색" },
  temp: { label: "색 온도", neg: "차가운 톤", pos: "따뜻한 톤", mid: "중간 톤", accent: "사진 톤" },
  formal: { label: "말투", neg: "편한 해요체", pos: "격식 있는 합니다체", mid: "정중한 해요체", accent: "짧은 문구 몇 개" },
};

export const MAX_STYLES = 4;

export type DesignStyle = {
  id: StyleId;
  label: string;
  group: StyleGroup;
  /** 칩 아래 한 줄 설명 */
  desc: string;
  /** 칩에 보이는 작은 색 3개: 바탕 · 글자 · 포인트 */
  swatch: [string, string, string];
  axes: Partial<Record<StyleAxis, number>>;
  font?: FontClass;
  flags?: { dark?: boolean; hero?: HeroLayout; imagery?: "photo" | "illustration"; button?: ButtonStyle; card?: CardStyle; scale?: number };
  /** 포인트 색 (테마의 accent). 없으면 메인 색을 그대로 쓴다 */
  accent?: string;
  /** 위저드의 "이 유형에 어울리는 메인 색" */
  suggestColors: string[];
  /** 색 방향 — AI 지시문용 */
  palette: string;
  use: string[];
  avoid: string[];
  /** 문구 말투 */
  copy: string;
};

export const STYLES: DesignStyle[] = [
  // ----- 분위기 -----
  {
    id: "modern",
    label: "모던",
    group: "mood",
    desc: "깔끔한 고딕 · 반듯한 격자 · 군더더기 없는 화면",
    swatch: ["#ffffff", "#0f172a", "#2563eb"],
    axes: { space: 1, weight: 1, shape: -1, color: -1, temp: -1 },
    font: "sans",
    flags: { button: "rounded", card: "line" },
    suggestColors: ["#2563eb", "#0f172a", "#0ea5e9"],
    palette: "흰 바탕 + 짙은 글자 + 포인트 색 1개",
    use: ["굵은 고딕 제목(700~800)과 넉넉한 줄 간격", "반듯한 격자에 맞춘 정렬", "무채색 바탕에 포인트 색 1개", "큰 사진 한 장 또는 깔끔한 카드 격자", "짧고 분명한 버튼 문구"],
    avoid: ["그라데이션 배경", "장식용 아이콘 · 이모지 남발", "3가지 이상의 강조색", "진한 테두리와 그림자를 겹친 카드", "기울인 글씨로 강조한 단어"],
    copy: "짧고 분명하게. 한 문장 30자 안팎, 꾸미는 말은 최소로.",
  },
  {
    id: "minimal",
    label: "미니멀",
    group: "mood",
    desc: "꼭 필요한 것만 · 큰 여백 · 얇은 선",
    swatch: ["#ffffff", "#111111", "#a3a3a3"],
    axes: { space: 2, weight: -1, shape: -1, color: -2 },
    font: "sans",
    flags: { hero: "center", button: "square", card: "line" },
    suggestColors: ["#111827", "#374151", "#64748b"],
    palette: "흰색 · 검정 중심, 강조색은 아주 조금",
    use: ["구역마다 메시지 하나", "구역 위아래 여백을 크게", "얇은 구분선과 가는 테두리", "버튼은 한 화면에 하나만 강조", "사진은 크게 한 장, 나머지는 글로"],
    avoid: ["진한 그림자", "색 블록 배경을 여러 개 쓰기", "아이콘 카드 격자", "한 화면에 버튼 3개 이상", "배지 · 스티커 같은 장식"],
    copy: "덜어낸 문장. 형용사를 빼고 사실만.",
  },
  {
    id: "luxury",
    label: "고급스러운",
    group: "mood",
    desc: "명조 제목 · 절제된 색 · 골드 포인트",
    swatch: ["#14110f", "#f5efe6", "#b08d57"],
    axes: { space: 1, weight: -1, shape: -2, color: -1, formal: 2 },
    font: "serif",
    flags: { button: "outline", card: "line" },
    accent: "#b08d57",
    suggestColors: ["#1f2937", "#3f2d20", "#7c5c3b"],
    palette: "블랙 · 딥 네이비 또는 아이보리 바탕에 골드 · 샴페인 포인트",
    use: ["명조(세리프) 제목과 넓은 자간", "어두운 바탕 또는 아이보리 바탕", "골드 · 샴페인 계열 포인트를 아주 조금", "큰 사진과 넉넉한 여백", "각지거나 테두리만 있는 버튼"],
    avoid: ["원색(빨강 · 파랑 · 초록) 강조", "통통하고 귀여운 글꼴", "이모지 · 느낌표", "할인 · 최저가 같은 가격 강조 문구", "둥근 알약 버튼 가득"],
    copy: "격식 있는 합니다체. 짧고 품위 있게, 과장 없이.",
  },
  {
    id: "warm",
    label: "따뜻한",
    group: "mood",
    desc: "크림 · 베이지 톤 · 부드럽고 포근한 느낌",
    swatch: ["#fdf8f1", "#3f2d20", "#d97757"],
    axes: { shape: 1, temp: 2, formal: -1 },
    font: "sans",
    flags: { button: "pill", card: "shadow" },
    accent: "#d97757",
    suggestColors: ["#c2410c", "#b45309", "#9a3412"],
    palette: "크림 · 베이지 바탕에 테라코타 · 브라운 포인트",
    use: ["크림 · 베이지 바탕", "살짝 둥근 모서리와 부드러운 그림자", "사람 · 공간의 온기가 느껴지는 사진", "손으로 건네는 듯한 짧은 인사 문구"],
    avoid: ["차가운 회색 · 파랑 위주", "각진 박스만 반복", "형광색", "공문 같은 딱딱한 말투"],
    copy: "다정한 해요체. 고객에게 말을 거는 듯이.",
  },
  {
    id: "friendly",
    label: "친근한",
    group: "mood",
    desc: "둥근 모서리 · 밝은 색 · 편한 말투",
    swatch: ["#ffffff", "#1e293b", "#22c55e"],
    axes: { shape: 2, color: 1, temp: 1, formal: -2 },
    font: "rounded",
    flags: { button: "pill", card: "shadow" },
    suggestColors: ["#16a34a", "#0ea5e9", "#f59e0b"],
    palette: "밝은 바탕에 산뜻한 포인트 색",
    use: ["둥근 모서리 카드와 알약 버튼", "밝고 산뜻한 포인트 색", "쉬운 말로 된 짧은 안내", "작은 아이콘으로 설명 돕기"],
    avoid: ["어두운 바탕 위주", "어려운 전문 용어", "딱딱한 합니다체만 쓰기", "작고 흐린 글씨"],
    copy: "친근한 해요체. 쉬운 단어, 짧은 문장.",
  },
  {
    id: "cute",
    label: "귀여운",
    group: "mood",
    desc: "파스텔 · 아주 둥근 모양 · 통통한 글꼴",
    swatch: ["#fff7fb", "#4a3f55", "#f9a8d4"],
    axes: { weight: 1, shape: 2, color: 1, temp: 1, formal: -2 },
    font: "rounded",
    flags: { button: "pill", card: "flat" },
    accent: "#f9a8d4",
    suggestColors: ["#ec4899", "#a78bfa", "#fb923c"],
    palette: "파스텔(분홍 · 라벤더 · 민트) 조합",
    use: ["파스텔 색 조합", "아주 둥근 모서리와 알약 버튼", "통통한 둥근 글꼴 제목", "스티커 같은 작은 포인트 장식"],
    avoid: ["어두운 바탕", "가늘고 각진 명조", "무채색만 쓰기", "공문 같은 말투"],
    copy: "밝고 귀여운 해요체. 느낌표는 한 화면에 하나 정도.",
  },
  {
    id: "trust",
    label: "신뢰감",
    group: "mood",
    desc: "네이비 · 정돈된 격자 · 믿음 가는 말투",
    swatch: ["#ffffff", "#0b2545", "#1d4ed8"],
    axes: { space: 1, weight: 1, shape: -1, color: -1, temp: -2, formal: 2 },
    font: "sans",
    flags: { button: "rounded", card: "line" },
    suggestColors: ["#1e3a8a", "#1d4ed8", "#0f766e"],
    palette: "네이비 · 블루 계열, 흰 바탕",
    use: ["네이비 · 블루 계열 색", "정돈된 격자와 반듯한 정렬", "자격 · 인증 · 경력은 고객이 준 실제 내용만", "상담 · 문의로 이어지는 분명한 버튼"],
    avoid: ["지어낸 숫자(고객 수 · 만족도 %)", "과장 표현(최고 · 1위 · 100%)", "화려한 색 여러 개", "장난스러운 글꼴"],
    copy: "정중한 합니다체. 사실 위주, 과장 없이.",
  },
  {
    id: "vivid",
    label: "활기찬",
    group: "mood",
    desc: "선명한 색 · 굵은 제목 · 에너지",
    swatch: ["#ffffff", "#111827", "#f97316"],
    axes: { space: -1, weight: 2, shape: 1, color: 2, temp: 1, formal: -1 },
    font: "sans",
    flags: { button: "pill", card: "flat", scale: 1.1 },
    suggestColors: ["#f97316", "#e11d48", "#7c3aed"],
    palette: "채도 높은 포인트 색 1~2개, 대비 강한 색 블록",
    use: ["채도 높은 포인트 색 1~2개", "굵고 큰 제목", "색 블록으로 구역 나누기", "움직임이 느껴지는 사진"],
    avoid: ["회색 위주의 차분한 화면", "작고 가는 제목", "텅 빈 넓은 여백", "길게 늘어지는 문장"],
    copy: "힘 있는 짧은 문장. 버튼은 동사로 시작.",
  },
  {
    id: "calm",
    label: "차분한",
    group: "mood",
    desc: "낮은 채도 · 느린 리듬 · 편안한 여백",
    swatch: ["#f6f7f5", "#2f3a35", "#7c9a92"],
    axes: { space: 2, weight: -1, shape: 1, color: -2, temp: -1, formal: 1 },
    font: "sans",
    flags: { button: "rounded", card: "flat" },
    accent: "#7c9a92",
    suggestColors: ["#4d7c6f", "#64748b", "#6b7f99"],
    palette: "세이지 · 스톤 · 뮤트 블루 같은 낮은 채도",
    use: ["낮은 채도 색(세이지 · 스톤 · 뮤트 블루)", "넉넉한 여백과 느린 리듬", "부드러운 사진", "한 구역에 한 가지 이야기"],
    avoid: ["형광 · 원색", "빽빽한 카드 격자", "굵은 대문자 같은 강한 강조", "느낌표"],
    copy: "잔잔하고 부드러운 문장.",
  },
  {
    id: "natural",
    label: "내추럴",
    group: "mood",
    desc: "그린 · 우드톤 · 자연스러운 질감",
    swatch: ["#f7f5ef", "#2f3b2f", "#6b8f4e"],
    axes: { space: 1, weight: -1, shape: 2, temp: 1, formal: -1 },
    font: "sans",
    flags: { button: "pill", card: "flat" },
    accent: "#6b8f4e",
    suggestColors: ["#4d7c0f", "#65743a", "#7c5c3b"],
    palette: "올리브 · 세이지 그린, 베이지 · 우드톤",
    use: ["그린 · 베이지 · 우드톤", "자연광 사진과 식물 · 소재의 질감", "유기적인 둥근 형태", "여유 있는 배치"],
    avoid: ["네온 · 형광", "금속 · 유리 효과", "차가운 회색 위주", "기하학 패턴 남발"],
    copy: "자연스럽고 담백한 해요체.",
  },

  // ----- 스타일 -----
  {
    id: "tech",
    label: "테크",
    group: "style",
    desc: "기하학 고딕 · 격자 카드 · 선명한 포인트",
    swatch: ["#0b1020", "#e2e8f0", "#22d3ee"],
    axes: { weight: 1, shape: -1, color: 1, temp: -2 },
    font: "sans",
    flags: { button: "rounded", card: "flat" },
    accent: "#22d3ee",
    suggestColors: ["#6366f1", "#06b6d4", "#8b5cf6"],
    palette: "어두운 바탕(또는 흰 바탕)에 시안 · 보라 포인트",
    use: ["기하학적인 고딕 글꼴", "격자형(벤토) 카드 배치", "어두운 바탕에 선명한 포인트 색", "제품 · 화면 이미지 강조"],
    avoid: ["손글씨 · 빈티지 장식", "베이지 · 크림 바탕", "사람 실사 사진 위주", "무지개 그라데이션"],
    copy: "명료한 문장. 기능과 이점을 짧게.",
  },
  {
    id: "editorial",
    label: "에디토리얼",
    group: "style",
    desc: "잡지처럼 큰 명조 제목 · 비대칭 배치",
    swatch: ["#faf9f6", "#111111", "#c2410c"],
    axes: { space: 1, weight: 1, shape: -2, color: -1, formal: 1 },
    font: "serif",
    flags: { hero: "split", button: "square", card: "line", scale: 1.15 },
    suggestColors: ["#111827", "#9a3412", "#1e3a8a"],
    palette: "흰 · 오프화이트 바탕, 검정 글자, 포인트 1색",
    use: ["아주 큰 명조 제목", "비대칭 배치와 큰 사진 + 짧은 캡션", "가는 구분선", "글 중심의 여유 있는 단락"],
    avoid: ["둥근 알약 버튼 가득", "아이콘 카드 격자", "그림자 진한 카드", "귀여운 장식"],
    copy: "잡지 기사처럼 단정한 문장. 제목은 짧고 인상적으로.",
  },
  {
    id: "retro",
    label: "레트로",
    group: "style",
    desc: "빈티지 색 · 굵은 디스플레이 글꼴 · 테두리 박스",
    swatch: ["#f4ecd8", "#2b2118", "#d97706"],
    axes: { space: -1, weight: 2, color: 1, temp: 2, formal: -1 },
    font: "display",
    flags: { button: "square", card: "line" },
    accent: "#d97706",
    suggestColors: ["#b45309", "#b91c1c", "#0f766e"],
    palette: "머스터드 · 벽돌 · 틸 같은 빈티지 색, 크림 바탕",
    use: ["굵은 디스플레이 글꼴 제목", "빈티지 색 조합(머스터드 · 벽돌 · 틸)", "두꺼운 테두리 박스와 도장 같은 배지", "필름 느낌 사진"],
    avoid: ["유리 효과 · 네온", "얇고 가는 고딕만 쓰기", "차가운 회색 · 파랑 위주", "매끈한 그라데이션"],
    copy: "정감 있는 말투. 짧은 구호 같은 제목.",
  },
  {
    id: "bold",
    label: "대담한",
    group: "style",
    desc: "아주 큰 제목 · 강한 대비 · 큰 색면",
    swatch: ["#111111", "#ffffff", "#facc15"],
    axes: { space: -1, weight: 2, shape: -1, color: 2, formal: -1 },
    font: "display",
    flags: { hero: "center", button: "square", card: "flat", scale: 1.25 },
    suggestColors: ["#dc2626", "#111827", "#7c3aed"],
    palette: "검정 · 흰색 + 강렬한 포인트 1색의 큰 색면",
    use: ["화면을 가득 채우는 큰 제목", "검정 · 흰색과 강렬한 포인트 색의 큰 색면", "강한 대비", "짧고 힘 있는 문구"],
    avoid: ["작고 연한 글씨", "파스텔", "작은 카드 여러 개", "긴 설명 문단"],
    copy: "짧고 단호하게. 한 줄 구호.",
  },
  {
    id: "classic",
    label: "클래식",
    group: "style",
    desc: "명조 · 대칭 · 절제된 장식",
    swatch: ["#fbf9f4", "#1f2a37", "#7f1d1d"],
    axes: { space: 1, shape: -1, color: -1, temp: 1, formal: 2 },
    font: "serif",
    flags: { hero: "center", button: "outline", card: "line" },
    suggestColors: ["#1e3a8a", "#7f1d1d", "#14532d"],
    palette: "아이보리 바탕, 짙은 남색 · 와인 · 딥그린",
    use: ["명조 제목과 가운데 정렬", "대칭 구성", "얇은 테두리 · 구분선", "전통적인 색(남색 · 와인 · 딥그린)"],
    avoid: ["유행하는 그라데이션 · 유리 효과", "과하게 둥근 모양", "형광색", "인터넷 유행어"],
    copy: "격식 있는 합니다체.",
  },

  // ----- 화면 -----
  {
    id: "dark",
    label: "다크",
    group: "screen",
    desc: "어두운 바탕에 밝은 글자",
    swatch: ["#0b0f19", "#f8fafc", "#38bdf8"],
    axes: {},
    flags: { dark: true },
    suggestColors: ["#38bdf8", "#a78bfa", "#f59e0b"],
    palette: "검정 · 차콜 바탕, 밝은 글자, 밝고 선명한 포인트 1색",
    use: ["검정 · 차콜 바탕과 밝은 글자", "포인트 색은 밝고 선명하게", "글자와 바탕 대비를 충분히(4.5:1 이상)"],
    avoid: ["흰 바탕 구역을 여러 번 끼워 넣기", "어두운 회색 글씨(대비 부족)", "새까만 바탕 위 새하얀 큰 면"],
    copy: "고른 다른 유형의 말투를 따른다.",
  },
  {
    id: "photo",
    label: "사진 중심",
    group: "screen",
    desc: "큰 사진 배너 · 사진으로 말하기",
    swatch: ["#1f2937", "#ffffff", "#f59e0b"],
    axes: {},
    flags: { hero: "wide", imagery: "photo" },
    suggestColors: ["#111827", "#b45309", "#0f766e"],
    palette: "사진이 주인공, 색은 사진을 방해하지 않게",
    use: ["첫 화면에 화면 폭을 가득 채우는 큰 사진", "큰 사진 격자", "글은 짧게, 사진 설명은 캡션으로"],
    avoid: ["사진 대신 아이콘 · 일러스트", "작은 썸네일만 나열", "사진 위에 긴 글"],
    copy: "짧은 캡션 같은 문장.",
  },
  {
    id: "illust",
    label: "일러스트",
    group: "screen",
    desc: "사진 대신 그림 · 아이콘으로 설명",
    swatch: ["#ffffff", "#1e293b", "#a78bfa"],
    axes: { shape: 1 },
    flags: { imagery: "illustration" },
    suggestColors: ["#7c3aed", "#0ea5e9", "#f97316"],
    palette: "일러스트와 어울리는 밝은 색 2~3개",
    use: ["꾸밈용 이미지 자리는 일러스트 · 아이콘으로", "선 굵기와 색이 일관된 그림", "여백 있는 배치"],
    avoid: ["사람 실사 사진을 AI 로 만들기", "스타일이 제각각인 그림 섞기"],
    copy: "쉽고 친절하게.",
  },
];

export const STYLE_BY_ID: Record<StyleId, DesignStyle> = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<StyleId, DesignStyle>;

export function isStyleId(v: unknown): v is StyleId {
  return typeof v === "string" && v in STYLE_BY_ID;
}

/** 예전 위저드의 "디자인 톤" 글자 → 새 태그. 예전 사이트도 같은 규칙으로 디자인을 만든다 */
const LEGACY_TONE: Record<string, StyleId> = {
  깔끔한: "modern",
  "신뢰감 있는": "trust",
  따뜻한: "warm",
  고급스러운: "luxury",
  활기찬: "vivid",
  미니멀: "minimal",
  전문적인: "trust",
  친근한: "friendly",
};

/** 저장된 값(새 태그 id 또는 예전 톤 글자)을 순서를 지키며 태그로 바꾼다. 모르는 값 · 중복은 버린다 */
export function normalizeStyles(values: readonly unknown[] | null | undefined): StyleId[] {
  const out: StyleId[] = [];
  for (const v of values ?? []) {
    const id = isStyleId(v) ? v : typeof v === "string" ? LEGACY_TONE[v.trim()] : undefined;
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_STYLES) break;
  }
  return out;
}

export function styleLabels(ids: readonly StyleId[]): string[] {
  return ids.map((id) => STYLE_BY_ID[id].label);
}

// ---------------------------------------------------------------------------------------------
// 여러 태그 합치기
// ---------------------------------------------------------------------------------------------

export type StyleConflict = { a: StyleId; b: StyleId; axis: StyleAxis; text: string };

export type StyleMerge = {
  ids: StyleId[];
  primary: StyleId | null;
  /** 축마다 가중 평균 (-2 ~ 2). 대표 태그는 가중치 2 */
  axes: Record<StyleAxis, number>;
  font: FontClass;
  dark: boolean;
  hero: HeroLayout;
  imagery: "photo" | "illustration" | "mixed";
  button: ButtonStyle;
  card: CardStyle;
  scale: number;
  conflicts: StyleConflict[];
  /** "AI가 이렇게 적용해요" — 화면과 지시서에 그대로 보인다 */
  summary: string[];
  use: string[];
  avoid: string[];
};

const AXIS_KEYS = Object.keys(STYLE_AXES) as StyleAxis[];

function josaIGa(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}이(가)`;
  return (last - 0xac00) % 28 ? `${word}이` : `${word}가`;
}

function josaEulReul(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return `${word}을(를)`;
  return (last - 0xac00) % 28 ? `${word}을` : `${word}를`;
}

/** 축 값 → 화면에 보이는 말 */
function axisWord(axis: StyleAxis, v: number): string {
  const a = STYLE_AXES[axis];
  if (v >= 0.5) return a.pos;
  if (v <= -0.5) return a.neg;
  return a.mid;
}

const FONT_WORD: Record<FontClass, string> = { sans: "고딕(산세리프)", serif: "명조(세리프)", rounded: "둥근 고딕", display: "굵은 디스플레이 글꼴" };
const HERO_WORD: Record<HeroLayout, string> = { split: "글과 사진을 나란히", center: "가운데 정렬 제목 + 아래 사진", wide: "제목 아래 화면 폭 가득한 사진" };

/**
 * 고른 순서대로 합친다. 첫 태그(대표)는 가중치 2, 나머지는 1.
 * 같은 축에서 부호가 반대이고 차이가 3 이상이면 충돌 — 대표(또는 먼저 고른 쪽)를 따르고, 다른 쪽은 그 축의 "포인트" 에만 쓴다.
 */
export function mergeStyles(values: readonly unknown[] | null | undefined): StyleMerge {
  const ids = normalizeStyles(values);
  const list = ids.map((id) => STYLE_BY_ID[id]);
  const weight = (i: number) => (i === 0 ? 2 : 1);

  // 대표 태그가 말하지 않은 축은 "보통(0)" 으로 센다 — 두 번째 태그 혼자 그 축을 정하지 않게 (예: 미니멀 + 활기찬 → 크림 바탕이 되지 않게)
  const axes = {} as Record<StyleAxis, number>;
  for (const axis of AXIS_KEYS) {
    let sum = 0;
    let w = 0;
    list.forEach((s, i) => {
      const v = s.axes[axis] ?? (i === 0 ? 0 : undefined);
      if (v === undefined) return;
      sum += v * weight(i);
      w += weight(i);
    });
    axes[axis] = w ? Math.round((sum / w) * 100) / 100 : 0;
  }

  // 글꼴 · 배치 · 버튼 · 카드: 대표 → 그다음 태그 순으로 처음 정해진 값
  const first = <T,>(pick: (s: DesignStyle) => T | undefined, fallback: T): T => {
    for (const s of list) {
      const v = pick(s);
      if (v !== undefined) return v;
    }
    return fallback;
  };
  const font = first((s) => s.font, axes.formal >= 1.5 ? "serif" : "sans");
  const hero = first((s) => s.flags?.hero, "split" as HeroLayout);
  const imagery = first((s) => s.flags?.imagery, "mixed" as const);
  const button = first((s) => s.flags?.button, axes.shape >= 1 ? "pill" : axes.shape <= -1 ? "square" : "rounded");
  const card = first((s) => s.flags?.card, "line" as CardStyle);
  const scale = first((s) => s.flags?.scale, 1);
  const dark = list.some((s) => s.flags?.dark);

  const conflicts: StyleConflict[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      for (const axis of AXIS_KEYS) {
        const a = list[i].axes[axis];
        const b = list[j].axes[axis];
        if (a === undefined || b === undefined || Math.sign(a) === Math.sign(b) || Math.abs(a - b) < 3) continue;
        const lead = list[i];
        const other = list[j];
        const leadName = i === 0 ? `대표인 ${lead.label}` : `먼저 고른 ${lead.label}`;
        conflicts.push({
          a: lead.id,
          b: other.id,
          axis,
          text: `${lead.label} ↔ ${other.label}: ${josaIGa(STYLE_AXES[axis].label)} 서로 반대예요. ${josaEulReul(leadName)} 따르고, ${other.label} 느낌은 ${STYLE_AXES[axis].accent}에만 살려요.`,
        });
      }
    }
  }

  // 축별로 누가 그 방향을 만들었는지 함께 적는다 (예: 여백 넉넉하게 — 미니멀 · 고급스러운)
  const summary: string[] = [];
  if (list.length) {
    for (const axis of AXIS_KEYS) {
      const v = axes[axis];
      if (Math.abs(v) < 0.5) continue;
      const by = list.filter((s) => (s.axes[axis] ?? 0) * v > 0).map((s) => s.label);
      summary.push(`${STYLE_AXES[axis].label}: ${axisWord(axis, v)}${by.length ? ` — ${by.join(" · ")}` : ""}`);
    }
    summary.push(`제목 글꼴: ${FONT_WORD[font]}`);
    summary.push(`첫 화면: ${HERO_WORD[hero]}`);
    if (dark) summary.push("바탕: 어둡게 (다크)");
    if (imagery === "photo") summary.push("이미지: 사진을 크게");
    if (imagery === "illustration") summary.push("이미지: 꾸밈 자리는 일러스트로 (실제 사진 자리는 그대로)");
  }

  // 다크를 고르면 "어두운 바탕을 피한다" 는 태그와 부딪힌다 — 축이 없어 위에서 못 잡으므로 따로 알린다
  if (dark) {
    for (const s of list) {
      if (s.flags?.dark || !s.avoid.some((a) => /어두운 바탕/.test(a))) continue;
      const darkFirst = list.findIndex((x) => x.flags?.dark) < list.indexOf(s);
      conflicts.push({
        a: darkFirst ? "dark" : s.id,
        b: darkFirst ? s.id : "dark",
        axis: "color",
        text: darkFirst
          ? `다크 ↔ ${s.label}: ${s.label} 느낌은 보통 밝은 바탕이에요. 어두운 바탕을 따르고, ${s.label} 느낌은 포인트 색 · 모서리에만 살려요.`
          : `${s.label} ↔ 다크: 먼저 고른 ${s.label} 느낌이 밝은 바탕이라 어두운 바탕과 부딪혀요. 어두운 바탕은 그대로 두고, ${s.label} 느낌은 포인트 색 · 모서리에만 살려요.`,
      });
    }
  }

  // 대표가 정한 것(어두운 바탕 · 알약 버튼 · 크림 바탕 · 명조)을 다른 태그의 "피할 것" 이 막지 않게 걸러 낸다.
  // 대표 태그 자신의 목록은 그대로 둔다 — 그 태그다움이 거기 있다.
  // 단, "다크" 는 화면을 정하는 명시적인 선택이라 대표 태그의 "어두운 바탕 피하기" 도 걸러 낸다.
  const explicit: RegExp[] = dark ? [/어두운 바탕/] : [];
  const decided: RegExp[] = [
    ...explicit,
    ...(button === "pill" ? [/알약/] : []),
    ...(axes.temp >= 0.75 ? [/베이지|크림/] : []),
    ...(font === "serif" ? [/명조/] : []),
    ...(axes.shape >= 1 ? [/둥근/] : []),
    ...(axes.color >= 1 ? [/원색|형광/] : []),
  ];
  const uniq = (xs: string[]) => [...new Set(xs)];
  const avoid = uniq(list.flatMap((s, i) => s.avoid.filter((a) => !(i === 0 ? explicit : decided).some((re) => re.test(a)))));
  return {
    ids,
    primary: ids[0] ?? null,
    axes,
    font,
    dark,
    hero,
    imagery,
    button,
    card,
    scale,
    conflicts,
    summary,
    use: uniq(list.flatMap((s) => s.use)),
    avoid,
  };
}
