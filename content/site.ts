/**
 * 공개 사이트 콘텐츠 (내비·푸터·솔루션·사례·글 등).
 * 디자인 피클(designpickle.com)의 정보 구조를 그대로 옮기고, 내용만 페이지프렌즈에 맞췄다.
 *
 * 규칙
 * - 사진은 전부 임시(/placeholders). 실제 이미지가 오면 파일만 교체한다.
 * - 고객 후기·사례·글은 `sample: true` 인 샘플 콘텐츠다. 화면에 "샘플" 표시가 붙고, 실제 콘텐츠로 교체해야 한다.
 * - 숫자는 서비스 사실(3~7일, 4개 플랜, 29,000원부터 등)만 쓴다. 고객 수·매출 같은 지어낸 실적 수치는 넣지 않는다.
 */
import placeholders from "@/config/placeholders.json";
import { DELIVERY_DAYS, PLANS, formatKrw } from "@/config/plans";

export type Img = { src: string; width: number; height: number };
const P = placeholders as Record<"wide" | "photo" | "square" | "tall" | "banner" | "avatar" | "logo", Img[]>;
/** 종류별 임시 이미지 n번째 (순환) */
export const ph = (kind: keyof typeof P, i: number): Img => P[kind][(i - 1 + P[kind].length) % P[kind].length];

// ---------------------------------------------------------------------------
// 솔루션(만드는 사이트 종류) — 디자인 피클의 "Solutions & Services" 14개에 대응
// ---------------------------------------------------------------------------
export type Solution = {
  slug: string;
  name: string;
  short: string; // 메가메뉴 한 줄
  eyebrow: string;
  headline: string;
  intro: string;
  tags: string[]; // 히어로 아래 알약 태그 (제공 항목)
  hashtags: string[]; // 홈 "만드는 것" 카드용
  deliverables: string[];
  features: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  recommendedPlan: "starter" | "business" | "pro" | "enterprise";
  image: Img;
};

const COMMON_FEATURES: Solution["features"] = [
  { title: "AI가 초안, 전문가가 마무리", body: "브리프를 넣으면 AI가 첫 완성본을 만들고, 사람 전문가가 구조·문구·디테일을 검수합니다." },
  { title: "네모 그려서 수정 요청", body: "완성 화면 위에 빨간 네모를 그리고 번호별로 적으면 됩니다. AI 반영과 전문가 요청을 네모마다 고릅니다." },
  { title: "3~7일 안에 첫 완성본", body: `필수 정보 입력이 끝나면 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 첫 완성본이 대시보드에 올라옵니다.` },
];

export const SOLUTIONS: Solution[] = [
  {
    slug: "ai-site",
    name: "AI 사이트 제작",
    short: "프롬프트만으로 시작하는 제작",
    eyebrow: "AI 제작",
    headline: "설명만 하면 AI가 사이트를 만듭니다",
    intro: "템플릿 없이 글로만 설명해도 됩니다. AI가 구조·문구·디자인 초안을 만들고, 전문가가 다듬어 며칠 안에 완성본을 올립니다.",
    tags: ["프롬프트 제작", "구조 설계", "문구 작성", "디자인 초안", "전문가 검수", "반응형"],
    hashtags: ["#프롬프트", "#AI초안", "#전문가검수"],
    deliverables: ["사이트 구조 설계", "페이지별 문구", "디자인 초안", "모바일·웹 반응형", "수정 요청 편집기"],
    features: COMMON_FEATURES,
    faq: [
      { q: "디자인 지식이 없어도 되나요?", a: "네. 업종·목적·원하는 느낌만 적으면 됩니다. 나머지는 AI 와 전문가가 채웁니다." },
      { q: "결과물이 마음에 안 들면요?", a: "완성 화면 위에 네모를 그려 고칠 곳을 표시하면 됩니다. 플랜에 포함된 AI 토큰·전문가 요청으로 계속 다듬습니다." },
    ],
    recommendedPlan: "starter",
    image: ph("wide", 1),
  },
  {
    slug: "company",
    name: "회사소개·홈페이지",
    short: "신뢰를 주는 기업·브랜드 사이트",
    eyebrow: "브랜드 & 회사소개",
    headline: "첫인상을 결정하는 회사 홈페이지",
    intro: "회사 소개, 서비스, 연혁, 문의까지. 브랜드 톤에 맞춘 구조와 문구로 방문자가 바로 신뢰하는 홈페이지를 만듭니다.",
    tags: ["회사 소개", "서비스 안내", "연혁", "팀 소개", "문의 폼", "채용"],
    hashtags: ["#회사소개", "#서비스", "#문의"],
    deliverables: ["메인 · 소개 · 서비스 · 문의 페이지", "브랜드 컬러 · 폰트 적용", "지도 · 오시는 길", "문의 폼 연동"],
    features: COMMON_FEATURES,
    faq: [
      { q: "페이지는 몇 개까지 되나요?", a: "스타터 3~5 페이지, 비즈니스 최대 12, 프로 최대 30 페이지입니다." },
      { q: "우리 로고와 색을 쓸 수 있나요?", a: "네. 위저드에서 메인 색상을 고르고, 로고·참고 사이트를 첨부하면 그대로 반영합니다." },
    ],
    recommendedPlan: "starter",
    image: ph("wide", 2),
  },
  {
    slug: "shop",
    name: "쇼핑몰",
    short: "상품·장바구니·결제까지",
    eyebrow: "쇼핑몰",
    headline: "상품 등록부터 결제까지 되는 쇼핑몰",
    intro: "상품 목록, 상세, 장바구니, 결제, 주문 관리. 비즈니스 플랜의 결제 시스템 옵션으로 실제 판매가 가능한 쇼핑몰을 만듭니다.",
    tags: ["상품 목록", "상품 상세", "장바구니", "결제 연동", "주문 관리", "회원"],
    hashtags: ["#상품", "#결제", "#주문관리"],
    deliverables: ["상품·카테고리 페이지", "장바구니 · 결제(토스페이먼츠)", "주문 · 배송 관리자 페이지", "회원가입 · 로그인"],
    features: COMMON_FEATURES,
    faq: [
      { q: "결제는 어떻게 붙나요?", a: `비즈니스 플랜에서 결제 시스템 옵션을 켜면 됩니다. 초기 구축 비용이 포함되어 첫 달 289,000원, 이후 월 ${formatKrw(PLANS[1].priceKrw)}입니다.` },
      { q: "상품은 제가 직접 올릴 수 있나요?", a: "네. 관리자 페이지에서 상품·재고·주문을 직접 관리합니다." },
    ],
    recommendedPlan: "business",
    image: ph("wide", 3),
  },
  {
    slug: "booking",
    name: "예약·문의",
    short: "예약 접수와 문의가 들어오는 사이트",
    eyebrow: "예약 & 문의",
    headline: "예약과 문의가 자동으로 들어오는 사이트",
    intro: "예약 캘린더, 문의 폼, 카카오톡 채널 연결. 전화 대신 사이트에서 예약과 문의를 받습니다.",
    tags: ["예약 캘린더", "문의 폼", "카카오톡 채널", "알림", "관리자 확인"],
    hashtags: ["#예약", "#문의폼", "#카카오채널"],
    deliverables: ["예약 페이지 · 캘린더", "문의 폼 · 알림", "예약 관리자 페이지"],
    features: COMMON_FEATURES,
    faq: [{ q: "예약 알림은 어디로 오나요?", a: "이메일과 관리자 페이지로 옵니다. 카카오톡 채널 연결도 요청할 수 있습니다." }],
    recommendedPlan: "business",
    image: ph("wide", 4),
  },
  {
    slug: "cafe-store",
    name: "카페·매장",
    short: "메뉴·위치·리뷰 중심의 매장 사이트",
    eyebrow: "카페 & 매장",
    headline: "메뉴와 위치를 한눈에, 매장 홈페이지",
    intro: "메뉴판, 매장 위치, 영업시간, 인스타그램 피드, 리뷰. 손님이 찾는 정보만 깔끔하게 담습니다.",
    tags: ["메뉴판", "위치 · 영업시간", "인스타그램", "리뷰", "예약"],
    hashtags: ["#메뉴", "#위치", "#리뷰"],
    deliverables: ["홈 · 메뉴 · 안내 · 리뷰 페이지", "지도 · 영업시간", "SNS 연결"],
    features: COMMON_FEATURES,
    faq: [{ q: "메뉴가 바뀌면요?", a: "AI 반영 요청으로 문구·가격을 바로 바꿀 수 있습니다. 토큰만 씁니다." }],
    recommendedPlan: "starter",
    image: ph("wide", 5),
  },
  {
    slug: "clinic",
    name: "병원·클리닉",
    short: "진료 안내와 예약이 되는 의료 사이트",
    eyebrow: "병원 & 클리닉",
    headline: "진료 안내부터 예약까지, 병원 홈페이지",
    intro: "진료 과목, 의료진 소개, 진료 시간, 오시는 길, 온라인 예약. 환자가 안심하고 찾아오는 구조로 만듭니다.",
    tags: ["진료 안내", "의료진", "진료 시간", "온라인 예약", "오시는 길"],
    hashtags: ["#진료안내", "#의료진", "#예약"],
    deliverables: ["진료 · 의료진 · 안내 페이지", "예약 폼", "지도 · 주차 안내"],
    features: COMMON_FEATURES,
    faq: [{ q: "의료광고 규정은요?", a: "표현·문구는 전문가 검수 단계에서 확인합니다. 최종 게시 책임은 의료기관에 있으니 게시 전 내부 확인을 권합니다." }],
    recommendedPlan: "business",
    image: ph("wide", 6),
  },
  {
    slug: "academy",
    name: "학원·교육",
    short: "커리큘럼·수강신청·공지",
    eyebrow: "학원 & 교육",
    headline: "커리큘럼과 수강 신청이 되는 교육 사이트",
    intro: "과정 소개, 강사진, 시간표, 수강 신청, 공지사항. 학부모와 수강생이 궁금한 것을 바로 찾게 합니다.",
    tags: ["과정 소개", "강사진", "시간표", "수강 신청", "공지"],
    hashtags: ["#커리큘럼", "#수강신청", "#공지"],
    deliverables: ["과정 · 강사 · 시간표 페이지", "수강 신청 폼", "공지 게시판"],
    features: COMMON_FEATURES,
    faq: [{ q: "게시판도 되나요?", a: "비즈니스 플랜부터 공지 · 게시판(CMS)을 넣을 수 있습니다." }],
    recommendedPlan: "business",
    image: ph("wide", 7),
  },
  {
    slug: "portfolio",
    name: "포트폴리오",
    short: "작업물을 돋보이게 하는 개인 사이트",
    eyebrow: "포트폴리오 & 크리에이터",
    headline: "작업물이 주인공인 포트폴리오",
    intro: "디자이너, 사진가, 개발자, 크리에이터. 작업물 갤러리와 소개, 연락처를 군더더기 없이 담습니다.",
    tags: ["갤러리", "프로젝트 상세", "소개", "연락처", "SNS"],
    hashtags: ["#갤러리", "#프로젝트", "#소개"],
    deliverables: ["갤러리 · 프로젝트 상세", "소개 · 이력", "연락 폼"],
    features: COMMON_FEATURES,
    faq: [{ q: "작업물은 몇 개까지?", a: "제한 없습니다. 페이지 수만 플랜 한도를 따릅니다." }],
    recommendedPlan: "starter",
    image: ph("wide", 8),
  },
  {
    slug: "realestate",
    name: "부동산·인테리어",
    short: "매물·시공 사례를 보여주는 사이트",
    eyebrow: "부동산 & 인테리어",
    headline: "매물과 시공 사례가 잘 보이는 사이트",
    intro: "매물 목록, 시공 전후 사진, 상담 신청. 사진이 많은 업종에 맞게 갤러리 중심으로 설계합니다.",
    tags: ["매물 목록", "시공 사례", "전후 비교", "상담 신청", "지도"],
    hashtags: ["#매물", "#시공사례", "#상담"],
    deliverables: ["매물 · 사례 갤러리", "상담 신청 폼", "지도"],
    features: COMMON_FEATURES,
    faq: [{ q: "매물을 직접 올릴 수 있나요?", a: "비즈니스 플랜의 CMS 로 직접 등록 · 수정할 수 있습니다." }],
    recommendedPlan: "business",
    image: ph("wide", 9),
  },
  {
    slug: "beauty",
    name: "뷰티·살롱",
    short: "시술 메뉴와 예약",
    eyebrow: "뷰티 & 살롱",
    headline: "시술 메뉴와 예약이 되는 살롱 사이트",
    intro: "시술 메뉴, 디자이너 소개, 전후 사진, 예약. 인스타그램에서 넘어온 손님이 바로 예약하게 합니다.",
    tags: ["시술 메뉴", "디자이너", "전후 사진", "예약", "인스타그램"],
    hashtags: ["#시술메뉴", "#예약", "#전후사진"],
    deliverables: ["메뉴 · 디자이너 · 갤러리 페이지", "예약 폼", "SNS 연결"],
    features: COMMON_FEATURES,
    faq: [{ q: "네이버 예약과 연결되나요?", a: "네이버 예약 링크 · 카카오톡 채널 버튼을 넣을 수 있습니다." }],
    recommendedPlan: "starter",
    image: ph("wide", 10),
  },
  {
    slug: "restaurant",
    name: "레스토랑·식당",
    short: "메뉴·예약·단체 문의",
    eyebrow: "레스토랑",
    headline: "메뉴와 예약, 단체 문의까지 되는 식당 사이트",
    intro: "코스 메뉴, 사진, 예약, 단체 · 대관 문의, 오시는 길. 분위기가 전해지는 사진 중심 구성입니다.",
    tags: ["메뉴", "예약", "대관 문의", "사진", "오시는 길"],
    hashtags: ["#메뉴", "#예약", "#대관"],
    deliverables: ["메뉴 · 갤러리 · 안내 페이지", "예약 · 문의 폼", "지도"],
    features: COMMON_FEATURES,
    faq: [{ q: "메뉴 사진은 누가 준비하나요?", a: "보내주신 사진을 씁니다. 없으면 임시 이미지로 먼저 만들고 나중에 교체합니다." }],
    recommendedPlan: "starter",
    image: ph("wide", 11),
  },
  {
    slug: "landing",
    name: "랜딩페이지·이벤트",
    short: "한 페이지로 전환을 만드는 캠페인",
    eyebrow: "랜딩 & 이벤트",
    headline: "한 페이지에 집중한 랜딩페이지",
    intro: "광고 · 이벤트 · 사전예약용 한 페이지. 목적 하나에 맞춰 구조와 문구를 짜고, 신청 폼을 붙입니다.",
    tags: ["단일 페이지", "신청 폼", "카운트다운", "광고 연동", "성과 측정"],
    hashtags: ["#랜딩", "#사전예약", "#캠페인"],
    deliverables: ["랜딩 1페이지", "신청 폼 · 알림", "분석 태그 설치"],
    features: COMMON_FEATURES,
    faq: [{ q: "여러 개 만들 수 있나요?", a: "플랜의 사이트 수 한도 안에서 여러 개 만들 수 있습니다. 비즈니스 2개, 프로 5개입니다." }],
    recommendedPlan: "starter",
    image: ph("wide", 12),
  },
  {
    slug: "community",
    name: "커뮤니티·블로그",
    short: "글과 회원이 쌓이는 사이트",
    eyebrow: "커뮤니티 & 블로그",
    headline: "글과 회원이 쌓이는 커뮤니티",
    intro: "게시판, 블로그, 회원가입 · 로그인, 댓글. 콘텐츠가 쌓이는 사이트는 CMS 가 있는 비즈니스 플랜부터 만듭니다.",
    tags: ["게시판", "블로그", "회원", "댓글", "검색"],
    hashtags: ["#게시판", "#회원", "#블로그"],
    deliverables: ["게시판 · 블로그 · 회원 페이지", "관리자 페이지(CMS)", "검색"],
    features: COMMON_FEATURES,
    faq: [{ q: "회원 데이터는 어디에?", a: "사이트 전용 데이터베이스에 저장되고, 관리자 페이지에서 관리합니다." }],
    recommendedPlan: "pro",
    image: ph("wide", 1),
  },
  {
    slug: "app",
    name: "개인 앱",
    short: "모바일 앱까지 (엔터프라이즈)",
    eyebrow: "개인 앱",
    headline: "웹사이트에서 모바일 앱까지",
    intro: "엔터프라이즈 플랜에서는 웹사이트와 함께 iOS · Android 앱까지 제작합니다. 전담 매니저가 처음부터 끝까지 함께합니다.",
    tags: ["iOS · Android", "푸시 알림", "회원", "결제", "전담 매니저"],
    hashtags: ["#모바일앱", "#푸시", "#전담매니저"],
    deliverables: ["웹사이트 + 모바일 앱", "스토어 등록 지원", "전담 매니저"],
    features: COMMON_FEATURES,
    faq: [{ q: "앱은 얼마나 걸리나요?", a: "범위에 따라 다릅니다. 상담에서 일정과 범위를 먼저 정합니다." }],
    recommendedPlan: "enterprise",
    image: ph("wide", 2),
  },
];

export const SOLUTION_BY_SLUG: Record<string, Solution> = Object.fromEntries(SOLUTIONS.map((s) => [s.slug, s]));

/** 업종별 사례 카테고리 (디자인 피클의 B2B / B2C / Agencies) */
export const INDUSTRIES = [
  { key: "small-business", label: "소상공인" },
  { key: "startup", label: "스타트업" },
  { key: "agency", label: "에이전시" },
] as const;
export type IndustryKey = (typeof INDUSTRIES)[number]["key"];

// ---------------------------------------------------------------------------
// 헤더 · 푸터
// ---------------------------------------------------------------------------
export type NavLink = { href: string; label: string; desc?: string; icon?: string };

export const NAV = {
  solutions: { label: "솔루션 & 서비스", items: SOLUTIONS.map((s) => ({ href: `/solutions/${s.slug}`, label: s.name, desc: s.short })) as NavLink[] },
  platform: { href: "/platform", label: "플랫폼" },
  pricing: { href: "/pricing", label: "요금제" },
  resources: {
    label: "리소스",
    featured: [
      { href: "/blog", label: "블로그", desc: "사이트 제작·운영에 도움이 되는 글", image: ph("photo", 1) },
      { href: "/customer-stories", label: "고객 사례", desc: "페이지프렌즈로 만든 사이트들의 이야기", image: ph("photo", 2) },
    ],
    links: [
      { href: "/resources?category=guide", label: "가이드 · 전자책" },
      { href: "/resources?category=webinar", label: "웨비나 · 이벤트" },
      { href: "/our-work", label: "작업 사례" },
    ] as NavLink[],
  },
  why: {
    label: "왜 페이지프렌즈",
    featured: [
      { href: "/about", label: "회사 소개", image: ph("photo", 3) },
      { href: "/our-people", label: "우리 팀", image: ph("photo", 4) },
    ],
    links: [
      { href: "/live-chat", label: "실시간 채팅" },
      { href: "/careers", label: "채용" },
      { href: "/pricing", label: "시작하기" },
    ] as NavLink[],
  },
  signIn: { href: "/login", label: "로그인" },
  cta: { href: "/consultation", label: "상담 신청" },
};

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  { title: "솔루션 & 서비스", links: SOLUTIONS.map((s) => ({ href: `/solutions/${s.slug}`, label: s.name })) },
  {
    title: "플랫폼 & 요금제",
    links: [
      { href: "/platform", label: "플랫폼" },
      { href: "/pricing", label: "요금제" },
      { href: "/templates", label: "템플릿" },
      { href: "/demo", label: "편집 화면 체험" },
    ],
  },
  {
    title: "리소스",
    links: [
      { href: "/blog", label: "블로그" },
      { href: "/customer-stories", label: "고객 사례" },
      { href: "/resources?category=guide", label: "가이드 · 전자책" },
      { href: "/resources?category=webinar", label: "웨비나 · 이벤트" },
      { href: "/our-work", label: "작업 사례" },
    ],
  },
  {
    title: "왜 페이지프렌즈",
    links: [
      { href: "/about", label: "회사 소개" },
      { href: "/our-people", label: "우리 팀" },
      { href: "/careers", label: "채용" },
      { href: "/creative-application", label: "전문가 지원" },
      { href: "/how-it-works", label: "이용 방법" },
      { href: "/comparison", label: "플랜 · 대안 비교" },
    ],
  },
];

export const SUPPORT = {
  email: "help@pagefriends.kr",
  phone: "02-0000-0000",
  hours: "평일 10:00 ~ 18:00",
  links: [
    { href: "/live-chat", label: "실시간 채팅" },
    { href: "/help", label: "도움말 센터" },
    { href: "/status", label: "시스템 상태" },
  ] as NavLink[],
};

export const LEGAL_LINKS: NavLink[] = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/api-docs", label: "API 문서" },
];

// ---------------------------------------------------------------------------
// 홈 · 공통 섹션 데이터
// ---------------------------------------------------------------------------
/** "신뢰합니다" 로고 띠 — 실제 고객 로고로 교체 (임시 로고) */
export const TRUST_LOGOS: Img[] = Array.from({ length: 8 }, (_, i) => ph("logo", i + 1));

/** 서비스 사실 기반 수치 (지어낸 실적 아님) */
export const KEY_NUMBERS = [
  { value: `${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일`, body: "필수 정보 입력 후 첫 완성본까지. 견적·미팅 없이 바로 시작합니다." },
  { value: formatKrw(PLANS[0].priceKrw), body: "가장 작은 플랜의 월 요금. 사이트 1개, 3~5페이지에 AI 토큰이 포함됩니다." },
  { value: "1,000원", body: "완성 디자인 템플릿 1개 가격. 실제 운영 중인 사이트 템플릿은 8,900원." },
  { value: "4개 플랜", body: "소개 사이트부터 쇼핑몰, 개인 앱까지. 규모가 커지면 플랜만 올리면 됩니다." },
];

export const PHOTO_STATS = [
  { value: "24h", label: "AI 반영 요청의 통상 처리 시간", image: ph("photo", 5) },
  { value: "3종", label: "모바일 · 태블릿 · 웹 화면별 수정 요청", image: ph("photo", 6) },
  { value: "무료", label: "우리 쪽 오류는 신고해도 차감 없음", image: ph("photo", 7), accent: true },
];

export const WHY_CARDS = [
  { icon: "shield", title: "품질은 사람과 프로세스가 보장", body: "AI 초안을 전문가가 검수합니다. 구조 · 문구 · 반응형까지 사람이 봅니다." },
  { icon: "zap", title: "빠르게 시작", body: "템플릿 또는 프롬프트로 5분 안에 시작. 견적 · 미팅 없이 바로 제작에 들어갑니다." },
  { icon: "coins", title: "투명한 요금", body: "월 단위 4개 플랜. AI 는 실제 쓴 토큰만큼만 차감되고 한도를 넘으면 크레딧으로." },
  { icon: "clock", title: "믿을 수 있는 속도", body: `첫 완성본 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일, AI 수정은 보통 몇 시간 안에 반영됩니다.` },
  { icon: "headset", title: "사람이 답합니다", body: "요청이 막히면 실시간 채팅과 전문가 요청으로 사람이 직접 풀어드립니다." },
];

export const COMMAND_STEPS = [
  { n: 1, title: "필수 정보 입력", body: "사이트 이름, 업종, 목적, 페이지 구성, 디자인 톤. 템플릿을 고르거나 프롬프트만 적어도 됩니다.", image: ph("wide", 3) },
  { n: 2, title: "제작 진행 확인", body: "대시보드에서 상태를 봅니다. 완성되면 페이지별 · 디바이스별 캡처가 올라옵니다.", image: ph("wide", 4) },
  { n: 3, title: "네모로 수정 요청", body: "캡처 위에 빨간 네모를 그리고 번호별로 적습니다. AI 반영 · 전문가 요청 · 오류 신고를 네모마다 고릅니다.", image: ph("wide", 5) },
  { n: 4, title: "반영 확인, 운영 시작", body: "요청 내역에서 접수 · 처리중 · 반영 완료와 답변을 확인합니다. 답변도 같은 화면에 달립니다.", image: ph("wide", 6) },
];

export type CompareRow = { label: string; body: string; cells: ("yes" | "no" | "partial")[] };
export const COMPARE_COLUMNS = ["플랫폼", "속도", "품질", "지원", "비용"];
export const COMPARE_ROWS: CompareRow[] = [
  { label: "페이지프렌즈", body: "템플릿 · 프롬프트로 시작해 며칠 안에 완성. 수정은 네모로 요청.", cells: ["yes", "yes", "yes", "yes", "yes"] },
  { label: "직접 제작 (노코드)", body: "빠르지만 결과물이 어설프고, 완성까지 손이 많이 갑니다.", cells: ["partial", "partial", "no", "no", "yes"] },
  { label: "프리랜서", body: "사람마다 편차가 크고, 매번 찾고 관리해야 합니다.", cells: ["no", "partial", "partial", "no", "partial"] },
  { label: "에이전시", body: "품질은 좋지만 견적 · 미팅 · 긴 일정과 높은 비용.", cells: ["no", "no", "yes", "partial", "no"] },
];

export type Testimonial = { quote: string; name: string; role: string; metric: string; metricLabel: string; avatar: Img; logo: Img; sample: true; storySlug: string };
/** 샘플 후기 — 실제 고객 후기로 교체 필요 */
export const TESTIMONIALS: Testimonial[] = [
  { quote: "네모 그려서 요청하는 게 이렇게 편할 줄 몰랐어요. 전화로 설명할 필요가 없어졌습니다.", name: "김OO", role: "카페 모닝 대표", metric: "5일", metricLabel: "첫 완성본까지", avatar: ph("avatar", 1), logo: ph("logo", 1), sample: true, storySlug: "cafe-morning" },
  { quote: "결제 시스템까지 한 번에 붙여서 오픈 첫 주에 주문을 받았습니다.", name: "이OO", role: "핸드메이드 샵 운영", metric: "1주", metricLabel: "오픈 후 첫 주문", avatar: ph("avatar", 2), logo: ph("logo", 2), sample: true, storySlug: "handmade-shop" },
  { quote: "문구 수정은 AI 로 바로, 사진 교체는 전문가에게. 나눠서 요청하니 빠르고 정확했어요.", name: "박OO", role: "피부과 실장", metric: "3종", metricLabel: "모바일 · 태블릿 · 웹", avatar: ph("avatar", 3), logo: ph("logo", 3), sample: true, storySlug: "clinic-care" },
  { quote: "에이전시 견적의 1/10 로 시작했고, 규모가 커지면서 플랜만 올렸습니다.", name: "최OO", role: "스타트업 마케팅 리드", metric: "4개", metricLabel: "플랜 중 선택", avatar: ph("avatar", 4), logo: ph("logo", 4), sample: true, storySlug: "startup-landing" },
  { quote: "고객사 사이트를 여러 개 동시에 관리하는데 대시보드 하나로 끝납니다.", name: "정OO", role: "에이전시 대표", metric: "5개", metricLabel: "프로 플랜 사이트", avatar: ph("avatar", 5), logo: ph("logo", 5), sample: true, storySlug: "agency-multi" },
  { quote: "오류 신고는 차감이 없어서 마음 놓고 알려줄 수 있어요.", name: "한OO", role: "학원 원장", metric: "무료", metricLabel: "오류 신고", avatar: ph("avatar", 6), logo: ph("logo", 6), sample: true, storySlug: "academy-plus" },
];

export type Story = {
  slug: string;
  company: string;
  industry: IndustryKey;
  solution: string; // solution slug
  headline: string;
  summary: string;
  metrics: { value: string; label: string }[];
  quote: string;
  quoteBy: string;
  body: string[]; // 문단
  image: Img;
  logo: Img;
  sample: true;
};
/** 샘플 고객 사례 — 실제 사례로 교체 필요 */
export const STORIES: Story[] = [
  { slug: "cafe-morning", company: "카페 모닝", industry: "small-business", solution: "cafe-store", headline: "동네 카페가 전화 대신 사이트로 예약을 받기까지", summary: "메뉴 · 위치 · 예약을 한 페이지에. 스타터 플랜으로 5일 만에 오픈.", metrics: [{ value: "5일", label: "첫 완성본" }, { value: "4", label: "페이지" }, { value: "스타터", label: "플랜" }], quote: "네모 그려서 요청하는 게 이렇게 편할 줄 몰랐어요.", quoteBy: "김OO, 카페 모닝 대표", body: ["카페 모닝은 인스타그램으로만 손님을 받던 동네 카페였습니다. 메뉴와 위치를 물어보는 DM 이 하루 수십 건이었고, 예약은 전화로만 받았습니다.", "템플릿 '카페 데일리' 를 고르고 필수 정보를 입력한 뒤 5일 만에 첫 완성본이 올라왔습니다. 메뉴 문구와 가격은 AI 반영으로 바로 고치고, 매장 사진 교체는 전문가에게 요청했습니다.", "지금은 예약 폼과 카카오톡 채널 버튼으로 문의가 들어옵니다."], image: ph("photo", 1), logo: ph("logo", 1), sample: true },
  { slug: "handmade-shop", company: "핸드메이드 샵", industry: "small-business", solution: "shop", headline: "결제까지 붙인 쇼핑몰을 한 번에", summary: "비즈니스 플랜 + 결제 시스템 옵션으로 상품 등록부터 결제까지.", metrics: [{ value: "1주", label: "오픈 후 첫 주문" }, { value: "12", label: "페이지" }, { value: "비즈니스", label: "플랜" }], quote: "결제 시스템까지 한 번에 붙여서 오픈 첫 주에 주문을 받았습니다.", quoteBy: "이OO, 핸드메이드 샵 운영", body: ["수제 소품을 SNS 로 팔던 운영자는 주문 · 입금 확인을 손으로 하고 있었습니다.", "비즈니스 플랜에서 결제 시스템 옵션을 켜고 상품 · 장바구니 · 결제 · 주문 관리자 페이지까지 한 번에 만들었습니다.", "오픈 첫 주에 사이트에서 첫 주문이 들어왔습니다."], image: ph("photo", 2), logo: ph("logo", 2), sample: true },
  { slug: "clinic-care", company: "케어 피부과", industry: "small-business", solution: "clinic", headline: "진료 안내와 예약을 세 가지 화면에서", summary: "모바일 · 태블릿 · 웹 화면을 각각 확인하고 수정 요청.", metrics: [{ value: "3종", label: "디바이스 화면" }, { value: "8", label: "페이지" }, { value: "비즈니스", label: "플랜" }], quote: "문구 수정은 AI 로 바로, 사진 교체는 전문가에게.", quoteBy: "박OO, 케어 피부과 실장", body: ["진료 과목 · 의료진 · 예약 페이지를 만들고, 태블릿 화면에서 표가 깨지는 것을 네모로 표시해 전문가에게 요청했습니다.", "문구 수정은 AI 반영으로 몇 시간 안에 처리됐습니다."], image: ph("photo", 3), logo: ph("logo", 3), sample: true },
  { slug: "startup-landing", company: "런치 스타트업", industry: "startup", solution: "landing", headline: "사전예약 랜딩페이지를 이틀 만에", summary: "광고 집행 전 랜딩페이지와 신청 폼을 빠르게.", metrics: [{ value: "2일", label: "랜딩 완성" }, { value: "1", label: "페이지" }, { value: "스타터", label: "플랜" }], quote: "에이전시 견적의 1/10 로 시작했습니다.", quoteBy: "최OO, 마케팅 리드", body: ["광고 집행 일정이 정해진 상태에서 랜딩페이지가 필요했습니다.", "프롬프트만으로 시작해 이틀 만에 신청 폼이 붙은 랜딩페이지가 나왔습니다."], image: ph("photo", 4), logo: ph("logo", 4), sample: true },
  { slug: "agency-multi", company: "브릿지 에이전시", industry: "agency", solution: "company", headline: "고객사 사이트 5개를 대시보드 하나로", summary: "프로 플랜으로 여러 고객사 사이트를 동시에 제작 · 운영.", metrics: [{ value: "5개", label: "사이트" }, { value: "주 10회", label: "전문가 요청" }, { value: "프로", label: "플랜" }], quote: "대시보드 하나로 끝납니다.", quoteBy: "정OO, 에이전시 대표", body: ["소규모 에이전시가 고객사별로 외주를 돌리던 구조를 페이지프렌즈로 바꿨습니다.", "프로 플랜의 사이트 5개 슬롯에 고객사 사이트를 넣고, 수정 요청은 고객사가 직접 네모로 보냅니다."], image: ph("photo", 5), logo: ph("logo", 5), sample: true },
  { slug: "academy-plus", company: "플러스 학원", industry: "small-business", solution: "academy", headline: "공지와 수강 신청이 되는 학원 사이트", summary: "게시판(CMS)과 수강 신청 폼을 비즈니스 플랜으로.", metrics: [{ value: "6", label: "페이지" }, { value: "무료", label: "오류 신고" }, { value: "비즈니스", label: "플랜" }], quote: "오류 신고는 차감이 없어서 마음 놓고 알려줄 수 있어요.", quoteBy: "한OO, 학원 원장", body: ["공지사항을 카카오톡으로만 보내던 학원이 게시판과 시간표 페이지를 만들었습니다.", "수강 신청 폼의 오류를 오류 신고로 알렸고, 토큰 차감 없이 고쳐졌습니다."], image: ph("photo", 6), logo: ph("logo", 6), sample: true },
];
export const STORY_BY_SLUG: Record<string, Story> = Object.fromEntries(STORIES.map((s) => [s.slug, s]));

export type Post = { slug: string; category: string; title: string; excerpt: string; date: string; author: string; readMinutes: number; image: Img; body: string[]; sample: true };
export const POST_CATEGORIES = ["제작 팁", "운영", "비교", "AI", "사례"];
/** 샘플 글 — 실제 글로 교체 필요 */
export const POSTS: Post[] = [
  { slug: "brief-that-works", category: "제작 팁", title: "AI 가 잘 만드는 브리프 쓰는 법 5가지", excerpt: "업종, 목적, 고객, 톤, 참고 사이트. 다섯 가지만 제대로 적으면 첫 완성본의 품질이 달라집니다.", date: "2026-09-20", author: "페이지프렌즈 팀", readMinutes: 4, image: ph("wide", 7), body: ["첫 완성본의 품질은 브리프에서 결정됩니다. 위저드가 묻는 항목은 다섯 가지뿐이지만, 각 항목을 어떻게 적느냐에 따라 결과가 크게 달라집니다.", "1. 업종은 구체적으로. '카페' 보다 '디저트 중심의 동네 카페' 가 낫습니다.", "2. 목적은 한 문장으로. 방문자가 무엇을 하길 원하는지 적으세요.", "3. 주요 고객은 나이 · 상황으로. '20~30대 직장인, 점심시간에 방문' 처럼.", "4. 디자인 톤은 최대 3개. 서로 어울리는 것으로 고르세요.", "5. 참고 사이트는 '왜 좋은지' 를 함께 적으세요."], sample: true },
  { slug: "box-request-guide", category: "제작 팁", title: "네모 하나에 요청 하나: 수정 요청이 빨리 반영되는 요령", excerpt: "영역은 좁게, 문장은 짧게, 종류는 정확하게. 편집기를 잘 쓰는 세 가지 원칙.", date: "2026-09-15", author: "페이지프렌즈 팀", readMinutes: 3, image: ph("wide", 8), body: ["편집기의 빨간 네모는 요청 하나를 뜻합니다. 한 네모에 여러 요청을 적으면 처리 순서가 꼬입니다.", "영역은 고칠 곳만 좁게 잡고, 문장은 '무엇을 어떻게' 로 짧게 적으세요.", "문구 · 색 · 간격은 AI 반영, 사진 교체 · 구조 변경은 전문가 요청, 동작 오류는 오류 신고(무료)입니다."], sample: true },
  { slug: "tokens-explained", category: "AI", title: "AI 토큰제는 어떻게 계산되나요?", excerpt: "횟수가 아니라 실제 사용량. 플랜 한도, 크레딧, 초기화 시점을 정리했습니다.", date: "2026-09-10", author: "페이지프렌즈 팀", readMinutes: 5, image: ph("wide", 9), body: ["AI 반영 요청은 '주 N회' 가 아니라 실제 사용한 토큰만큼 차감됩니다.", "플랜마다 월 토큰 한도가 있고, 결제 기간마다 초기화됩니다. 한도를 넘으면 토큰 크레딧에서 차감됩니다.", "요청 1건은 대략 1만 토큰 안팎입니다. 사용량은 편집기와 결제 페이지에서 실시간으로 볼 수 있습니다."], sample: true },
  { slug: "agency-vs-subscription", category: "비교", title: "에이전시 vs 프리랜서 vs 구독형 제작, 무엇이 맞을까", excerpt: "비용 · 속도 · 품질 · 운영을 기준으로 네 가지 선택지를 비교했습니다.", date: "2026-09-05", author: "페이지프렌즈 팀", readMinutes: 6, image: ph("wide", 10), body: ["사이트를 만드는 방법은 크게 네 가지입니다. 직접 만들기, 프리랜서, 에이전시, 그리고 구독형 제작.", "한 번 만들고 끝나는 사이트는 없습니다. 만든 뒤 얼마나 쉽게 고칠 수 있는지가 총비용을 결정합니다."], sample: true },
  { slug: "shop-checklist", category: "운영", title: "쇼핑몰 오픈 전 체크리스트 12가지", excerpt: "결제 테스트부터 배송 정책, 교환 · 환불 안내까지. 오픈 전에 꼭 확인할 것.", date: "2026-08-28", author: "페이지프렌즈 팀", readMinutes: 7, image: ph("wide", 11), body: ["결제 테스트는 실제 카드로 소액 결제 후 취소까지 해보세요.", "배송 · 교환 · 환불 정책은 상품 상세와 별도 페이지 두 곳에 두세요."], sample: true },
  { slug: "cafe-site-case", category: "사례", title: "카페 모닝은 어떻게 5일 만에 사이트를 열었나", excerpt: "템플릿 선택부터 첫 수정 요청까지, 실제 진행 과정을 따라갑니다.", date: "2026-08-20", author: "페이지프렌즈 팀", readMinutes: 4, image: ph("wide", 12), body: ["템플릿 '카페 데일리' 선택 → 필수 정보 입력 5분 → 5일 뒤 첫 완성본.", "첫 수정 요청은 메뉴 가격 3곳(AI 반영)과 매장 사진 교체 1곳(전문가 요청)이었습니다."], sample: true },
];
export const POST_BY_SLUG: Record<string, Post> = Object.fromEntries(POSTS.map((p) => [p.slug, p]));

export type Resource = { slug: string; category: "guide" | "webinar" | "podcast" | "recipe"; title: string; excerpt: string; image: Img; href: string; sample: true };
export const RESOURCE_CATEGORIES: { key: Resource["category"]; label: string }[] = [
  { key: "guide", label: "가이드 · 전자책" },
  { key: "webinar", label: "웨비나 · 이벤트" },
  { key: "podcast", label: "팟캐스트" },
  { key: "recipe", label: "레시피" },
];
/** 샘플 리소스 — 실제 자료로 교체 필요 */
export const RESOURCES: Resource[] = [
  { slug: "guide-first-site", category: "guide", title: "처음 만드는 홈페이지 가이드 (2026)", excerpt: "업종별 페이지 구성 예시와 브리프 템플릿을 담은 무료 가이드.", image: ph("photo", 7), href: "/blog/brief-that-works", sample: true },
  { slug: "guide-shop", category: "guide", title: "쇼핑몰 오픈 체크리스트 전자책", excerpt: "결제 · 배송 · 교환 정책까지 12가지 항목.", image: ph("photo", 8), href: "/blog/shop-checklist", sample: true },
  { slug: "webinar-editor", category: "webinar", title: "웨비나: 편집기로 수정 요청 잘 보내는 법", excerpt: "네모 · 종류 · 토큰. 30분 안에 편집기를 익힙니다.", image: ph("photo", 9), href: "/demo", sample: true },
  { slug: "podcast-owners", category: "podcast", title: "팟캐스트: 사장님들의 사이트 이야기", excerpt: "카페 · 학원 · 쇼핑몰 운영자가 말하는 사이트 운영.", image: ph("photo", 10), href: "/customer-stories", sample: true },
  { slug: "recipe-landing", category: "recipe", title: "레시피: 사전예약 랜딩페이지 구성", excerpt: "히어로 · 혜택 · 신청 폼. 한 페이지 구성 공식.", image: ph("photo", 11), href: "/solutions/landing", sample: true },
];

/** "시간 있으신가요? 추천" 3장 */
export const RECOMMENDED = [
  { kind: "가이드 · 전자책", title: POSTS[0].title, href: `/blog/${POSTS[0].slug}`, image: ph("wide", 7) },
  { kind: "비교", title: POSTS[3].title, href: `/blog/${POSTS[3].slug}`, image: ph("wide", 10) },
  { kind: "제작 팁", title: POSTS[1].title, href: `/blog/${POSTS[1].slug}`, image: ph("wide", 8) },
];

export type Person = { name: string; role: string; avatar: Img };
/** 샘플 리더십 — 실제 팀으로 교체 필요 */
export const LEADERS: Person[] = [
  { name: "손채원", role: "대표", avatar: ph("avatar", 7) },
  { name: "OOO", role: "제품 총괄", avatar: ph("avatar", 8) },
  { name: "OOO", role: "디자인 총괄", avatar: ph("avatar", 9) },
  { name: "OOO", role: "전문가 팀 리드", avatar: ph("avatar", 10) },
  { name: "OOO", role: "고객 성공", avatar: ph("avatar", 11) },
];

export const FUN_FACTS = [
  { value: "서울", label: "본사" },
  { value: "3~7일", label: "첫 완성본까지" },
  { value: "4", label: "월 플랜" },
  { value: "3종", label: "모바일 · 태블릿 · 웹" },
  { value: "24h", label: "AI 반영 통상 처리" },
  { value: "무료", label: "오류 신고" },
];

export const VALUES = [
  { title: "빠른 것이 친절한 것", body: "기다리게 하지 않습니다. 첫 완성본도, 수정도, 답변도." },
  { title: "사람이 마지막을 봅니다", body: "AI 가 만들고 전문가가 검수합니다. 어설픈 결과물을 내보내지 않습니다." },
  { title: "숨은 비용 없음", body: "플랜 · 토큰 · 크레딧 · 템플릿. 모든 가격을 공개합니다." },
  { title: "우리 실수는 우리가", body: "오류 신고는 어떤 한도에서도 차감하지 않습니다." },
  { title: "복잡한 절차 없이", body: "견적 · 미팅 · 계약서 없이 5분 안에 시작합니다." },
  { title: "당신이 전문가일 필요는 없습니다", body: "디자인 · 개발 지식이 없어도 네모 하나로 요청이 끝납니다." },
];

export type Job = { title: string; team: string; type: string; location: string };
/** 샘플 채용 공고 — 실제 공고로 교체 필요 */
export const JOBS: Job[] = [
  { title: "프론트엔드 엔지니어 (Next.js)", team: "제품", type: "정규직", location: "서울 · 원격 가능" },
  { title: "웹 디자이너 (전문가 팀)", team: "전문가", type: "정규직 · 계약직", location: "원격" },
  { title: "고객 성공 매니저", team: "고객", type: "정규직", location: "서울" },
];

export const BENEFITS = ["원격 근무 · 유연 근무", "자율 휴가", "장비 · 소프트웨어 지원", "건강검진 · 단체보험", "교육비 지원", "명절 · 생일 선물", "리모트 워크 지원금", "봉사 휴가"];

export const HELP_FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "시작하기",
    items: [
      { q: "템플릿을 꼭 사야 하나요?", a: "아니요. 프롬프트만으로 시작할 수 있습니다. 템플릿은 데모 1,000원, 운영 사이트 8,900원으로 플랜과 별도 1회 결제입니다." },
      { q: "첫 완성본은 언제 오나요?", a: `필수 정보 입력 후 ${DELIVERY_DAYS.min}~${DELIVERY_DAYS.max}일 안에 대시보드에 올라옵니다.` },
      { q: "플랜 없이도 사이트를 만들 수 있나요?", a: "프로젝트 생성까지는 가능하고, 수정 요청을 보내려면 플랜이 필요합니다." },
    ],
  },
  {
    group: "수정 요청",
    items: [
      { q: "AI 반영과 전문가 요청의 차이는?", a: "문구 · 색 · 간격처럼 바로 고칠 수 있는 것은 AI 반영(토큰 차감), 사진 교체 · 구조 변경처럼 사람이 필요한 것은 전문가 요청(주간 횟수)입니다." },
      { q: "오류 신고는 무엇인가요?", a: "우리 쪽 실수로 생긴 오류를 알리는 요청입니다. 토큰 · 횟수 어디에서도 차감하지 않습니다." },
      { q: "네모 여러 개를 한 번에 보낼 수 있나요?", a: "네. 페이지 · 디바이스에 상관없이 그린 네모를 '한번에 요청하기' 로 한 묶음으로 보냅니다." },
    ],
  },
  {
    group: "요금 · 결제",
    items: [
      { q: "AI 토큰은 어떻게 차감되나요?", a: "요청이 처리될 때 실제 사용량만큼 차감되고, 결제 기간마다 초기화됩니다. 한도를 넘으면 토큰 크레딧에서 차감됩니다." },
      { q: "해지하면 어떻게 되나요?", a: "현재 결제 기간이 끝날 때까지 이용하고 그 뒤로 결제되지 않습니다. 기간 안에는 해지를 취소할 수 있습니다." },
      { q: "결제 수단은?", a: "포트원(토스페이먼츠) 카드 자동 결제입니다. 카드 정보는 저장되지 않습니다." },
    ],
  },
];
