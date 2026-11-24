import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 고객이 올린 실제 사진 (이미지 자리 채우기).
 *
 * Supabase Storage 의 비공개 버킷에 서비스 롤로만 넣고 꺼낸다 — 저장소 정책(RLS)을 따로 만들지 않아도 되도록,
 * 권한 확인은 우리 서버(라우트)가 사이트 주인·관리자인지 RLS 로 프로젝트를 읽어 보는 것으로 한다.
 * DB 테이블 없이 파일 이름이 곧 기록이다: `{projectId}/{자리 id(base64url)}.{uuid}` (저장소는 키에 "~" 같은 글자를 받지 않는다).
 * 브라우저가 사진을 2000px 이하 JPEG 로 줄여서 보낸다 (용량 · 위치정보(EXIF) 제거 · 휴대폰 사진 회전 정리).
 */

export const PHOTO_BUCKET = "site-photos";
/** 한 장 최대 크기. 브라우저가 줄여 보내므로 보통 1~2MB */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type SitePhoto = { name: string; slotId: string; url: string; createdAt: string };

const NAME_RE = /^([A-Za-z0-9_-]+)\.([0-9a-f-]{36})$/;

const slotKey = (slotId: string) => Buffer.from(slotId, "utf8").toString("base64url");

function slotIdOf(key: string): string | null {
  try {
    return Buffer.from(key, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

export function isPhotoName(name: string): boolean {
  return NAME_RE.test(name);
}

/** 화면에서 쓰는 사진 주소. 권한을 확인한 뒤 잠깐 쓸 수 있는 저장소 주소로 넘겨준다 (app/api/projects/[id]/photos/[name]) */
export function photoUrl(projectId: string, name: string): string {
  return `/api/projects/${projectId}/photos/${name}`;
}

let bucketReady = false;

async function ensureBucket(sb: SupabaseClient): Promise<void> {
  if (bucketReady) return;
  const { data } = await sb.storage.getBucket(PHOTO_BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(PHOTO_BUCKET, {
      public: false,
      fileSizeLimit: MAX_PHOTO_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    });
    if (error && !/exist/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

/** 프로젝트에 올린 사진 (자리 id 별, 올린 순서). 저장소를 아직 만들지 않았거나 사진이 없으면 빈 목록 */
export async function listProjectPhotos(projectId: string): Promise<Record<string, SitePhoto[]>> {
  const sb = createAdminClient();
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).list(projectId, { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return {};
  const out: Record<string, SitePhoto[]> = {};
  for (const f of data) {
    const m = NAME_RE.exec(f.name);
    const slotId = m ? slotIdOf(m[1]) : null;
    if (!slotId) continue;
    (out[slotId] ??= []).push({ name: f.name, slotId, url: photoUrl(projectId, f.name), createdAt: f.created_at ?? "" });
  }
  return out;
}

/** 내용 첫 바이트로 형식을 확인한다 (파일 이름 · 브라우저가 알려 준 형식은 믿지 않는다) */
export function sniffImage(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const ascii = (a: number, b: number) => String.fromCharCode(...buf.subarray(a, b));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function uploadPhoto(projectId: string, slotId: string, bytes: Uint8Array, contentType: string): Promise<SitePhoto> {
  const sb = createAdminClient();
  await ensureBucket(sb);
  const name = `${slotKey(slotId)}.${randomUUID()}`;
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(`${projectId}/${name}`, bytes, { contentType, upsert: false, cacheControl: "3600" });
  if (error) throw error;
  return { name, slotId, url: photoUrl(projectId, name), createdAt: new Date().toISOString() };
}

export async function deletePhoto(projectId: string, name: string): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.storage.from(PHOTO_BUCKET).remove([`${projectId}/${name}`]);
  if (error) throw error;
}

/** 잠깐 쓸 수 있는 저장소 주소 (기본 1시간) */
export async function signedPhotoUrl(projectId: string, name: string, seconds = 3600): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(`${projectId}/${name}`, seconds);
  return data?.signedUrl ?? null;
}

/** 자리마다 올린 사진 수 */
export function photoCounts(photos: Record<string, SitePhoto[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(photos).map(([k, v]) => [k, v.length]));
}

/** 바꾼 사진을 잠깐 넣어 두는 폴더 (되돌리기용). 목록(listProjectPhotos)은 이 폴더를 보지 않는다 */
const OLD_DIR = "old";

/**
 * 자리의 사진을 새 사진 한 장으로 바꾼다 (AI 가 만든 사진 · 로고). 있던 사진은 지우지 않고 old 폴더로 옮겨 두어
 * 오류 신고의 되돌리기가 다시 꺼낼 수 있게 한다. 돌려주는 moved 는 옮긴 사진 이름들.
 */
export async function replaceSlotPhoto(projectId: string, slotId: string, bytes: Uint8Array, contentType: string): Promise<{ photo: SitePhoto; moved: string[] }> {
  const sb = createAdminClient();
  await ensureBucket(sb);
  const before = (await listProjectPhotos(projectId))[slotId] ?? [];
  const moved: string[] = [];
  for (const p of before) {
    const { error } = await sb.storage.from(PHOTO_BUCKET).move(`${projectId}/${p.name}`, `${projectId}/${OLD_DIR}/${p.name}`);
    if (!error) moved.push(p.name);
    else console.error("[photos] move old", error.message);
  }
  const photo = await uploadPhoto(projectId, slotId, bytes, contentType);
  return { photo, moved };
}

/** replaceSlotPhoto 되돌리기: 새 사진을 old 로 보내고 옮겨 둔 사진을 제자리로 */
export async function restoreSlotPhotos(projectId: string, added: string, moved: string[]): Promise<boolean> {
  const sb = createAdminClient();
  const store = sb.storage.from(PHOTO_BUCKET);
  if (added && isPhotoName(added)) {
    const { error } = await store.move(`${projectId}/${added}`, `${projectId}/${OLD_DIR}/${added}`);
    if (error) return false;
  }
  for (const name of moved.filter(isPhotoName)) {
    const { error } = await store.move(`${projectId}/${OLD_DIR}/${name}`, `${projectId}/${name}`);
    if (error) console.error("[photos] restore", error.message);
  }
  return true;
}
