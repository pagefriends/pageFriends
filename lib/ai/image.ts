import "server-only";

import type { ImageRatio, ImageSlot } from "@/lib/site-plan";
import type { ProjectBrief } from "@/lib/types/db";

/**
 * 사진 · 로고 만들기 (OpenAI 이미지 API). 문구 · 구성은 Claude 가, 그림은 GPT 이미지 모델이 그린다 (2026-11-24 사용자 결정).
 *
 * - OPENAI_API_KEY 가 없으면 부르지 않는다 (imageConfigured). 모델은 OPENAI_IMAGE_MODEL (기본 gpt-image-2).
 * - 실제 사진이어야 하는 자리(대표 · 구성원 · 건물 · 작업물)는 만들지 않는다 — 가짜 사진이 손님을 속이게 된다 (lib/site-plan.ts source=real).
 * - 결과는 이미지 자리의 사진으로 저장한다 (lib/photos.ts replaceSlotPhoto). 편집 화면이 그 자리 위에 겹쳐 보여 준다.
 */

export const IMAGE_MODEL_DEFAULT = "gpt-image-2";
/** 로고 자리 id. 머리 메뉴 왼쪽의 네모 (lib/draft-render.ts header) */
export const LOGO_SLOT_ID = "logo";

export function imageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) && process.env.AI_ENGINE !== "off";
}

const SIZE: Record<ImageRatio, string> = { "16:9": "1536x1024", "4:3": "1536x1024", "1:1": "1024x1024", "4:5": "1024x1536" };

export type ImageResult =
  | { ok: true; bytes: Uint8Array; contentType: "image/jpeg" | "image/png"; model: string; durationMs: number }
  | { ok: false; error: string; refused: boolean; durationMs: number };

/** 그림 한 장. 보통 15~60초 */
export async function generateImage(input: { prompt: string; ratio: ImageRatio; logo?: boolean }): Promise<ImageResult> {
  const started = Date.now();
  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || IMAGE_MODEL_DEFAULT;
  const format = input.logo ? "png" : "jpeg";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim()}` },
      body: JSON.stringify({
        model,
        prompt: input.prompt.slice(0, 4000),
        n: 1,
        size: SIZE[input.ratio],
        quality: "medium",
        output_format: format,
        ...(format === "jpeg" ? { output_compression: 85 } : {}),
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string; code?: string } } | null;
    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      const refused = json?.error?.code === "moderation_blocked" || /safety|moderation/i.test(msg);
      return { ok: false, error: msg.slice(0, 500), refused, durationMs: Date.now() - started };
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: "그림이 오지 않았습니다.", refused: false, durationMs: Date.now() - started };
    return { ok: true, bytes: new Uint8Array(Buffer.from(b64, "base64")), contentType: format === "png" ? "image/png" : "image/jpeg", model, durationMs: Date.now() - started };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 500) : String(e), refused: false, durationMs: Date.now() - started };
  }
}

/** 사이트 정보 → 그림 설명 앞부분 (업종 · 분위기 · 색) */
function siteContext(brief: ProjectBrief): string {
  const b = brief.business;
  const parts = [
    `Website: "${brief.siteName}"${brief.industry ? ` (${brief.industry})` : ""}.`,
    b?.tagline ? `Tagline: ${b.tagline}.` : "",
    b?.offerings?.length ? `Offers: ${b.offerings.map((o) => o.name).filter(Boolean).slice(0, 6).join(", ")}.` : "",
    `Brand color: ${brief.design?.theme.primary ?? brief.primaryColor}.`,
    brief.styleTags?.length ? `Style: ${brief.styleTags.join(", ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** 이미지 자리 사진의 그림 설명. request: 고객 요청 · AI 가 덧붙인 설명 */
export function photoPrompt(brief: ProjectBrief, slot: Pick<ImageSlot, "label" | "need" | "ratio">, request: string): string {
  return [
    "A high-quality photograph-style image for a Korean small-business website.",
    siteContext(brief),
    `Image spot: ${slot.label} — ${slot.need}.`,
    request.trim() ? `Customer request: ${request.trim()}` : "",
    "Natural light, clean composition, realistic, suitable for a website banner or card.",
    "Do not include any text, letters, logos, watermarks, or recognizable real people's faces. No fake storefront signs.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** 로고 그림 설명. 글자는 잘못 그려지기 쉬워 기본은 기호만 */
export function logoPrompt(brief: ProjectBrief, request: string): string {
  return [
    "A simple, modern logo mark (symbol only) for a small business website, centered on a plain white background.",
    siteContext(brief),
    request.trim() ? `Customer request: ${request.trim()}` : "",
    "Flat vector style, 1-2 colors based on the brand color, bold and readable at small sizes (36px), generous padding.",
    "No text or letters unless the customer request explicitly asks for specific Latin initials. No mockups, no shadows, no gradients background.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** AI 가 맡는 요청인지 (오류 신고 · 수정 요청 · 그림 AI 가 준비됐으면 이미지 생성 요청까지) */
export function aiTakes(r: { kind: string; message: string }): boolean {
  if (r.kind === "bug") return true;
  if (r.kind !== "ai") return false;
  return !r.message.startsWith("[AI 이미지 생성]") || imageConfigured();
}

/** 그림 한 장 비용 (USD, 하루 비용 상한 계산용 대략값 — medium 품질 가로 약 $0.04~0.06) */
export const IMAGE_COST_USD = 0.06;
