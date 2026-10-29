/**
 * 사이트 전용 Supabase 프로젝트 (lib/site-db) 설정. 바꿀 때는 여기만 고친다.
 *
 * 고객이 사이트를 만들면 그 사이트만 쓰는 Supabase 프로젝트를 하나 만든다. AI 가 "관리자 목록" 을 만들면 그 프로젝트에 표가 생기고,
 * 사이트 주인은 관리자 페이지(/projects/[id]/admin)에서 글을 올리고 고친다.
 * 프로젝트는 우리 Supabase 조직에 만든다 — 조직이 무료면 계정당 2개까지라 운영에서는 Pro 조직이어야 한다 (프로젝트마다 Micro $10/월).
 */

/** 지역을 정하지 않으면 서울 */
export const SITE_DB_REGION_DEFAULT = "ap-northeast-2";

/** 프로젝트 이름 앞에 붙인다 (대시보드에서 찾기 쉽게 · 만들다 끊긴 프로젝트를 다시 찾을 때 이름으로 찾는다) */
export const SITE_DB_NAME_PREFIX = "pf-";

/** 프로젝트가 준비될 때까지(보통 1~3분) 사이트를 만든 뒤 백그라운드에서 기다리는 시간 */
export const SITE_DB_BUILD_WAIT_MS = 4 * 60_000;

/** AI 가 관리자 목록을 바꿀 때 프로젝트 준비를 기다리는 시간. 넘으면 담당자에게 넘긴다 */
export const SITE_DB_AI_WAIT_MS = 150_000;

/** 준비 상태를 다시 확인하는 간격 */
export const SITE_DB_POLL_MS = 6_000;

/** "만드는 중" 인 채로 이 시간이 지나면 끊긴 것으로 보고 다시 시도할 수 있게 한다 */
export const SITE_DB_STALE_CREATING_MS = 10 * 60_000;

/** 관리자 페이지 · 초안이 한 번에 읽는 줄 수 */
export const SITE_DB_PAGE_ROWS = 50;

/** 초안 그림의 목록이 보여 주는 줄 수 (게시판형 · 카드형) — 높이가 글 수와 상관없이 같도록 늘 이만큼 자리를 그린다 */
export const SITE_DB_DRAFT_ROWS = { list: 5, cards: 3 } as const;

/** 관리자 화면의 비용 안내 (Supabase Pro 조직의 Micro 컴퓨트) */
export const SITE_DB_MONTHLY_USD = 10;
