/**
 * 관리자 목록 — 사이트 주인이 관리자 페이지에서 직접 올리고 고치는 목록 (공지 · 소식 · 메뉴 · 상품 · 시공 사례 …).
 *
 * 목록 하나 = 사이트 전용 Supabase 프로젝트(lib/site-db)의 표 하나. 정의는 디자인 문서(brief.design.collections)에 두고,
 * AI 는 정해진 형식(collectionChanges)으로만 바꾼다 → 코드가 키 · 칸 종류를 다시 검사하고 → 표를 만드는 SQL 은 여기서 정해진 규칙으로만 만든다
 * (AI 가 SQL 을 쓰지 않는다). 표 · 칸은 늘어나기만 한다: 목록이나 칸을 빼면 화면 · 관리자 페이지에서 숨길 뿐 저장된 글은 지우지 않는다.
 * 이 파일은 브라우저 · 서버 어디서나 쓰는 순수 함수만 둔다.
 */

export const FIELD_TYPES = ["text", "longtext", "number", "date", "boolean", "url", "image", "email", "phone"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "짧은 글",
  longtext: "긴 글",
  number: "숫자",
  date: "날짜",
  boolean: "예/아니오",
  url: "링크",
  image: "사진 주소",
  email: "이메일",
  phone: "전화번호",
};

const SQL_TYPE: Record<FieldType, string> = {
  text: "text",
  longtext: "text",
  number: "numeric",
  date: "date",
  boolean: "boolean",
  url: "text",
  image: "text",
  email: "text",
  phone: "text",
};

export const LIST_LAYOUTS = ["list", "cards"] as const;
export type ListLayout = (typeof LIST_LAYOUTS)[number];
export const LIST_LAYOUT_LABEL: Record<ListLayout, string> = { list: "게시판형", cards: "카드형" };

export type CollectionField = { key: string; label: string; type: FieldType };
/** page = 이 목록을 보여 줄 페이지 주소 (null 이면 관리자 페이지에만). 페이지 하나에 목록 하나 */
export type Collection = { key: string; label: string; page: string | null; layout: ListLayout; fields: CollectionField[] };

export const COLLECTION_LIMITS = { collections: 10, fields: 20, label: 20, text: 200, longtext: 5000, url: 500 } as const;

/** 모든 표에 자동으로 있는 칸 (AI · 사이트 주인이 정하지 않는다) */
export const BASE_COLUMNS = ["id", "created_at", "updated_at", "published", "sort"] as const;

/** 만든 적 있는 표 · 칸과 그 종류 (사이트 DB 에 실제로 있는 것). 늘어나기만 한다 */
export type SchemaSnapshot = Record<string, Record<string, FieldType>>;

/** 관리자 페이지 · 초안이 읽는 한 줄 */
export type CollectionRow = { id: string; created_at: string; updated_at?: string; published: boolean; sort: number; [key: string]: unknown };

const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const RESERVED = new Set<string>([...BASE_COLUMNS, "pf_meta"]);

/** 표 · 칸 이름: 영어 소문자로 시작 · 소문자 · 숫자 · 밑줄 · 40자까지 · 자동 칸 이름과 pg_ 로 시작하는 이름은 안 된다 */
export function isValidKey(k: unknown): k is string {
  return typeof k === "string" && KEY.test(k) && !k.startsWith("pg_") && !RESERVED.has(k);
}

export function isFieldType(t: unknown): t is FieldType {
  return typeof t === "string" && (FIELD_TYPES as readonly string[]).includes(t);
}

/** 표의 칸 종류가 같은지 (짧은 글 · 긴 글 · 링크 · 사진 주소 · 이메일 · 전화번호는 모두 글 칸이라 서로 바꿀 수 있다) */
export function sameColumn(a: FieldType, b: FieldType): boolean {
  return SQL_TYPE[a] === SQL_TYPE[b];
}

/** 이름 (관리자 페이지 메뉴 · 칸 제목): 꺾쇠 · 제어 문자를 지우고 자른다 */
export function cleanLabel(s: unknown, max: number = COLLECTION_LIMITS.label): string {
  if (typeof s !== "string") return "";
  const cleaned = s
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...cleaned].slice(0, max).join("");
}

/** 저장된 목록 정의를 안전하게 읽는다 (사이트 주인이 brief 를 직접 고칠 수도 있으므로 모든 값을 다시 검사한다) */
export function sanitizeCollections(raw: unknown): Collection[] {
  if (!Array.isArray(raw)) return [];
  const out: Collection[] = [];
  const pages = new Set<string>();
  for (const c of raw) {
    if (out.length >= COLLECTION_LIMITS.collections) break;
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (!isValidKey(o.key) || out.some((x) => x.key === o.key)) continue;
    const fields: CollectionField[] = [];
    for (const f of Array.isArray(o.fields) ? o.fields : []) {
      if (fields.length >= COLLECTION_LIMITS.fields) break;
      const fo = (f ?? {}) as Record<string, unknown>;
      if (!isValidKey(fo.key) || !isFieldType(fo.type) || fields.some((x) => x.key === fo.key)) continue;
      fields.push({ key: fo.key, label: cleanLabel(fo.label) || fo.key, type: fo.type });
    }
    if (!fields.length) continue;
    let page = typeof o.page === "string" && o.page.startsWith("/") ? o.page.slice(0, 200) : null;
    if (page && pages.has(page)) page = null;
    if (page) pages.add(page);
    out.push({
      key: o.key,
      label: cleanLabel(o.label) || o.key,
      page,
      layout: (LIST_LAYOUTS as readonly unknown[]).includes(o.layout) ? (o.layout as ListLayout) : "list",
      fields,
    });
  }
  return out;
}

/** 목록 한 줄 요약 (바뀐 값 표시 · 대화) */
export function describeCollection(c: Collection): string {
  return `${c.label} (${c.fields.map((f) => f.label).join(" · ")} · ${LIST_LAYOUT_LABEL[c.layout]}${c.page ? ` · ${c.page} 페이지` : " · 관리자 페이지에만"})`;
}

/** AI 가 보낸 바꿀 목록 (lib/ai/schemas.ts EditOutput.collectionChanges) */
export type CollectionChangeInput = {
  key: string;
  label: string;
  page: string;
  layout: string;
  remove: boolean;
  fields: { key: string; label: string; type: string }[];
};

/** 바뀐 목록. before · after 는 describeCollection 글 (만들었으면 before 가, 숨겼으면 after 가 빈 글자) */
export type CollectionApplied = { key: string; before: string; after: string };

/**
 * 바꿀 목록을 검사해 새 정의를 만든다. 잘못된 키 · 종류, 없는 페이지, 이미 있는 칸의 종류 바꾸기는 버리고(rejected 에 이유),
 * 실제로 바뀐 것만 applied 에 남긴다. known = 사이트 DB 에 이미 있는 표 · 칸 (종류를 바꿀 수 없다).
 */
export function applyCollectionChanges(
  current: Collection[],
  changes: CollectionChangeInput[],
  pagePaths: readonly string[],
  known: SchemaSnapshot,
): { collections: Collection[]; applied: CollectionApplied[]; rejected: string[] } {
  let list = current.map((c) => ({ ...c, fields: [...c.fields] }));
  const applied: CollectionApplied[] = [];
  const rejected: string[] = [];

  for (const ch of changes) {
    const key = typeof ch.key === "string" ? ch.key.trim() : "";
    if (!isValidKey(key)) {
      rejected.push(`목록 키 ${ch.key}`);
      continue;
    }
    const existing = list.find((c) => c.key === key);
    if (ch.remove) {
      if (existing) {
        list = list.filter((c) => c.key !== key);
        applied.push({ key, before: describeCollection(existing), after: "" });
      }
      continue;
    }
    if (!existing && list.length >= COLLECTION_LIMITS.collections) {
      rejected.push(`${key}: 목록은 ${COLLECTION_LIMITS.collections}개까지`);
      continue;
    }

    const fields: CollectionField[] = [];
    for (const f of ch.fields ?? []) {
      const fk = typeof f.key === "string" ? f.key.trim() : "";
      if (!isValidKey(fk)) {
        rejected.push(`${key}.${f.key}: 칸 키`);
        continue;
      }
      if (!isFieldType(f.type)) {
        rejected.push(`${key}.${fk}: 칸 종류 ${f.type}`);
        continue;
      }
      if (fields.some((x) => x.key === fk)) continue;
      const was = known[key]?.[fk] ?? existing?.fields.find((x) => x.key === fk)?.type;
      if (was && !sameColumn(was, f.type)) {
        rejected.push(`${key}.${fk}: 이미 있는 칸의 종류(${FIELD_TYPE_LABEL[was]})는 바꿀 수 없음`);
        fields.push({ key: fk, label: cleanLabel(f.label) || fk, type: was });
        continue;
      }
      if (fields.length >= COLLECTION_LIMITS.fields) {
        rejected.push(`${key}: 칸은 ${COLLECTION_LIMITS.fields}개까지`);
        break;
      }
      fields.push({ key: fk, label: cleanLabel(f.label) || fk, type: f.type });
    }
    if (!fields.length) {
      rejected.push(`${key}: 칸이 없는 목록`);
      continue;
    }

    const wantPage = typeof ch.page === "string" ? ch.page.trim() : "";
    // 이미 있는 목록을 바꾸며 페이지를 비워 보냈으면 원래 페이지 그대로
    let page: string | null = existing && !wantPage ? existing.page : null;
    if (wantPage) {
      if (!pagePaths.includes(wantPage)) rejected.push(`${key}: 없는 페이지 ${wantPage}`);
      else if (list.some((c) => c.key !== key && c.page === wantPage)) rejected.push(`${key}: ${wantPage} 페이지에는 이미 다른 목록이 있음`);
      else page = wantPage;
    }
    const layout: ListLayout = (LIST_LAYOUTS as readonly string[]).includes(ch.layout) ? (ch.layout as ListLayout) : (existing?.layout ?? "list");
    const next: Collection = { key, label: cleanLabel(ch.label) || existing?.label || key, page, layout, fields };
    const before = existing ? describeCollection(existing) : "";
    const after = describeCollection(next);
    if (before === after && existing?.fields.every((f, i) => f.type === next.fields[i]?.type)) continue;
    list = existing ? list.map((c) => (c.key === key ? next : c)) : [...list, next];
    applied.push({ key, before, after });
  }
  return { collections: list, applied, rejected };
}

// ---------------------------------------------------------------------------------------------
// 표 만들기 SQL (사이트 DB). 정해진 규칙으로만 만든다 — 이름은 isValidKey 를 통과한 것만, 종류는 정해진 목록만
// ---------------------------------------------------------------------------------------------

const ident = (k: string) => `"${k}"`;
/** SQL 글자 (주석에만 쓴다). 작은따옴표를 두 번 쓰고 제어 문자를 지운다 */
const lit = (s: string) => `'${s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/'/g, "''")}'`;

/**
 * 원하는 목록 정의 → 사이트 DB 에 실행할 SQL 과 실행 뒤의 표 · 칸 목록.
 * 새 표는 기본 칸 + 공개된 줄만 누구나 읽는 규칙(RLS)과 함께 만들고, 새 칸은 add column 으로 더한다. 지우거나 종류를 바꾸지 않는다.
 * 같은 SQL 을 다시 실행해도 결과가 같다 (if not exists). 바꿀 것이 없으면 statements 가 비어 있다.
 */
export function planSchemaSync(desired: Collection[], known: SchemaSnapshot): { statements: string[]; next: SchemaSnapshot } {
  const next: SchemaSnapshot = Object.fromEntries(Object.entries(known).map(([t, cols]) => [t, { ...cols }]));
  const statements: string[] = [];
  for (const c of desired) {
    if (!isValidKey(c.key)) continue;
    const t = `public.${ident(c.key)}`;
    const isNew = !next[c.key];
    const added: CollectionField[] = [];
    for (const f of c.fields) {
      if (!isValidKey(f.key) || !isFieldType(f.type)) continue;
      if (next[c.key]?.[f.key]) continue;
      added.push(f);
    }
    if (!isNew && !added.length) continue;
    if (isNew) {
      statements.push(
        `create table if not exists ${t} (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published boolean not null default true, sort integer not null default 0)`,
        `alter table ${t} enable row level security`,
        `drop policy if exists pf_public_read on ${t}`,
        `create policy pf_public_read on ${t} for select to anon, authenticated using (published)`,
        `grant select on table ${t} to anon, authenticated`,
        `grant select, insert, update, delete on table ${t} to service_role`,
      );
      next[c.key] = {};
    }
    statements.push(`comment on table ${t} is ${lit(c.label)}`);
    for (const f of added) {
      statements.push(`alter table ${t} add column if not exists ${ident(f.key)} ${SQL_TYPE[f.type]}`, `comment on column ${t}.${ident(f.key)} is ${lit(f.label)}`);
      next[c.key][f.key] = f.type;
    }
  }
  if (statements.length) statements.push(`notify pgrst, 'reload schema'`);
  return { statements, next };
}

/** 한 번에 실행할 SQL (한 트랜잭션) */
export function toSqlScript(statements: string[]): string {
  return ["begin;", ...statements.map((s) => `${s};`), "commit;"].join("\n");
}

// ---------------------------------------------------------------------------------------------
// 관리자 페이지 입력값
// ---------------------------------------------------------------------------------------------

export type CellValue = string | number | boolean | null;

/** 관리자 페이지 폼 값 → 표에 넣을 값. 첫 칸(목록의 제목)은 꼭 있어야 한다 */
export function coerceRow(c: Collection, input: Record<string, unknown>): { values: Record<string, CellValue>; errors: string[] } {
  const values: Record<string, CellValue> = {};
  const errors: string[] = [];
  c.fields.forEach((f, i) => {
    const raw = input[f.key];
    const s = typeof raw === "string" ? raw.trim() : raw === true ? "true" : "";
    if (f.type === "boolean") {
      values[f.key] = raw === true || s === "on" || s === "true";
      return;
    }
    if (!s) {
      if (i === 0) errors.push(`${f.label}을(를) 입력해 주세요.`);
      values[f.key] = null;
      return;
    }
    switch (f.type) {
      case "text":
        values[f.key] = [...s].slice(0, COLLECTION_LIMITS.text).join("");
        break;
      case "longtext":
        values[f.key] = [...s].slice(0, COLLECTION_LIMITS.longtext).join("");
        break;
      case "number": {
        const n = Number(s.replace(/,/g, ""));
        if (!Number.isFinite(n) || Math.abs(n) >= 1e12) errors.push(`${f.label}은(는) 숫자로 입력해 주세요.`);
        else values[f.key] = n;
        break;
      }
      case "date": {
        const ok = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
        if (!ok) errors.push(`${f.label}은(는) 날짜(YYYY-MM-DD)로 입력해 주세요.`);
        else values[f.key] = s;
        break;
      }
      case "url":
      case "image": {
        let ok = false;
        try {
          const u = new URL(s);
          ok = (u.protocol === "https:" || u.protocol === "http:") && s.length <= COLLECTION_LIMITS.url;
        } catch {
          ok = false;
        }
        if (!ok) errors.push(`${f.label}은(는) http:// 또는 https:// 로 시작하는 주소로 입력해 주세요.`);
        else values[f.key] = s;
        break;
      }
      case "email":
        if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(s)) errors.push(`${f.label}은(는) 이메일 형식으로 입력해 주세요.`);
        else values[f.key] = s;
        break;
      case "phone":
        if (!/^[0-9+\-() ]{2,30}$/.test(s)) errors.push(`${f.label}은(는) 숫자와 - 로 입력해 주세요.`);
        else values[f.key] = s;
        break;
    }
  });
  return { values, errors };
}

/** 칸 값을 한 줄 글로 (관리자 페이지 표 · 초안 목록) */
export function formatCell(type: FieldType, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (type === "boolean") return v === true ? "예" : "아니오";
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("ko-KR") : "";
  }
  if (type === "date") return String(v).slice(0, 10);
  return String(v).replace(/\s+/g, " ").trim();
}
