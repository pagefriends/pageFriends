// 임시 이미지 생성. 실제 사진이 오면 public/placeholders/*.svg 를 같은 이름의 파일로 바꿔 끼우면 된다.
// 사용: node scripts/gen-placeholders.mjs
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "placeholders");
fs.mkdirSync(OUT, { recursive: true });

// 페이지프렌즈 팔레트만 쓴다 (네이비·파랑·하늘색·무채색)
const PALETTES = [
  ["#0b1220", "#1e3a8a"],
  ["#111a2e", "#2563eb"],
  ["#0c2a3d", "#0ea5e9"],
  ["#182440", "#38bdf8"],
  ["#1e293b", "#475569"],
  ["#0f172a", "#7dd3fc"],
  ["#1d4ed8", "#60a5fa"],
  ["#0284c7", "#bae6fd"],
];

const SIZES = {
  wide: [1600, 900],
  photo: [1200, 900],
  square: [1000, 1000],
  tall: [900, 1200],
  banner: [1800, 700],
  avatar: [400, 400],
  logo: [320, 120],
};

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function svg(kind, i) {
  const [w, h] = SIZES[kind];
  const [a, b] = PALETTES[i % PALETTES.length];
  const r = rand(i * 7 + w);
  const shapes = [];
  for (let k = 0; k < 6; k++) {
    const cx = Math.round(r() * w);
    const cy = Math.round(r() * h);
    const rad = Math.round((0.15 + r() * 0.35) * Math.min(w, h));
    shapes.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="#ffffff" opacity="${(0.04 + r() * 0.08).toFixed(2)}"/>`);
  }
  const label = `${kind} ${String(i).padStart(2, "0")}`;
  const fs_ = Math.round(Math.min(w, h) * 0.06);
  const text =
    kind === "logo"
      ? `<text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="Pretendard, Arial, sans-serif" font-weight="800" font-size="${Math.round(h * 0.42)}" fill="#ffffff" opacity="0.9">LOGO ${i}</text>`
      : `<text x="${Math.round(w * 0.04)}" y="${h - Math.round(h * 0.05)}" font-family="Pretendard, Arial, sans-serif" font-weight="600" font-size="${fs_}" fill="#ffffff" opacity="0.55">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
${shapes.join("\n")}
${text}
</svg>`;
}

const manifest = {};
for (const kind of Object.keys(SIZES)) {
  const n = kind === "logo" ? 12 : kind === "avatar" ? 12 : 12;
  manifest[kind] = [];
  for (let i = 1; i <= n; i++) {
    const name = `${kind}-${String(i).padStart(2, "0")}.svg`;
    fs.writeFileSync(path.join(OUT, name), svg(kind, i));
    manifest[kind].push({ src: `/placeholders/${name}`, width: SIZES[kind][0], height: SIZES[kind][1] });
  }
}
fs.writeFileSync(path.join(process.cwd(), "config", "placeholders.json"), JSON.stringify(manifest, null, 2));
console.log("placeholders:", Object.entries(manifest).map(([k, v]) => `${k}×${v.length}`).join(", "));
