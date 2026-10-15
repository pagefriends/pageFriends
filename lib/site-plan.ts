import { APPROX_TOKENS_PER_IMAGE } from "@/config/plans";

/**
 * 사이트 구성 계획 — 새 사이트 위저드(브라우저)와 서버(프로젝트 생성 · 구성 초안 그림 · 이미지 생성 요청)가 같이 쓰는 순수 로직.
 *
 * 흐름: 회사·서비스 정보 + 헤더 메뉴(하위 페이지 포함) → 실제 페이지 목록(PlannedPage) → 페이지마다 이미지 자리(ImageSlot).
 * - 하위 페이지가 있는 메뉴는 "묶음"이다: 자기 페이지가 없고 누르면 첫 하위 페이지로 간다. 그래서 페이지 수에 세지 않는다.
 * - 이미지 자리는 사이트 전체에서 한 목록이다. 같은 서비스 사진이 홈 카드와 서비스 페이지에 같이 쓰이면 한 자리로 센다.
 * - 대표·구성원·건물·실제 작업물·상품 사진처럼 진짜여야 하는 자리(source "real")는 AI 로 만들지 않는다.
 *   가짜 사람·가짜 작업물이 실제처럼 보이면 사이트를 보는 고객을 속이게 되기 때문이다.
 * 자리 id 규칙은 위저드 · 초안 그림 · 생성 요청이 모두 같아야 하므로 id 는 이 파일에서만 만든다.
 */

export type IndustryCategory = "cafe" | "clinic" | "academy" | "fitness" | "shop" | "it" | "b2b" | "beauty" | "pro" | "creative" | "stay" | "etc";

export type PageKind =
  | "home"
  | "about"
  | "greeting"
  | "history"
  | "location"
  | "services"
  | "service"
  | "products"
  | "portfolio"
  | "reviews"
  | "team"
  | "notice"
  | "faq"
  | "contact"
  | "reservation"
  | "pricing"
  | "cases"
  | "blog"
  | "careers"
  | "generic";

/** 페이지 종류 이름 (전문가 모드의 "페이지 종류" 선택 · 관리자 화면) */
export const PAGE_KIND_LABEL: Record<PageKind, string> = {
  home: "홈",
  about: "소개",
  greeting: "인사말",
  history: "연혁",
  location: "오시는 길 (지도)",
  services: "서비스 목록",
  service: "서비스 하나 자세히",
  products: "상품 · 메뉴 목록",
  portfolio: "사진 모음 (포트폴리오)",
  reviews: "후기",
  team: "구성원 소개",
  notice: "공지 · 게시판",
  faq: "자주 묻는 질문",
  contact: "문의 폼",
  reservation: "예약 폼",
  pricing: "요금 안내",
  cases: "사례 · 실적",
  blog: "블로그",
  careers: "채용",
  generic: "자유 구성",
};

/** 전문가 모드에서 고를 수 있는 종류 (홈·서비스 상세는 자동으로만 정해진다) */
export const SELECTABLE_KINDS: PageKind[] = [
  "about",
  "greeting",
  "history",
  "location",
  "services",
  "products",
  "portfolio",
  "reviews",
  "team",
  "notice",
  "faq",
  "contact",
  "reservation",
  "pricing",
  "cases",
  "blog",
  "careers",
  "generic",
];

export type Offering = { name: string; description: string };
export type ContactInfo = { phone: string; email: string; address: string; hours: string };

export type PurposeCode = "intro" | "inquiry" | "reservation" | "sales" | "portfolio" | "recruit" | "news";

/** 회사·서비스 정보. 위저드 1단계에서 받고 초안의 문구(첫 화면 제목·서비스 카드·푸터 연락처)가 된다. */
export type BusinessInfo = {
  category: IndustryCategory;
  /** 한 줄 소개 — 첫 화면의 큰 제목 */
  tagline: string;
  /** 제공하는 서비스·상품·솔루션 */
  offerings: Offering[];
  /** 고객이 우리를 고르는 이유 */
  strengths: string[];
  /** 회사 소개 글 (선택) */
  about: string;
  contact: ContactInfo;
  purposes: PurposeCode[];
};

export const PURPOSES: { code: PurposeCode; label: string; page?: { label: string; kind: PageKind } }[] = [
  { code: "intro", label: "회사·가게 알리기" },
  { code: "inquiry", label: "문의·상담 받기", page: { label: "문의하기", kind: "contact" } },
  { code: "reservation", label: "예약 받기", page: { label: "예약", kind: "reservation" } },
  { code: "sales", label: "상품 판매", page: { label: "상품", kind: "products" } },
  { code: "portfolio", label: "작업물 보여주기", page: { label: "포트폴리오", kind: "portfolio" } },
  { code: "recruit", label: "직원 채용", page: { label: "채용", kind: "careers" } },
  { code: "news", label: "소식·공지 전하기", page: { label: "공지사항", kind: "notice" } },
];

/** 위저드의 "필요한 기능" 칩. 페이지 구성에서 자동으로 따라오는 것과 직접 고르는 것이 있다. */
export const FEATURE_OPTIONS: { key: string; label: string; needsPlan?: boolean }[] = [
  { key: "contact-form", label: "문의 폼" },
  { key: "reservation", label: "예약" },
  { key: "map", label: "지도 · 오시는 길" },
  { key: "gallery", label: "갤러리" },
  { key: "board", label: "게시판 · 공지" },
  { key: "membership", label: "회원가입 · 로그인" },
  { key: "payment", label: "결제 (쇼핑몰)", needsPlan: true },
  { key: "blog", label: "블로그" },
];

export const FEATURE_LABEL: Record<string, string> = Object.fromEntries(FEATURE_OPTIONS.map((f) => [f.key, f.label]));

/** 페이지 종류 → 같이 필요한 기능 */
const KIND_FEATURE: Partial<Record<PageKind, string>> = {
  contact: "contact-form",
  reservation: "reservation",
  location: "map",
  portfolio: "gallery",
  notice: "board",
  blog: "blog",
};

// ---------------------------------------------------------------------------------------------
// 업종
// ---------------------------------------------------------------------------------------------

type Spec = { label: string; kind: PageKind | null; p: number; offering?: number; children?: Spec[] };
type Tier = "lean" | "standard" | "rich";

type Industry = {
  code: IndustryCategory;
  label: string;
  keywords: string[];
  /** 서비스·상품을 부르는 말 (메뉴 이름 · 섹션 제목) */
  offeringMenu: string;
  /** 서비스 목록 페이지 모양: 줄(설명 위주) 또는 격자(사진 위주) */
  offeringKind: "services" | "products";
  /** 서비스·상품 사진이 실제여야 하는지 (상품·메뉴·객실·작업물은 실제 사진) */
  offeringSource: "ai" | "real";
  /** 서비스마다 하위 페이지를 만들어도 자연스러운가 (카페 메뉴는 한 페이지가 낫다) */
  offeringPages: boolean;
  heroNeed: string;
  about: { label: string; need: string; source: "ai" | "real" };
  galleryNeed: string;
  teamNeed: string;
  cta: string;
  example: { name: string; tagline: string; offerings: Offering[]; strength: string; audience: string };
  menus: Record<Tier, (svc: Spec) => Spec[]>;
};

const L = (label: string, kind: PageKind, p = 2): Spec => ({ label, kind, p });
const G = (label: string, children: Spec[]): Spec => ({ label, kind: null, p: 0, children });

export const INDUSTRIES: Industry[] = [
  {
    code: "cafe",
    label: "카페 · 음식점",
    keywords: ["카페", "커피", "음식", "식당", "레스토랑", "베이커리", "빵", "디저트", "브런치", "주점", "치킨", "피자", "한식", "일식", "중식", "양식", "분식", "고기", "횟집", "펍"],
    offeringMenu: "메뉴",
    offeringKind: "products",
    offeringSource: "real",
    offeringPages: false,
    heroNeed: "매장 분위기가 느껴지는 대표 이미지 (따뜻한 조명, 메뉴가 놓인 테이블)",
    about: { label: "매장 사진", need: "매장 외관이나 내부 전경 — 손님이 처음 보게 될 모습", source: "real" },
    galleryNeed: "매장 곳곳의 공간 사진",
    teamNeed: "직원 프로필 사진",
    cta: "매장 안내",
    example: {
      name: "카페 데일리",
      tagline: "매일 아침 직접 볶은 원두로 내리는 동네 핸드드립 카페",
      offerings: [
        { name: "핸드드립 커피", description: "그날 볶은 원두로 한 잔씩 내려요" },
        { name: "수제 디저트", description: "매일 아침 굽는 휘낭시에와 스콘" },
      ],
      strength: "바리스타가 직접 로스팅",
      audience: "출근길 직장인, 동네 주민",
    },
    menus: {
      lean: (svc) => [L("브랜드 소개", "about"), svc, L("매장 안내", "location", 1), L("문의하기", "contact")],
      standard: (svc) => [L("브랜드 소개", "about"), svc, L("매장 안내", "location", 1), L("고객 후기", "reviews", 3), L("문의하기", "contact")],
      rich: (svc) => [
        G("브랜드", [L("브랜드 이야기", "about"), L("공간 소개", "portfolio", 3)]),
        svc,
        L("매장 안내", "location", 1),
        G("소식", [L("공지사항", "notice", 3), L("고객 후기", "reviews", 3)]),
        L("문의하기", "contact"),
      ],
    },
  },
  {
    code: "clinic",
    label: "병원 · 의원",
    keywords: ["병원", "의원", "클리닉", "치과", "한의원", "피부과", "성형", "정형", "내과", "안과", "소아과", "이비인후과", "산부인과", "동물병원", "약국", "재활"],
    offeringMenu: "진료 안내",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "밝고 깨끗한 병원 분위기를 보여주는 대표 이미지",
    about: { label: "병원 내부 사진", need: "대기실·진료실 등 실제 병원 내부 모습", source: "real" },
    galleryNeed: "병원 시설 사진 (대기실·진료실·장비)",
    teamNeed: "의료진 프로필 사진",
    cta: "진료 예약",
    example: {
      name: "밝은미소 치과",
      tagline: "아프지 않게, 꼭 필요한 치료만 하는 동네 치과",
      offerings: [
        { name: "임플란트", description: "정밀 진단 후 맞춤 식립" },
        { name: "치아 미백", description: "전문가가 직접 하는 미백 관리" },
      ],
      strength: "전문의 직접 진료",
      audience: "치과가 무서운 직장인과 어르신",
    },
    menus: {
      lean: (svc) => [L("병원 소개", "about"), svc, L("오시는 길", "location", 1), L("진료 예약", "reservation")],
      standard: (svc) => [
        G("병원 소개", [L("인사말", "greeting"), L("의료진", "team"), L("오시는 길", "location", 1)]),
        svc,
        L("고객 후기", "reviews", 3),
        L("진료 예약", "reservation"),
      ],
      rich: (svc) => [
        G("병원 소개", [L("인사말", "greeting"), L("의료진", "team"), L("둘러보기", "portfolio", 3), L("오시는 길", "location", 1)]),
        svc,
        L("고객 후기", "reviews", 3),
        G("고객센터", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3), L("진료 예약", "reservation")]),
      ],
    },
  },
  {
    code: "academy",
    label: "학원 · 교육",
    keywords: ["학원", "교육", "과외", "교습", "강의", "어학", "영어", "수학", "코딩", "유치원", "어린이집", "스쿨", "아카데미", "공부방", "입시", "튜터"],
    offeringMenu: "교육 과정",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "집중해서 공부하는 분위기의 대표 이미지",
    about: { label: "학원 사진", need: "교실·자습실 등 실제 학원 내부 모습", source: "real" },
    galleryNeed: "학원 시설 사진 (교실·자습실)",
    teamNeed: "강사 프로필 사진",
    cta: "상담 신청",
    example: {
      name: "생각하는 수학학원",
      tagline: "개념부터 다시 잡는 중·고등 수학 전문 학원",
      offerings: [
        { name: "중등 내신반", description: "학교별 기출 분석 수업" },
        { name: "고등 수능반", description: "유형별 문제 풀이 집중 훈련" },
      ],
      strength: "소수 정예 반 운영",
      audience: "성적이 오르지 않아 고민인 중·고등학생",
    },
    menus: {
      lean: (svc) => [L("학원 소개", "about"), svc, L("오시는 길", "location"), L("상담 신청", "contact", 1)],
      standard: (svc) => [
        G("학원 소개", [L("인사말", "greeting"), L("강사 소개", "team"), L("오시는 길", "location")]),
        svc,
        L("수강 후기", "reviews", 3),
        L("상담 신청", "contact", 1),
      ],
      rich: (svc) => [
        G("학원 소개", [L("인사말", "greeting"), L("강사 소개", "team"), L("시설 안내", "portfolio", 3), L("오시는 길", "location")]),
        svc,
        L("수강 후기", "reviews", 3),
        G("커뮤니티", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3)]),
        L("상담 신청", "contact", 1),
      ],
    },
  },
  {
    code: "fitness",
    label: "운동 · 피트니스",
    keywords: ["헬스", "피트니스", "필라테스", "요가", "짐", "gym", "pt", "크로스핏", "수영", "태권도", "골프", "클라이밍", "댄스", "복싱", "주짓수", "발레"],
    offeringMenu: "프로그램",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "운동하는 모습이 담긴 활기찬 대표 이미지",
    about: { label: "센터 사진", need: "운동 공간 전경 — 실제 센터 내부 모습", source: "real" },
    galleryNeed: "운동 시설·기구 사진",
    teamNeed: "트레이너 프로필 사진",
    cta: "상담 신청",
    example: {
      name: "바른 필라테스",
      tagline: "자세부터 바로잡는 1:1 맞춤 필라테스",
      offerings: [
        { name: "1:1 개인 레슨", description: "체형 분석 후 맞춤 수업" },
        { name: "소그룹 레슨", description: "4명 이하 소규모 수업" },
      ],
      strength: "체형 분석 후 맞춤 수업",
      audience: "허리·목 통증이 있는 직장인",
    },
    menus: {
      lean: (svc) => [L("센터 소개", "about"), svc, L("이용 요금", "pricing"), L("상담 신청", "contact", 1)],
      standard: (svc) => [
        G("센터 소개", [L("센터 이야기", "about"), L("트레이너", "team"), L("시설 안내", "portfolio", 3), L("오시는 길", "location")]),
        svc,
        L("이용 요금", "pricing"),
        L("회원 후기", "reviews", 3),
        L("상담 신청", "contact", 1),
      ],
      rich: (svc) => [
        G("센터 소개", [L("센터 이야기", "about"), L("트레이너", "team"), L("시설 안내", "portfolio", 3), L("오시는 길", "location")]),
        svc,
        L("이용 요금", "pricing"),
        G("커뮤니티", [L("공지사항", "notice", 3), L("회원 후기", "reviews", 3)]),
        L("상담 신청", "contact", 1),
      ],
    },
  },
  {
    code: "shop",
    label: "쇼핑몰 · 상품 판매",
    keywords: ["쇼핑", "몰", "판매", "스토어", "커머스", "의류", "옷", "잡화", "온라인", "상점", "편집샵", "꽃집", "플라워", "굿즈", "리빙", "소품"],
    offeringMenu: "상품",
    offeringKind: "products",
    offeringSource: "real",
    offeringPages: true,
    heroNeed: "대표 상품을 감각적으로 연출한 대표 이미지",
    about: { label: "브랜드 이미지", need: "브랜드 분위기를 보여주는 이미지 (제품 연출·작업 공간)", source: "ai" },
    galleryNeed: "상품 연출 사진",
    teamNeed: "구성원 프로필 사진",
    cta: "상품 보기",
    example: {
      name: "오늘의 리빙",
      tagline: "매일 쓰는 물건을 더 예쁘게, 감성 리빙 소품 숍",
      offerings: [
        { name: "테이블웨어", description: "도자기 그릇과 컵" },
        { name: "패브릭 소품", description: "쿠션 커버와 러그" },
      ],
      strength: "직접 고르고 검수한 제품만 판매",
      audience: "집 꾸미기를 좋아하는 2030",
    },
    menus: {
      lean: (svc) => [L("브랜드 소개", "about"), svc, L("고객 후기", "reviews"), L("고객센터", "contact", 1)],
      standard: (svc) => [
        L("브랜드 소개", "about"),
        svc,
        L("고객 후기", "reviews"),
        G("고객센터", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3), L("문의하기", "contact", 1)]),
      ],
      rich: (svc) => [
        L("브랜드 소개", "about"),
        svc,
        L("고객 후기", "reviews"),
        L("이벤트", "notice", 3),
        G("고객센터", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3), L("문의하기", "contact", 1)]),
      ],
    },
  },
  {
    code: "it",
    label: "IT · 소프트웨어",
    keywords: ["it", "소프트웨어", "솔루션", "saas", "앱", "어플", "플랫폼", "개발", "ai", "스타트업", "테크", "클라우드", "데이터", "보안"],
    offeringMenu: "솔루션",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "서비스를 쓰는 모습이나 서비스가 주는 편리함을 표현한 대표 이미지",
    about: { label: "회사 소개 이미지", need: "회사가 추구하는 가치나 일하는 분위기를 표현한 이미지", source: "ai" },
    galleryNeed: "서비스 화면 캡처",
    teamNeed: "구성원 프로필 사진",
    cta: "도입 문의",
    example: {
      name: "스마트재고",
      tagline: "엑셀 없이 쓰는 소상공인 재고 관리 솔루션",
      offerings: [
        { name: "재고 관리", description: "입출고를 바코드로 자동 기록" },
        { name: "매출 리포트", description: "매일 아침 받는 판매 요약" },
      ],
      strength: "설치 없이 바로 쓰는 간단한 화면",
      audience: "매장 여러 곳을 운영하는 사장님",
    },
    menus: {
      lean: (svc) => [svc, L("요금 안내", "pricing"), L("회사 소개", "about"), L("도입 문의", "contact", 1)],
      standard: (svc) => [svc, L("요금 안내", "pricing"), L("고객 사례", "cases", 3), L("회사 소개", "about"), L("도입 문의", "contact", 1)],
      rich: (svc) => [
        svc,
        L("요금 안내", "pricing"),
        L("고객 사례", "cases", 3),
        G("리소스", [L("블로그", "blog", 3), L("자주 묻는 질문", "faq", 3)]),
        G("회사", [L("회사 소개", "about"), L("채용", "careers", 3)]),
        L("도입 문의", "contact", 1),
      ],
    },
  },
  {
    code: "b2b",
    label: "제조 · 기업(B2B)",
    keywords: ["제조", "공장", "부품", "기계", "산업", "유통", "도매", "무역", "건설", "설비", "자재", "화학", "b2b", "물류", "가공", "엔지니어링"],
    offeringMenu: "제품 소개",
    offeringKind: "products",
    offeringSource: "real",
    offeringPages: true,
    heroNeed: "정밀한 생산 현장이나 제품을 보여주는 대표 이미지",
    about: { label: "회사 전경", need: "본사·공장 건물이나 실제 생산 현장 사진", source: "real" },
    galleryNeed: "생산 설비·현장 사진",
    teamNeed: "구성원 프로필 사진",
    cta: "견적 문의",
    example: {
      name: "대한정밀",
      tagline: "자동차 부품 정밀 가공 전문 기업",
      offerings: [
        { name: "CNC 정밀 가공", description: "고정밀 금속 부품 가공" },
        { name: "금형 제작", description: "설계부터 양산까지 일괄 대응" },
      ],
      strength: "ISO 9001 인증 품질 관리",
      audience: "완성차·부품 협력사 구매 담당자",
    },
    menus: {
      lean: (svc) => [L("회사 소개", "about"), svc, L("오시는 길", "location"), L("견적 문의", "contact", 1)],
      standard: (svc) => [
        G("회사 소개", [L("인사말", "greeting"), L("연혁", "history", 3), L("오시는 길", "location")]),
        svc,
        L("납품 실적", "cases", 3),
        G("고객센터", [L("공지사항", "notice", 3), L("견적 문의", "contact", 1)]),
      ],
      rich: (svc) => [
        G("회사 소개", [L("인사말", "greeting"), L("연혁", "history", 3), L("인증 · 특허", "generic", 3), L("오시는 길", "location")]),
        svc,
        L("납품 실적", "cases", 3),
        G("고객센터", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3), L("견적 문의", "contact", 1)]),
      ],
    },
  },
  {
    code: "beauty",
    label: "뷰티 · 미용",
    keywords: ["미용", "헤어", "네일", "뷰티", "피부관리", "에스테틱", "속눈썹", "왁싱", "바버", "메이크업", "살롱", "반영구", "스파", "마사지"],
    offeringMenu: "시술 메뉴",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "세련된 매장 분위기의 대표 이미지",
    about: { label: "매장 사진", need: "실제 시술 공간·인테리어 사진", source: "real" },
    galleryNeed: "실제 시술 결과 사진",
    teamNeed: "디자이너 프로필 사진",
    cta: "예약하기",
    example: {
      name: "살롱 드 봄",
      tagline: "얼굴형에 맞춘 1:1 디자인 컷 전문 헤어살롱",
      offerings: [
        { name: "디자인 컷", description: "얼굴형 분석 후 맞춤 커트" },
        { name: "클리닉 펌", description: "손상을 줄인 저자극 펌" },
      ],
      strength: "원장 1:1 전담 시술",
      audience: "손질 쉬운 머리를 원하는 직장인",
    },
    menus: {
      lean: (svc) => [L("소개", "about"), svc, L("포트폴리오", "portfolio"), L("예약하기", "reservation", 1)],
      standard: (svc) => [
        G("소개", [L("원장 인사", "greeting"), L("오시는 길", "location")]),
        svc,
        L("포트폴리오", "portfolio"),
        L("고객 후기", "reviews", 3),
        L("예약하기", "reservation", 1),
      ],
      rich: (svc) => [
        G("소개", [L("원장 인사", "greeting"), L("디자이너", "team"), L("오시는 길", "location")]),
        svc,
        L("포트폴리오", "portfolio"),
        L("고객 후기", "reviews", 3),
        L("예약하기", "reservation", 1),
      ],
    },
  },
  {
    code: "pro",
    label: "법률 · 세무 · 컨설팅",
    keywords: ["법률", "변호사", "법무", "세무", "회계", "노무", "컨설팅", "특허", "변리", "행정사", "부동산", "중개", "보험", "자산"],
    offeringMenu: "업무 분야",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "신뢰감을 주는 차분한 상담 분위기의 대표 이미지",
    about: { label: "사무소 사진", need: "실제 사무소 내부나 상담실 사진", source: "real" },
    galleryNeed: "사무소 공간 사진",
    teamNeed: "구성원(전문가) 프로필 사진",
    cta: "상담 신청",
    example: {
      name: "바른 세무회계",
      tagline: "사장님 대신 세금을 챙기는 소상공인 전문 세무사무소",
      offerings: [
        { name: "기장 대행", description: "매달 장부 정리와 신고" },
        { name: "세무 조사 대응", description: "조사 전 준비부터 입회까지" },
      ],
      strength: "세무사가 직접 상담",
      audience: "개인사업자, 프리랜서",
    },
    menus: {
      lean: (svc) => [L("사무소 소개", "about"), svc, L("오시는 길", "location"), L("상담 신청", "contact", 1)],
      standard: (svc) => [
        G("사무소 소개", [L("인사말", "greeting"), L("구성원", "team"), L("오시는 길", "location")]),
        svc,
        L("성공 사례", "cases", 3),
        L("상담 신청", "contact", 1),
      ],
      rich: (svc) => [
        G("사무소 소개", [L("인사말", "greeting"), L("구성원", "team"), L("오시는 길", "location")]),
        svc,
        L("성공 사례", "cases", 3),
        G("소식", [L("공지사항", "notice", 3), L("칼럼", "blog", 3)]),
        L("상담 신청", "contact", 1),
      ],
    },
  },
  {
    code: "creative",
    label: "디자인 · 스튜디오",
    keywords: ["디자인", "스튜디오", "사진", "영상", "포트폴리오", "인테리어", "건축", "에이전시", "프리랜서", "작가", "웨딩", "브랜딩", "일러스트"],
    offeringMenu: "서비스",
    offeringKind: "services",
    offeringSource: "real",
    offeringPages: true,
    heroNeed: "대표 작업물이 돋보이는 대표 이미지",
    about: { label: "스튜디오 사진", need: "실제 작업 공간이나 팀이 일하는 모습", source: "real" },
    galleryNeed: "대표 작업물 사진",
    teamNeed: "구성원 프로필 사진",
    cta: "프로젝트 문의",
    example: {
      name: "스튜디오 오월",
      tagline: "브랜드의 첫인상을 만드는 그래픽 디자인 스튜디오",
      offerings: [
        { name: "브랜드 디자인", description: "로고와 브랜드 가이드" },
        { name: "패키지 디자인", description: "제품 패키지와 라벨" },
      ],
      strength: "기획부터 인쇄까지 한 번에",
      audience: "창업을 준비하는 브랜드",
    },
    menus: {
      lean: (svc) => [L("소개", "about"), L("포트폴리오", "portfolio", 1), svc, L("문의하기", "contact", 1)],
      standard: (svc) => [L("소개", "about"), L("포트폴리오", "portfolio", 1), svc, L("고객 후기", "reviews", 3), L("진행 과정", "generic", 3), L("문의하기", "contact", 1)],
      rich: (svc) => [
        G("스튜디오", [L("소개", "about"), L("팀 소개", "team", 3)]),
        L("포트폴리오", "portfolio", 1),
        svc,
        L("고객 후기", "reviews", 3),
        L("진행 과정", "generic", 3),
        L("문의하기", "contact", 1),
      ],
    },
  },
  {
    code: "stay",
    label: "숙박 · 여행",
    keywords: ["펜션", "호텔", "숙박", "게스트하우스", "캠핑", "글램핑", "리조트", "여행", "투어", "스테이", "민박", "한옥", "풀빌라"],
    offeringMenu: "객실 안내",
    offeringKind: "products",
    offeringSource: "real",
    offeringPages: true,
    heroNeed: "숙소에서 보이는 풍경이 담긴 대표 이미지",
    about: { label: "숙소 전경", need: "숙소 외관이나 실제 대표 전경 사진", source: "real" },
    galleryNeed: "객실·부대시설 사진",
    teamNeed: "운영자 프로필 사진",
    cta: "예약하기",
    example: {
      name: "솔숲 펜션",
      tagline: "바다가 보이는 독채 감성 펜션",
      offerings: [
        { name: "오션뷰 독채", description: "2인 기준 · 개별 바비큐" },
        { name: "패밀리 룸", description: "4인 기준 · 복층 구조" },
      ],
      strength: "모든 객실 개별 테라스",
      audience: "주말 여행을 떠나는 커플과 가족",
    },
    menus: {
      lean: (svc) => [L("소개", "about"), svc, L("오시는 길", "location"), L("예약하기", "reservation", 1)],
      standard: (svc) => [
        G("소개", [L("숙소 이야기", "about"), L("시설 안내", "portfolio")]),
        svc,
        L("오시는 길", "location"),
        L("이용 후기", "reviews", 3),
        L("예약하기", "reservation", 1),
      ],
      rich: (svc) => [
        G("소개", [L("숙소 이야기", "about"), L("시설 안내", "portfolio"), L("주변 관광", "generic", 3)]),
        svc,
        L("오시는 길", "location"),
        G("커뮤니티", [L("공지사항", "notice", 3), L("이용 후기", "reviews", 3)]),
        L("예약하기", "reservation", 1),
      ],
    },
  },
  {
    code: "etc",
    label: "기타",
    keywords: [],
    offeringMenu: "서비스",
    offeringKind: "services",
    offeringSource: "ai",
    offeringPages: true,
    heroNeed: "회사·서비스를 한눈에 보여주는 대표 이미지",
    about: { label: "회사 사진", need: "회사·팀을 보여주는 실제 사진 (사무실·매장·일하는 모습)", source: "real" },
    galleryNeed: "작업·현장 사진",
    teamNeed: "구성원 프로필 사진",
    cta: "문의하기",
    example: {
      name: "한결 클린",
      tagline: "믿고 맡기는 입주·이사 청소 전문 업체",
      offerings: [
        { name: "입주 청소", description: "새집 먼지와 냄새까지" },
        { name: "사무실 청소", description: "정기 방문 청소" },
      ],
      strength: "청소 후 무료 재방문 점검",
      audience: "이사를 앞둔 가족, 사무실 관리자",
    },
    menus: {
      lean: (svc) => [L("회사 소개", "about"), svc, L("오시는 길", "location"), L("문의하기", "contact", 1)],
      standard: (svc) => [
        G("회사 소개", [L("인사말", "greeting"), L("오시는 길", "location")]),
        svc,
        L("고객 후기", "reviews", 3),
        G("고객센터", [L("자주 묻는 질문", "faq", 3), L("문의하기", "contact", 1)]),
      ],
      rich: (svc) => [
        G("회사 소개", [L("인사말", "greeting"), L("연혁", "history", 3), L("오시는 길", "location")]),
        svc,
        L("고객 후기", "reviews", 3),
        G("고객센터", [L("공지사항", "notice", 3), L("자주 묻는 질문", "faq", 3), L("문의하기", "contact", 1)]),
      ],
    },
  },
];

const INDUSTRY_BY_CODE = Object.fromEntries(INDUSTRIES.map((i) => [i.code, i])) as Record<IndustryCategory, Industry>;

export function industryOf(code: IndustryCategory | null | undefined): Industry {
  return INDUSTRY_BY_CODE[code ?? "etc"] ?? INDUSTRY_BY_CODE.etc;
}

/** 업종 글자에서 분류를 짐작한다 ("피부과" → 병원). 칩을 고르지 않고 직접 쓴 경우에 쓴다. */
export function detectCategory(industry: string): IndustryCategory {
  const s = industry.trim().toLowerCase();
  if (!s) return "etc";
  const exact = INDUSTRIES.find((i) => i.label === industry.trim());
  if (exact) return exact.code;
  for (const i of INDUSTRIES) if (i.keywords.some((k) => s.includes(k))) return i.code;
  return "etc";
}

/** 헤더 오른쪽 버튼 문구. 예약을 받는다면 예약, 아니면 업종 기본값 */
export function ctaLabel(category: IndustryCategory, purposes: PurposeCode[]): string {
  const base = industryOf(category).cta;
  if (purposes.includes("reservation") && !base.includes("예약")) return "예약하기";
  return base;
}

// ---------------------------------------------------------------------------------------------
// 메뉴 (헤더 메뉴 + 하위 페이지)
// ---------------------------------------------------------------------------------------------

/** 메뉴 한 칸. kind 가 null 이면 이름으로 종류를 짐작한다. offering 은 "서비스 하나 자세히" 페이지가 가리키는 서비스 번호 */
export type MenuLeaf = { label: string; kind: PageKind | null; note: string; offering?: number | null };
/** 하위 페이지(children)가 있으면 묶음이다 — 자기 페이지가 없고 누르면 첫 하위 페이지로 간다 */
export type MenuNode = MenuLeaf & { children: MenuLeaf[] };

export const MENU_LIMITS = { top: 8, children: 8, label: 20, note: 500 } as const;

/** 페이지 수 = 홈 1 + 하위 페이지 없는 메뉴 + 하위 페이지 */
export function countPages(menu: MenuNode[]): number {
  return 1 + menu.reduce((n, m) => n + (m.children.length > 0 ? m.children.length : 1), 0);
}

const countSpecs = (specs: Spec[]) => specs.reduce((n, s) => n + (s.children ? s.children.length : 1), 0);

function servicesSpec(ind: Industry, offerings: Offering[], allowPages: boolean): Spec {
  if (allowPages && ind.offeringPages && offerings.length >= 2 && offerings.length <= 6) {
    return G(
      ind.offeringMenu,
      offerings.map((o, i) => ({ label: shortLabel(o.name), kind: "service" as const, p: 2, offering: i })),
    );
  }
  return L(ind.offeringMenu, ind.offeringKind, 1);
}

function shortLabel(s: string): string {
  const t = s.trim();
  return t.length > MENU_LIMITS.label ? `${t.slice(0, MENU_LIMITS.label - 1)}…` : t;
}

/** 사이트 목적에 맞는 페이지가 없으면 더하고, 있으면 꼭 남길 페이지로 올린다 */
function applyPurposes(specs: Spec[], purposes: PurposeCode[]) {
  const all = () => specs.flatMap((s) => (s.children ? s.children : [s]));
  for (const code of purposes) {
    const page = PURPOSES.find((p) => p.code === code)?.page;
    if (!page) continue;
    const found = all().filter((s) => s.kind === page.kind || (page.kind === "products" && s.kind === "service"));
    if (found.length > 0) {
      found.forEach((s) => (s.p = 1));
      continue;
    }
    const extra = L(page.label, page.kind, 1);
    // 마지막이 문의·예약이면 그 앞에 넣는다 (문의는 보통 맨 끝)
    const last = specs[specs.length - 1];
    const lastIsContact = last && (last.kind === "contact" || last.kind === "reservation" || last.children?.some((c) => c.kind === "contact" || c.kind === "reservation"));
    if (lastIsContact) specs.splice(specs.length - 1, 0, extra);
    else specs.push(extra);
  }
}

/** 페이지 한도(홈 포함)에 맞게 덜 중요한 페이지(p 가 큰 것, 같으면 뒤쪽)부터 뺀다. 하위 페이지가 하나만 남은 묶음은 풀어 준다. */
function fitSpecs(specs: Spec[], maxPages: number): Spec[] {
  const tree: Spec[] = specs.map((s) => ({ ...s, children: s.children ? s.children.map((c) => ({ ...c })) : undefined }));
  while (countSpecs(tree) > maxPages - 1) {
    let wi = -1;
    let wj = -1;
    let wp = -Infinity;
    for (let i = 0; i < tree.length; i++) {
      const kids = tree[i].children;
      if (kids) {
        for (let j = 0; j < kids.length; j++) {
          if (kids[j].p >= wp) [wi, wj, wp] = [i, j, kids[j].p];
        }
      } else if (tree[i].p >= wp) [wi, wj, wp] = [i, -1, tree[i].p];
    }
    if (wi < 0) break;
    if (wj >= 0) tree[wi].children!.splice(wj, 1);
    else tree.splice(wi, 1);
  }
  return tree
    .filter((s) => !s.children || s.children.length > 0)
    .map((s) => (s.children && s.children.length === 1 ? s.children[0] : s));
}

function toMenu(specs: Spec[]): MenuNode[] {
  return specs.map((s) => ({
    label: s.label,
    kind: s.children ? null : s.kind,
    note: "",
    offering: s.offering ?? null,
    children: (s.children ?? []).map((c) => ({ label: c.label, kind: c.kind, note: "", offering: c.offering ?? null })),
  }));
}

/**
 * 업종 · 사이트 목적 · 서비스 목록 · 플랜 페이지 한도로 추천 메뉴를 만든다.
 * 한도가 작으면(스타터 5페이지) 하위 페이지 없이 꼭 필요한 페이지만, 크면 하위 페이지까지 나눈다.
 */
export function recommendMenu(input: { category: IndustryCategory; purposes: PurposeCode[]; offerings: Offering[]; maxPages: number }): MenuNode[] {
  const ind = industryOf(input.category);
  const max = Math.max(2, input.maxPages);
  const tier: Tier = max <= 5 ? "lean" : max <= 12 ? "standard" : "rich";
  const offerings = input.offerings.filter((o) => o.name.trim());
  const build = (allowPages: boolean) => {
    const specs = ind.menus[tier](servicesSpec(ind, offerings, allowPages && tier !== "lean"));
    applyPurposes(specs, input.purposes);
    return specs;
  };
  let specs = build(true);
  // 서비스별 하위 페이지까지 넣으면 한도를 넘는 경우: 서비스는 한 페이지로 모은다 (일부만 빠지면 메뉴가 어색하다)
  if (countSpecs(specs) > max - 1) specs = build(false);
  return toMenu(fitSpecs(specs, max));
}

/** 템플릿의 페이지 이름 목록 → 메뉴 (모두 하위 페이지 없는 메뉴). '홈' 은 빼고 넣는다 */
export function menuFromPageNames(names: string[]): MenuNode[] {
  return names
    .filter((n) => n.trim() && n.trim() !== "홈")
    .map((n) => ({ label: shortLabel(n), kind: null, note: "", offering: null, children: [] }));
}

// ---------------------------------------------------------------------------------------------
// 페이지 종류 · 주소
// ---------------------------------------------------------------------------------------------

const KIND_RULES: [RegExp, PageKind][] = [
  [/오시는|찾아오|위치|약도|매장\s*안내|location|map/i, "location"],
  [/인사|대표\s*말|greeting/i, "greeting"],
  [/연혁|history/i, "history"],
  [/의료진|강사|트레이너|디자이너|구성원|팀|멤버|사람들|staff|team|people/i, "team"],
  [/자주\s*묻|faq|q\s*&\s*a|qna/i, "faq"],
  [/공지|소식|뉴스|이벤트|news|notice/i, "notice"],
  [/후기|리뷰|review/i, "reviews"],
  [/포트폴리오|갤러리|작업물|시공|둘러보기|시설|공간|portfolio|gallery/i, "portfolio"],
  [/사례|실적|레퍼런스|case|reference/i, "cases"],
  [/요금|가격|비용|이용료|pricing|price/i, "pricing"],
  [/블로그|칼럼|매거진|blog|column/i, "blog"],
  [/채용|인재|career|recruit|jobs/i, "careers"],
  [/예약|reservation|booking/i, "reservation"],
  [/문의|상담|연락|견적|contact|고객센터/i, "contact"],
  [/진행\s*과정|이용\s*방법|절차|process/i, "generic"],
  [/상품|제품|메뉴|객실|쇼핑|shop|product|menu|room/i, "products"],
  [/서비스|솔루션|진료|과정|과목|업무|시술|프로그램|클래스|수업|service|solution|program/i, "services"],
  [/소개|회사|브랜드|이야기|스토리|철학|about|story/i, "about"],
];

/** 메뉴 이름으로 페이지 종류를 짐작한다. 서비스 이름과 같으면 그 서비스 하나를 자세히 보여주는 페이지 */
export function inferPageKind(label: string, offerings: Offering[]): { kind: PageKind; offering: number | null } {
  const t = label.trim();
  const idx = offerings.findIndex((o) => o.name.trim() && (o.name.trim() === t || shortLabel(o.name) === t));
  if (idx >= 0) return { kind: "service", offering: idx };
  for (const [re, kind] of KIND_RULES) if (re.test(t)) return { kind, offering: null };
  return { kind: "generic", offering: null };
}

function resolveKind(item: MenuLeaf, offerings: Offering[]): { kind: PageKind; offering: number | null } {
  if (item.kind === "service") {
    const i = item.offering ?? -1;
    if (i >= 0 && i < offerings.length) return { kind: "service", offering: i };
    return inferPageKind(item.label, offerings);
  }
  if (item.kind && item.kind !== "home") return { kind: item.kind, offering: null };
  return inferPageKind(item.label, offerings);
}

const SLUG_RULES: [RegExp, string][] = [
  [/오시는|찾아오|위치|약도/, "location"],
  [/매장\s*안내/, "store"],
  [/인사/, "greeting"],
  [/연혁/, "history"],
  [/의료진/, "doctors"],
  [/강사/, "teachers"],
  [/트레이너/, "trainers"],
  [/디자이너/, "designers"],
  [/구성원|팀|멤버/, "team"],
  [/자주\s*묻|faq/i, "faq"],
  [/공지/, "notice"],
  [/이벤트/, "events"],
  [/소식|뉴스/, "news"],
  [/후기|리뷰/, "reviews"],
  [/포트폴리오|작업물/, "portfolio"],
  [/갤러리/, "gallery"],
  [/시설|공간|둘러보기/, "facilities"],
  [/사례|실적/, "cases"],
  [/요금|가격|이용료/, "pricing"],
  [/블로그|칼럼/, "blog"],
  [/채용/, "careers"],
  [/예약/, "reservation"],
  [/견적/, "quote"],
  [/상담/, "consult"],
  [/문의|고객센터/, "contact"],
  [/진행|절차|이용\s*방법/, "process"],
  [/인증|특허/, "certificates"],
  [/관광|주변/, "nearby"],
  [/커뮤니티/, "community"],
  [/리소스/, "resources"],
  [/메뉴/, "menu"],
  [/객실/, "rooms"],
  [/상품|쇼핑/, "shop"],
  [/제품/, "products"],
  [/진료/, "treatments"],
  [/교육|과정|커리큘럼/, "courses"],
  [/프로그램|클래스/, "programs"],
  [/시술/, "services"],
  [/업무/, "practice"],
  [/솔루션/, "solutions"],
  [/서비스/, "services"],
  [/브랜드/, "brand"],
  [/소식|스토리|이야기/, "story"],
  [/회사|사무소|병원|학원|센터|스튜디오|숙소|소개/, "about"],
];

/** 이름으로 주소를 못 정할 때 쓰는 종류별 주소 */
const KIND_SLUG: Record<PageKind, string> = {
  home: "",
  about: "about",
  greeting: "greeting",
  history: "history",
  location: "location",
  services: "services",
  service: "service",
  products: "products",
  portfolio: "gallery",
  reviews: "reviews",
  team: "team",
  notice: "notice",
  faq: "faq",
  contact: "contact",
  reservation: "reservation",
  pricing: "pricing",
  cases: "cases",
  blog: "blog",
  careers: "careers",
  generic: "",
};

function pageSlug(label: string, kind: PageKind, offering: number | null, n: number, avoid?: string): string {
  const named = slugFor(label);
  if (named && named !== avoid) return named;
  if (offering !== null) return `item-${offering + 1}`;
  const byKind = KIND_SLUG[kind];
  if (byKind && byKind !== avoid) return byKind;
  return `page-${n}`;
}

function slugFor(label: string): string | null {
  const t = label.trim();
  const ascii = t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii && /^[ -~]+$/.test(t)) return ascii.slice(0, 40);
  for (const [re, slug] of SLUG_RULES) if (re.test(t)) return slug;
  return null;
}

// ---------------------------------------------------------------------------------------------
// 이미지 자리
// ---------------------------------------------------------------------------------------------

export type ImageRatio = "16:9" | "4:3" | "1:1" | "4:5";
export const RATIO_SIZE: Record<ImageRatio, string> = { "16:9": "1920×1080", "4:3": "1200×900", "1:1": "1080×1080", "4:5": "960×1200" };
export const RATIO_SHAPE: Record<ImageRatio, string> = { "16:9": "가로형", "4:3": "가로형", "1:1": "정사각형", "4:5": "세로형" };

export type ImageSlot = {
  id: string;
  /** 짧은 이름 (예: 메인 배너) */
  label: string;
  /** 어떤 이미지가 필요한지 — 빈 자리에 그대로 적힌다 */
  need: string;
  ratio: ImageRatio;
  /** 같은 설명으로 여러 장 (포트폴리오 6장 등) */
  count: number;
  /** ai: AI 로 만들 수 있는 자리 · real: 실제 사진이어야 하는 자리 (AI 로 만들지 않는다) */
  source: "ai" | "real";
  /** AI 로 만들기로 고른 자리. source 가 real 이면 항상 false */
  generate: boolean;
  /** 이 자리가 쓰이는 페이지 주소 (처음 나오는 순서) */
  pages: string[];
};

export type SlotOverride = { id: string; need?: string; generate?: boolean };

export type PlannedPage = {
  /** 사이트 안에서 고유. "/" 가 홈 */
  path: string;
  /** 메뉴에 보이는 이름 (예: 인사말) */
  label: string;
  /** 상위 메뉴 이름 (하위 페이지일 때, 예: 회사 소개) */
  group: string | null;
  kind: PageKind;
  /** 전문가 모드에서 적은 "이 페이지에 넣을 내용" */
  note: string;
  /** "서비스 하나 자세히" 페이지가 가리키는 서비스 번호 */
  offering: number | null;
  /** 이 페이지에 그려지는 이미지 자리 id (위에서 아래 순서) */
  slotIds: string[];
};

/** brief.site 에 저장되는 사이트 구성 계획 */
export type SitePlan = {
  version: 1;
  mode: "guided" | "expert";
  pages: PlannedPage[];
  images: ImageSlot[];
  imageGeneration: { enabled: boolean; tokensPerImage: number; estimatedTokens: number };
};

/** 화면·관리자·요청에 쓰는 페이지 전체 이름 (예: 회사 소개 › 인사말) */
export function pageFullName(p: Pick<PlannedPage, "label" | "group">): string {
  return p.group ? `${p.group} › ${p.label}` : p.label;
}

type SlotContext = { ind: Industry; offerings: Offering[]; siteName: string; tagline: string };

function offeringSlot(ctx: SlotContext, i: number): ImageSlot {
  const o = ctx.offerings[i];
  const real = ctx.ind.offeringSource === "real";
  const desc = o.description.trim();
  return {
    id: `offering:${i}`,
    label: `${o.name} ${real ? "사진" : "이미지"}`,
    need: real ? `실제 ${o.name} 사진${desc ? ` — ${desc}` : ""}` : `${josa(o.name, "을/를")} 한눈에 보여주는 이미지${desc ? ` (${desc})` : ""}`,
    ratio: "4:3",
    count: 1,
    source: real ? "real" : "ai",
    generate: false,
    pages: [],
  };
}

function pageSlots(page: PlannedPage, ctx: SlotContext): ImageSlot[] {
  const { ind } = ctx;
  const base = { count: 1, generate: false, pages: [] as string[] };
  const offeringIds = ctx.offerings.slice(0, 8).map((_, i) => offeringSlot(ctx, i));
  switch (page.kind) {
    case "home":
      return [
        {
          ...base,
          id: "hero",
          label: "메인 배너",
          need: `${ind.heroNeed}${ctx.tagline ? ` — "${ctx.tagline}" 느낌` : ""}`,
          ratio: "16:9",
          source: "ai",
        },
        ...offeringIds.slice(0, 6),
      ];
    case "about":
      return [{ ...base, id: "about", label: ind.about.label, need: ind.about.need, ratio: "4:3", source: ind.about.source }];
    case "greeting":
      return [{ ...base, id: "greeting", label: "대표 사진", need: "대표자 프로필 사진 — 상반신, 정면, 밝은 배경 (인사말 옆에 들어가요)", ratio: "4:5", source: "real" }];
    case "location":
      return [{ ...base, id: "exterior", label: "건물·입구 사진", need: "건물 외관이나 입구 사진 — 처음 오는 분이 찾기 쉽게 간판이 보이게", ratio: "4:3", source: "real" }];
    case "services":
    case "products":
      return offeringIds;
    case "service":
      if (page.offering !== null && page.offering < ctx.offerings.length) return [offeringSlot(ctx, page.offering)];
      return [{ ...base, id: `page:${page.path}`, label: `${page.label} 이미지`, need: `${josa(page.label, "을/를")} 보여주는 이미지`, ratio: "16:9", source: "ai" }];
    case "portfolio":
      return [{ ...base, id: `gallery:${page.path}`, label: `${page.label} 사진`, need: `${ind.galleryNeed} — 6장 정도`, ratio: "1:1", count: 6, source: "real" }];
    case "team":
      return [{ ...base, id: `team:${page.path}`, label: `${page.label} 사진`, need: `${ind.teamNeed} — 같은 배경·같은 구도로 맞추면 좋아요`, ratio: "4:5", count: 4, source: "real" }];
    case "cases":
      return [{ ...base, id: `cases:${page.path}`, label: "사례 사진", need: "실제 고객 사례(작업 전후·현장) 사진", ratio: "4:3", count: 3, source: "real" }];
    case "careers":
      return [{ ...base, id: `careers:${page.path}`, label: "함께 일하는 모습", need: "팀이 함께 일하는 실제 모습 사진", ratio: "16:9", source: "real" }];
    case "generic":
      return [
        {
          ...base,
          id: `page:${page.path}`,
          label: `${page.label} 이미지`,
          need: `"${page.label}" 내용과 어울리는 이미지${page.note ? ` — ${page.note.slice(0, 80)}` : ""}`,
          ratio: "16:9",
          source: "ai",
        },
      ];
    default:
      return [];
  }
}

export type PlanInput = {
  mode: "guided" | "expert";
  siteName: string;
  business: BusinessInfo;
  menu: MenuNode[];
  homeNote: string;
  /** "AI로 이미지 만들기" 를 켰는지 */
  generate: boolean;
  overrides: SlotOverride[];
};

/**
 * 메뉴 → 실제 페이지 목록 + 이미지 자리 목록.
 * 위저드가 이미지 단계에서 미리 보여 줄 때와 서버가 프로젝트를 만들 때 같은 입력이면 같은 결과가 나온다.
 */
export function buildSitePlan(input: PlanInput): SitePlan {
  const offerings = input.business.offerings.filter((o) => o.name.trim());
  const ctx: SlotContext = { ind: industryOf(input.business.category), offerings, siteName: input.siteName, tagline: input.business.tagline.trim() };

  const pages: PlannedPage[] = [{ path: "/", label: "홈", group: null, kind: "home", note: input.homeNote.trim(), offering: null, slotIds: [] }];
  const used = new Set<string>(["/"]);
  const unique = (path: string) => {
    let p = path;
    for (let n = 2; used.has(p); n++) p = `${path}-${n}`;
    used.add(p);
    return p;
  };

  input.menu.forEach((m, mi) => {
    if (m.children.length > 0) {
      const g = slugFor(m.label) ?? `menu-${mi + 1}`;
      m.children.forEach((c, ci) => {
        const { kind, offering } = resolveKind(c, offerings);
        // "브랜드 › 브랜드 이야기" 처럼 묶음과 같은 주소가 나오면 종류로 정한다 (/brand/brand 대신 /brand/about)
        const slug = pageSlug(c.label, kind, offering, ci + 1, g);
        pages.push({ path: unique(`/${g}/${slug}`), label: c.label.trim(), group: m.label.trim(), kind, note: c.note.trim(), offering, slotIds: [] });
      });
    } else {
      const { kind, offering } = resolveKind(m, offerings);
      pages.push({ path: unique(`/${pageSlug(m.label, kind, offering, mi + 1)}`), label: m.label.trim(), group: null, kind, note: m.note.trim(), offering, slotIds: [] });
    }
  });

  const images = new Map<string, ImageSlot>();
  for (const page of pages) {
    for (const slot of pageSlots(page, ctx)) {
      const existing = images.get(slot.id);
      if (existing) existing.pages.push(page.path);
      else images.set(slot.id, { ...slot, pages: [page.path] });
      if (!page.slotIds.includes(slot.id)) page.slotIds.push(slot.id);
    }
  }

  const overrides = new Map(input.overrides.map((o) => [o.id, o]));
  for (const slot of images.values()) {
    const o = overrides.get(slot.id);
    const need = o?.need?.trim();
    if (need) slot.need = need.slice(0, 200);
    slot.generate = input.generate && slot.source === "ai" && (o?.generate ?? true);
  }

  const list = [...images.values()];
  return {
    version: 1,
    mode: input.mode,
    pages,
    images: list,
    imageGeneration: { enabled: input.generate, tokensPerImage: APPROX_TOKENS_PER_IMAGE, estimatedTokens: imageTokenEstimate(list) },
  };
}

/** AI 이미지 생성 요청의 글. 위저드에서 고른 자리와 편집기의 "AI로 만들기" 버튼이 같은 형식을 쓴다 */
export function imageRequestMessage(slot: Pick<ImageSlot, "label" | "need" | "ratio">): string {
  return `[AI 이미지 생성] ${slot.label}\n필요한 이미지: ${slot.need}\n권장 크기: ${RATIO_SIZE[slot.ratio]} (${slot.ratio} ${RATIO_SHAPE[slot.ratio]})`;
}

/** AI 로 만들기로 고른 이미지 장 수 */
export function generatedImageCount(images: ImageSlot[]): number {
  return images.reduce((n, s) => n + (s.generate ? s.count : 0), 0);
}

export function imageTokenEstimate(images: ImageSlot[]): number {
  return generatedImageCount(images) * APPROX_TOKENS_PER_IMAGE;
}

/** 비어 있게 될 자리 수 (장 단위) */
export function emptyImageCount(images: ImageSlot[]): number {
  return images.reduce((n, s) => n + (s.generate ? 0 : s.count), 0);
}

/** 실제 사진이 필요한 자리의 사진 수 — 고객이 직접 준비해야 하는 사진 (AI 로 만들지 않는 자리) */
export function realPhotoCount(images: ImageSlot[]): number {
  return images.reduce((n, s) => n + (s.source === "real" ? s.count : 0), 0);
}

/** 페이지 구성에서 자동으로 필요한 기능 */
export function featuresFromPages(pages: Pick<PlannedPage, "kind">[]): string[] {
  const out = new Set<string>();
  for (const p of pages) {
    const f = KIND_FEATURE[p.kind];
    if (f) out.add(f);
  }
  return [...out];
}

/** 헤더에 그릴 메뉴 (계획된 페이지에서 되살린다). 묶음의 주소는 첫 하위 페이지 */
export type HeaderMenu = { label: string; path: string; children: { label: string; path: string }[] };

export function headerMenu(pages: PlannedPage[]): HeaderMenu[] {
  const out: HeaderMenu[] = [];
  for (const p of pages) {
    if (p.kind === "home") continue;
    if (!p.group) {
      out.push({ label: p.label, path: p.path, children: [] });
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.children.length > 0 && last.label === p.group) last.children.push({ label: p.label, path: p.path });
    else out.push({ label: p.group, path: p.path, children: [{ label: p.label, path: p.path }] });
  }
  return out;
}

/** 메인 색 위에 올릴 글자색 (밝은 색이면 어두운 글자) */
export function contrastText(hex: string): "#0f172a" | "#ffffff" {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [R, G, B] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B > 0.45 ? "#0f172a" : "#ffffff";
}

/** 받침에 맞는 조사. 한글이 아니면 "을(를)" 처럼 둘 다 적는다 */
export function josa(word: string, pair: "을/를" | "이/가" | "은/는" | "와/과"): string {
  const w = word.trim();
  const [a, b] = pair.split("/");
  const code = w.charCodeAt(w.length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return `${w}${a}(${b})`;
  return `${w}${(code - 0xac00) % 28 ? a : b}`;
}
