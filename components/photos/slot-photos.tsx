"use client";

import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { COUNTS_EVENT } from "@/lib/use-live-counts";
import { cn } from "@/lib/utils";

export type PhotoItem = { name: string; url: string };

/**
 * 이미지 자리 하나의 사진: 올린 사진 미리보기 + 올리기 · 지우기.
 * 사진은 브라우저에서 2000px 이하 JPEG 로 줄여 한 장씩 보낸다 — 휴대폰 원본(10MB+)도 빨리 올라가고, 위치정보(EXIF)가 지워진다.
 * 여러 장을 올리면 마지막 장에서 한 번만 담당자에게 알림이 간다.
 */
export function SlotPhotos({
  projectId,
  slotId,
  label,
  count,
  photos,
  editable = true,
  size = "sm",
  className,
}: {
  projectId: string;
  slotId: string;
  label: string;
  /** 이 자리에 들어갈 사진 수 (올릴 수 있는 최대) */
  count: number;
  photos: PhotoItem[];
  editable?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const left = Math.max(0, count - photos.length);
  const thumb = size === "md" ? "size-20" : "size-14";

  async function upload(files: File[]) {
    setError(null);
    const list = files.slice(0, left);
    if (list.length === 0) return;
    let sent = 0;
    for (let i = 0; i < list.length; i++) {
      setBusy(list.length > 1 ? `${i + 1}/${list.length}장 올리는 중…` : "올리는 중…");
      let blob: Blob;
      try {
        blob = await shrink(list[i]);
      } catch {
        setError("이 사진은 열 수 없어요. JPG나 PNG 사진으로 올려 주세요. (아이폰 HEIC 사진은 '호환성 우선' 으로 찍거나 JPG 로 바꿔 주세요)");
        break;
      }
      const fd = new FormData();
      fd.set("slotId", slotId);
      fd.set("file", blob, "photo.jpg");
      if (i === list.length - 1) {
        fd.set("notify", "1");
        fd.set("count", String(sent + 1));
      }
      const res = await fetch(`/api/projects/${projectId}/photos`, { method: "POST", body: fd }).catch(() => null);
      if (!res || !res.ok) {
        const j = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(j?.error?.message ?? "사진을 올리지 못했어요. 잠시 후 다시 올려 주세요.");
        break;
      }
      sent += 1;
    }
    if (files.length > list.length) setError(`이 자리는 사진 ${count}장까지예요. ${list.length}장만 올렸어요.`);
    setBusy(null);
    if (sent > 0) {
      window.dispatchEvent(new Event(COUNTS_EVENT));
      router.refresh();
    }
  }

  async function remove(name: string) {
    if (!window.confirm("이 사진을 지울까요?")) return;
    setError(null);
    setBusy("지우는 중…");
    const res = await fetch(`/api/projects/${projectId}/photos?name=${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setError("사진을 지우지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {photos.map((p, i) => (
            <li key={p.name} className={cn("group relative shrink-0 overflow-hidden rounded border border-ink-200 bg-ink-100", thumb)}>
              <a href={p.url} target="_blank" rel="noreferrer" title={`${label} ${i + 1} — 크게 보기`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 권한 확인 뒤 저장소로 넘겨주는 주소라 이미지 최적화를 거치지 않는다 */}
                <img src={p.url} alt={`${label} ${i + 1}`} className="size-full object-cover" loading="lazy" />
              </a>
              {editable ? (
                <button
                  type="button"
                  onClick={() => remove(p.name)}
                  disabled={busy !== null}
                  className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-night-950/80 text-white opacity-90 hover:bg-mark"
                  aria-label={`${label} ${i + 1} 지우기`}
                >
                  <XIcon className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {editable && left > 0 ? (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy !== null}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-ink-300 px-2.5 py-1 text-xs font-semibold text-ink-700 hover:border-ink-900 disabled:cursor-wait disabled:opacity-60",
              photos.length > 0 && "mt-1.5",
            )}
          >
            {busy ? <LoaderCircleIcon className="size-3 animate-spin" /> : <CameraIcon className="size-3" />}
            {busy ?? `사진 올리기${count > 1 ? ` (${photos.length}/${count}장)` : ""}`}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple={left > 1}
            hidden
            onChange={(e) => {
              const files = e.target.files ? [...e.target.files] : [];
              e.target.value = "";
              void upload(files);
            }}
          />
        </>
      ) : busy ? (
        <p className="mt-1 text-xs text-ink-500">{busy}</p>
      ) : null}
      {error ? <p className="mt-1 text-xs leading-relaxed text-mark">{error}</p> : null}
    </div>
  );
}

/** 2000px 이하 JPEG 로 줄인다. 투명한 부분은 흰색으로. 열 수 없는 형식(HEIC 등)이면 실패한다 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88));
}
