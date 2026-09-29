/**
 * 샘플 캡처 이미지(SVG) 생성기.
 *
 * 왜 필요한가: 실제 AI 생성·캡처 파이프라인은 아직 연결하지 않았다(요청 저장 + 상태 흐름까지만). 편집 화면의
 * 드래그·줌·네모 그리기를 검증하려면 "긴 페이지 캡처" 이미지가 있어야 하므로 와이어프레임 형태의 SVG 를 만들어 둔다.
 * 실제 서비스에서는 project_pages.screenshots 에 캡처 URL 을 넣기만 하면 편집기는 그대로 동작한다.
 *
 * 실행: node scripts/gen-samples.mjs  →  public/samples/*.svg, config/samples.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "samples");
mkdirSync(outDir, { recursive: true });

const DEVICES = { mobile: 390, tablet: 820, desktop: 1440 };
const PAGES = {
  home: "홈",
  about: "안내",
  reviews: "리뷰",
  products: "상품",
  admin: "관리자페이지",
  contact: "문의",
};

const BLUE = "#2563eb";
const SKY = "#0ea5e9";
const INK = "#0f172a";
const G1 = "#f1f5f9";
const G2 = "#e2e8f0";
const G3 = "#cbd5e1";
const G4 = "#94a3b8";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** 섹션 빌더: 각 함수는 (y, w, cols) → { svg, height } */
function header(y, w, isMobile) {
  const h = 64;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#fff"/><line x1="0" y1="${y + h}" x2="${w}" y2="${y + h}" stroke="${G2}"/>`;
  s += `<rect x="24" y="${y + 22}" width="20" height="20" rx="3" fill="${BLUE}"/><text x="52" y="${y + 38}" font-size="16" font-weight="700" fill="${INK}">브랜드</text>`;
  if (isMobile) {
    s += `<rect x="${w - 48}" y="${y + 24}" width="24" height="3" fill="${INK}"/><rect x="${w - 48}" y="${y + 31}" width="24" height="3" fill="${INK}"/><rect x="${w - 48}" y="${y + 38}" width="24" height="3" fill="${INK}"/>`;
  } else {
    const items = ["홈", "안내", "리뷰", "상품", "문의"];
    items.forEach((t, i) => (s += `<text x="${w / 2 - 140 + i * 70}" y="${y + 38}" font-size="14" fill="#334155">${t}</text>`));
    s += `<rect x="${w - 140}" y="${y + 16}" width="116" height="32" rx="4" fill="${BLUE}"/><text x="${w - 82}" y="${y + 37}" font-size="13" fill="#fff" text-anchor="middle">상담 신청</text>`;
  }
  return { svg: s, height: h };
}

function hero(y, w, isMobile, title) {
  const h = isMobile ? 420 : 520;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#eff6ff"/>`;
  const tx = isMobile ? 24 : 96;
  const ty = y + (isMobile ? 90 : 150);
  const fs = isMobile ? 30 : 48;
  s += `<text x="${tx}" y="${ty}" font-size="${fs}" font-weight="800" fill="${INK}">${esc(title)}</text>`;
  s += `<text x="${tx}" y="${ty + fs + 8}" font-size="${fs}" font-weight="800" fill="${BLUE}">더 좋은 경험을 만듭니다</text>`;
  s += `<rect x="${tx}" y="${ty + fs * 2 + 20}" width="${isMobile ? w - 48 : 460}" height="12" rx="2" fill="${G3}"/><rect x="${tx}" y="${ty + fs * 2 + 44}" width="${isMobile ? w - 120 : 380}" height="12" rx="2" fill="${G3}"/>`;
  s += `<rect x="${tx}" y="${ty + fs * 2 + 84}" width="140" height="44" rx="4" fill="${BLUE}"/><text x="${tx + 70}" y="${ty + fs * 2 + 112}" font-size="15" fill="#fff" text-anchor="middle">시작하기</text>`;
  s += `<rect x="${tx + 156}" y="${ty + fs * 2 + 84}" width="140" height="44" rx="4" fill="#fff" stroke="${G3}"/><text x="${tx + 226}" y="${ty + fs * 2 + 112}" font-size="15" fill="${INK}" text-anchor="middle">더 알아보기</text>`;
  if (!isMobile) s += `<rect x="${w - 96 - 520}" y="${y + 90}" width="520" height="340" rx="6" fill="#fff" stroke="${G2}"/><rect x="${w - 96 - 500}" y="${y + 110}" width="480" height="200" rx="4" fill="#dbeafe"/>`;
  return { svg: s, height: h };
}

function cards(y, w, isMobile, count, label) {
  const cols = isMobile ? 1 : w > 1000 ? 3 : 2;
  const pad = isMobile ? 24 : 96;
  const gap = 24;
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols;
  const ch = 260;
  const rows = Math.ceil(count / cols);
  const h = 120 + rows * (ch + gap);
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#fff"/><text x="${pad}" y="${y + 60}" font-size="${isMobile ? 22 : 28}" font-weight="700" fill="${INK}">${esc(label)}</text>`;
  for (let i = 0; i < count; i++) {
    const cx = pad + (i % cols) * (cw + gap);
    const cy = y + 100 + Math.floor(i / cols) * (ch + gap);
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="6" fill="#fff" stroke="${G2}"/><rect x="${cx}" y="${cy}" width="${cw}" height="150" rx="6" fill="${i % 2 ? "#e0f2fe" : "#dbeafe"}"/><rect x="${cx + 16}" y="${cy + 170}" width="${cw * 0.6}" height="14" rx="2" fill="${INK}"/><rect x="${cx + 16}" y="${cy + 196}" width="${cw * 0.85}" height="10" rx="2" fill="${G3}"/><rect x="${cx + 16}" y="${cy + 214}" width="${cw * 0.5}" height="10" rx="2" fill="${G3}"/>`;
  }
  return { svg: s, height: h };
}

function textBlock(y, w, isMobile, title) {
  const pad = isMobile ? 24 : 96;
  const h = 360;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="${G1}"/><text x="${pad}" y="${y + 70}" font-size="${isMobile ? 22 : 28}" font-weight="700" fill="${INK}">${esc(title)}</text>`;
  const lw = w - pad * 2;
  for (let i = 0; i < 7; i++) s += `<rect x="${pad}" y="${y + 110 + i * 28}" width="${lw * (i % 3 === 2 ? 0.55 : 0.92)}" height="12" rx="2" fill="${G3}"/>`;
  return { svg: s, height: h };
}

function stats(y, w, isMobile) {
  const h = 200;
  const cols = isMobile ? 2 : 4;
  const pad = isMobile ? 24 : 96;
  const cw = (w - pad * 2) / cols;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="${BLUE}"/>`;
  for (let i = 0; i < cols; i++) {
    const cx = pad + i * cw + cw / 2;
    s += `<text x="${cx}" y="${y + 90}" font-size="36" font-weight="800" fill="#fff" text-anchor="middle">${[1200, 98, 24, 4.9][i % 4]}</text><text x="${cx}" y="${y + 125}" font-size="14" fill="#bfdbfe" text-anchor="middle">${["고객", "만족도 %", "시간 지원", "평점"][i % 4]}</text>`;
  }
  return { svg: s, height: h };
}

function reviews(y, w, isMobile, count) {
  const pad = isMobile ? 24 : 96;
  const cols = isMobile ? 1 : 2;
  const gap = 20;
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols;
  const ch = 150;
  const rows = Math.ceil(count / cols);
  const h = 120 + rows * (ch + gap);
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#fff"/><text x="${pad}" y="${y + 60}" font-size="${isMobile ? 22 : 28}" font-weight="700" fill="${INK}">고객 리뷰</text>`;
  for (let i = 0; i < count; i++) {
    const cx = pad + (i % cols) * (cw + gap);
    const cy = y + 100 + Math.floor(i / cols) * (ch + gap);
    s += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="6" fill="${G1}"/><circle cx="${cx + 36}" cy="${cy + 36}" r="18" fill="${G3}"/><rect x="${cx + 64}" y="${cy + 26}" width="120" height="12" rx="2" fill="${INK}"/><text x="${cx + 64}" y="${cy + 58}" font-size="13" fill="${SKY}">★★★★★</text>`;
    for (let j = 0; j < 3; j++) s += `<rect x="${cx + 20}" y="${cy + 80 + j * 20}" width="${cw * (j === 2 ? 0.5 : 0.85)}" height="10" rx="2" fill="${G3}"/>`;
  }
  return { svg: s, height: h };
}

function table(y, w, isMobile, rowsN, title) {
  const pad = isMobile ? 16 : 48;
  const h = 100 + 44 * (rowsN + 1) + 40;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#fff"/><text x="${pad}" y="${y + 50}" font-size="22" font-weight="700" fill="${INK}">${esc(title)}</text>`;
  const cols = isMobile ? 3 : 6;
  const cw = (w - pad * 2) / cols;
  const ty = y + 80;
  s += `<rect x="${pad}" y="${ty}" width="${w - pad * 2}" height="44" fill="${G1}"/>`;
  for (let r = 0; r <= rowsN; r++) {
    const ry = ty + r * 44;
    s += `<line x1="${pad}" y1="${ry + 44}" x2="${w - pad}" y2="${ry + 44}" stroke="${G2}"/>`;
    for (let c = 0; c < cols; c++) s += `<rect x="${pad + c * cw + 12}" y="${ry + 17}" width="${cw * (c === 0 ? 0.5 : 0.7)}" height="10" rx="2" fill="${r === 0 ? G4 : G3}"/>`;
  }
  return { svg: s, height: h };
}

function sidebarAdmin(y, w, isMobile, content) {
  // 관리자 페이지: 왼쪽 사이드바 + 오른쪽 콘텐츠
  const sw = isMobile ? 0 : 240;
  const h = content.height;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="${G1}"/>`;
  if (sw) {
    s += `<rect x="0" y="${y}" width="${sw}" height="${h}" fill="${INK}"/>`;
    ["대시보드", "주문", "상품", "회원", "리뷰", "설정"].forEach((t, i) => (s += `<text x="28" y="${y + 60 + i * 44}" font-size="14" fill="${i === 0 ? "#fff" : G4}">${t}</text>`));
  }
  s += `<g transform="translate(${sw},0)">${content.svg.replaceAll(`width="${w}"`, `width="${w - sw}"`)}</g>`;
  return { svg: s, height: h };
}

function footer(y, w, isMobile) {
  const h = isMobile ? 220 : 180;
  const pad = isMobile ? 24 : 96;
  let s = `<rect x="0" y="${y}" width="${w}" height="${h}" fill="${INK}"/><rect x="${pad}" y="${y + 40}" width="18" height="18" rx="3" fill="${SKY}"/><text x="${pad + 26}" y="${y + 55}" font-size="15" font-weight="700" fill="#fff">브랜드</text>`;
  for (let i = 0; i < 3; i++) s += `<rect x="${pad}" y="${y + 84 + i * 20}" width="${isMobile ? 200 : 320}" height="9" rx="2" fill="#475569"/>`;
  if (!isMobile) ["회사소개", "이용약관", "개인정보처리방침", "고객센터"].forEach((t, i) => (s += `<text x="${w - pad - 420 + i * 110}" y="${y + 55}" font-size="13" fill="${G4}">${t}</text>`));
  return { svg: s, height: h };
}

function buildPage(page, device) {
  const w = DEVICES[device];
  const isMobile = device === "mobile";
  const parts = [];
  let y = 0;
  const push = (p) => {
    parts.push(p.svg);
    y += p.height;
  };
  push(header(y, w, isMobile));
  switch (page) {
    case "home":
      push(hero(y, w, isMobile, "우리 브랜드는"));
      push(cards(y, w, isMobile, isMobile ? 3 : 6, "주요 서비스"));
      push(stats(y, w, isMobile));
      push(textBlock(y, w, isMobile, "왜 우리를 선택해야 할까요"));
      push(reviews(y, w, isMobile, isMobile ? 2 : 4));
      break;
    case "about":
      push(textBlock(y, w, isMobile, "안내"));
      push(cards(y, w, isMobile, isMobile ? 2 : 3, "이용 절차"));
      push(textBlock(y, w, isMobile, "오시는 길"));
      push(stats(y, w, isMobile));
      break;
    case "reviews":
      push(reviews(y, w, isMobile, isMobile ? 6 : 10));
      push(stats(y, w, isMobile));
      break;
    case "products":
      push(cards(y, w, isMobile, isMobile ? 6 : 12, "상품"));
      push(textBlock(y, w, isMobile, "배송 · 교환 안내"));
      break;
    case "contact":
      push(textBlock(y, w, isMobile, "문의하기"));
      push(cards(y, w, isMobile, isMobile ? 1 : 2, "연락처"));
      break;
    case "admin": {
      const inner = { svg: "", height: 0 };
      let iy = y;
      const t1 = table(iy, w - (isMobile ? 0 : 240), isMobile, 8, "최근 주문");
      inner.svg += t1.svg;
      iy += t1.height;
      const t2 = table(iy, w - (isMobile ? 0 : 240), isMobile, 6, "회원");
      inner.svg += t2.svg;
      iy += t2.height;
      inner.height = iy - y;
      push(sidebarAdmin(y, w, isMobile, inner));
      break;
    }
  }
  push(footer(y, w, isMobile));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${y}" viewBox="0 0 ${w} ${y}" font-family="Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"><rect width="${w}" height="${y}" fill="#fff"/>${parts.join("")}</svg>`;
  return { svg, width: w, height: y };
}

const manifest = {};
for (const page of Object.keys(PAGES)) {
  for (const device of Object.keys(DEVICES)) {
    const { svg, width, height } = buildPage(page, device);
    const file = `${page}-${device}.svg`;
    writeFileSync(join(outDir, file), svg);
    manifest[`${page}:${device}`] = { url: `/samples/${file}`, width, height };
  }
}

// 템플릿 썸네일 (800x600). 레이아웃 변형 몇 가지.
const THUMBS = [
  ["cafe", "카페 · 베이커리", "#dbeafe"],
  ["clinic", "병원 · 클리닉", "#e0f2fe"],
  ["portfolio", "포트폴리오", "#eff6ff"],
  ["shop", "쇼핑몰", "#dbeafe"],
  ["academy", "학원 · 교육", "#e0f2fe"],
  ["realestate", "부동산 · 인테리어", "#eff6ff"],
  ["gym", "피트니스", "#dbeafe"],
  ["restaurant", "레스토랑", "#e0f2fe"],
  ["law", "법률 · 세무", "#eff6ff"],
  ["beauty", "뷰티 · 네일", "#e0f2fe"],
];
THUMBS.forEach(([slug, label, bg], i) => {
  const w = 800;
  const h = 600;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Pretendard, 'Noto Sans KR', sans-serif"><rect width="${w}" height="${h}" fill="#fff"/>`;
  s += `<rect x="0" y="0" width="${w}" height="48" fill="#fff"/><line x1="0" y1="48" x2="${w}" y2="48" stroke="${G2}"/><rect x="24" y="16" width="16" height="16" rx="3" fill="${BLUE}"/>`;
  [0, 1, 2, 3].forEach((j) => (s += `<rect x="${w / 2 - 80 + j * 50}" y="20" width="32" height="8" rx="2" fill="${G3}"/>`));
  if (i % 3 === 0) {
    s += `<rect x="0" y="48" width="${w}" height="300" fill="${bg}"/><text x="60" y="160" font-size="40" font-weight="800" fill="${INK}">${esc(label)}</text><rect x="60" y="190" width="300" height="10" rx="2" fill="${G3}"/><rect x="60" y="240" width="120" height="40" rx="4" fill="${BLUE}"/>`;
    for (let c = 0; c < 3; c++) s += `<rect x="${60 + c * 235}" y="380" width="210" height="180" rx="6" fill="${G1}" stroke="${G2}"/>`;
  } else if (i % 3 === 1) {
    s += `<rect x="0" y="48" width="${w / 2}" height="552" fill="${bg}"/><text x="60" y="200" font-size="36" font-weight="800" fill="${INK}">${esc(label)}</text><rect x="60" y="230" width="260" height="10" rx="2" fill="${G3}"/><rect x="60" y="280" width="120" height="40" rx="4" fill="${BLUE}"/>`;
    for (let r = 0; r < 3; r++) s += `<rect x="${w / 2 + 40}" y="${90 + r * 165}" width="320" height="140" rx="6" fill="${G1}" stroke="${G2}"/>`;
  } else {
    s += `<rect x="60" y="90" width="680" height="240" rx="6" fill="${bg}"/><text x="${w / 2}" y="220" font-size="40" font-weight="800" fill="${INK}" text-anchor="middle">${esc(label)}</text>`;
    for (let c = 0; c < 4; c++) s += `<rect x="${60 + c * 172}" y="370" width="164" height="190" rx="6" fill="${G1}" stroke="${G2}"/>`;
  }
  s += `</svg>`;
  writeFileSync(join(outDir, `tpl-${slug}.svg`), s);
});

writeFileSync(join(root, "config", "samples.json"), JSON.stringify(manifest, null, 2));
console.log(`generated ${Object.keys(manifest).length} page samples + ${THUMBS.length} thumbnails → public/samples`);
