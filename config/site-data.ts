/**
 * 관리자 목록의 글 (공용 DB · lib/site-data.ts · 0013_site_records.sql) 설정. 바꿀 때는 여기만 고친다.
 *
 * 모든 사이트의 목록 글을 메인 DB 의 표 하나(site_records)에 사이트별로 저장한다 (2026-11-11 — 예전에는 사이트마다 Supabase 프로젝트).
 */

/** 관리자 페이지가 한 쪽에 보여 주는 글 수 */
export const SITE_DATA_PAGE_ROWS = 50;

/** 초안 그림의 목록이 보여 주는 줄 수 (게시판형 · 카드형) — 높이가 글 수와 상관없이 같도록 늘 이만큼 자리를 그린다 */
export const SITE_DATA_DRAFT_ROWS = { list: 5, cards: 3 } as const;

/** 목록 하나에 올릴 수 있는 글 수 (공용 DB 를 한 사이트가 다 쓰지 않게). 공지 · 상품 · 강의 목록에 넉넉한 양 */
export const SITE_DATA_MAX_ROWS = 2_000;
