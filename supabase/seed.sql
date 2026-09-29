-- 템플릿 카탈로그 시드. 마이그레이션 적용 후 SQL Editor 에서 실행.
-- demo = 완성 디자인이 적용된 임시(데모) 사이트 1,000원, live = 실제 운영 중이며 소유자 동의를 받은 사이트 8,900원.
-- 썸네일·미리보기는 scripts/gen-samples.mjs 가 만든 public/samples 의 SVG 를 가리킨다.

insert into public.templates (slug, name, kind, category, description, price_krw, thumbnail_url, preview_urls, pages, owner_consent, owner_site_url)
values
  ('cafe-daily', '카페 데일리', 'demo', '카페 · 베이커리', '메뉴·매장 안내·리뷰 중심의 깔끔한 카페 홈페이지. 인스타그램 피드 영역 포함.', 1000, '/samples/tpl-cafe.svg',
   '["/samples/home-desktop.svg","/samples/about-desktop.svg","/samples/reviews-desktop.svg"]', '["홈","안내","리뷰","문의"]', false, null),
  ('clinic-care', '클리닉 케어', 'demo', '병원 · 클리닉', '진료 안내와 예약 문의에 초점을 맞춘 의료기관용 템플릿. 의료진 소개 섹션 포함.', 1000, '/samples/tpl-clinic.svg',
   '["/samples/home-desktop.svg","/samples/about-desktop.svg","/samples/home-mobile.svg"]', '["홈","안내","리뷰","문의"]', false, null),
  ('folio-minimal', '폴리오 미니멀', 'demo', '포트폴리오', '작업물을 큼직하게 보여주는 개인 포트폴리오. 프로젝트 상세 페이지 구성.', 1000, '/samples/tpl-portfolio.svg',
   '["/samples/home-desktop.svg","/samples/products-desktop.svg"]', '["홈","작업","소개","문의"]', false, null),
  ('shop-basic', '샵 베이직', 'demo', '쇼핑몰', '상품 목록·상세·장바구니 흐름을 갖춘 기본 쇼핑몰. 비즈니스 플랜 이상에서 결제 연동 가능.', 1000, '/samples/tpl-shop.svg',
   '["/samples/home-desktop.svg","/samples/products-desktop.svg","/samples/admin-desktop.svg"]', '["홈","상품","리뷰","관리자페이지"]', false, null),
  ('academy-plus', '아카데미 플러스', 'demo', '학원 · 교육', '커리큘럼·강사·수강 후기·상담 신청 폼으로 구성된 학원 템플릿.', 1000, '/samples/tpl-academy.svg',
   '["/samples/home-desktop.svg","/samples/about-desktop.svg","/samples/reviews-desktop.svg"]', '["홈","안내","리뷰","문의"]', false, null),
  ('space-interior', '스페이스 인테리어', 'demo', '부동산 · 인테리어', '시공 사례 갤러리와 견적 문의 중심의 인테리어 업체 템플릿.', 1000, '/samples/tpl-realestate.svg',
   '["/samples/home-desktop.svg","/samples/products-desktop.svg","/samples/contact-desktop.svg"]', '["홈","사례","안내","문의"]', false, null),
  ('fit-studio', '핏 스튜디오', 'demo', '피트니스', '프로그램·트레이너·회원권 안내로 구성. 모바일 우선 레이아웃.', 1000, '/samples/tpl-gym.svg',
   '["/samples/home-mobile.svg","/samples/home-desktop.svg","/samples/about-desktop.svg"]', '["홈","프로그램","리뷰","문의"]', false, null),
  ('table-restaurant', '테이블 레스토랑', 'demo', '레스토랑', '메뉴판·예약·매장 정보를 강조한 레스토랑 템플릿.', 1000, '/samples/tpl-restaurant.svg',
   '["/samples/home-desktop.svg","/samples/products-desktop.svg"]', '["홈","메뉴","안내","예약"]', false, null),
  -- 운영 사이트 (소유자 동의). URL 은 예시 — 실제 운영 시 동의서와 함께 교체
  ('law-office-live', '법률사무소 (운영 사이트)', 'live', '법률 · 세무', '실제 운영 중인 법률사무소 홈페이지의 구조와 디자인을 그대로 사용합니다. 상담 신청 흐름 검증 완료.', 8900, '/samples/tpl-law.svg',
   '["/samples/home-desktop.svg","/samples/about-desktop.svg","/samples/contact-desktop.svg"]', '["홈","업무분야","구성원","문의"]', true, 'https://example.com'),
  ('beauty-salon-live', '뷰티살롱 (운영 사이트)', 'live', '뷰티 · 네일', '실제 운영 중인 뷰티살롱 홈페이지. 예약 문의와 시술 갤러리가 검증된 구성입니다.', 8900, '/samples/tpl-beauty.svg',
   '["/samples/home-mobile.svg","/samples/home-desktop.svg","/samples/reviews-desktop.svg"]', '["홈","시술","리뷰","예약"]', true, 'https://example.com')
on conflict (slug) do nothing;
