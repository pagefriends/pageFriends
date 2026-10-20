import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

import { AI_MODEL, billableTokens, costUsd } from "@/config/ai";

/**
 * Claude API 호출 (lib/ai 의 엔진만 쓴다).
 *
 * - 모델 · 노력 수준은 config/ai.ts. 생각(thinking)은 Opus 5.5 에서 항상 켜져 있어 따로 보내지 않는다.
 * - 답은 구조화 출력(output_config.format)으로만 받는다 — zod 형식에 맞지 않으면 실패로 본다.
 * - 안전 분류기가 거절하면 서버 쪽 대체 모델로 다시 시도한다 (fallbacks: "default"). 그래도 거절이면 refused.
 * - 긴 답에 대비해 스트리밍으로 받고 끝난 메시지만 쓴다 (HTTP 시간 초과 방지).
 * - system 의 고정 부분에 cache_control 을 걸어, 같은 사이트의 요청이 이어지면 지시문을 캐시에서 읽는다.
 *
 * ANTHROPIC_API_KEY 가 없으면 부르지 않는다 (aiConfigured). AI_ENGINE=off 로 끌 수 있다.
 */

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim()) && process.env.AI_ENGINE !== "off";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: 5 * 60_000, maxRetries: 2 });
  return client;
}

export type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number };

export type CallResult<T> =
  | { ok: true; data: T; usage: Usage; model: string; billed: number; costUsd: number; durationMs: number }
  | { ok: false; reason: "refused" | "max_tokens" | "invalid" | "api"; error: string; usage: Usage | null; model: string | null; billed: number; costUsd: number; durationMs: number };

export type SystemBlock = { text: string; cache?: boolean };

/**
 * 답을 받는 도중의 진행 상황 (편집기 "AI 작업 중" 화면용). 생각이 끝나고 답(JSON)을 쓰기 시작하면 writing,
 * 답 앞쪽의 decision · summary 칸이 다 써지면 그 값을 바로 넘긴다 — 반영이 끝나기 전에 "무엇을 바꿀지" 를 먼저 보여 줄 수 있다.
 */
export type StreamProgress = { phase: "writing"; decision?: string; summary?: string };

/** 쓰고 있는 JSON 에서 다 써진 문자열 칸 하나를 꺼낸다 (닫는 따옴표까지 와야 꺼낸다) */
function partialString(json: string, key: string): string | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(json);
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]) as string;
  } catch {
    return undefined;
  }
}

export async function callStructured<S extends z.ZodType>(opts: {
  system: SystemBlock[];
  user: string;
  schema: S;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens: number;
  onProgress?: (p: StreamProgress) => void;
}): Promise<CallResult<z.infer<S>>> {
  const started = Date.now();
  // JSON 스키마만 보내고 검사는 아래에서 직접 한다 (SDK 의 자동 파싱이 실패를 예외로 던지지 않게)
  const { schema } = betaZodOutputFormat(opts.schema);
  try {
    const stream = getClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: opts.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort, format: { type: "json_schema", schema } },
      system: opts.system.map((b) => ({ type: "text" as const, text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) })),
      messages: [{ role: "user", content: opts.user }],
    });
    if (opts.onProgress) {
      const notify = opts.onProgress;
      const sent: { writing?: boolean; decision?: string; summary?: string } = {};
      stream.on("text", (_delta, snapshot) => {
        try {
          const decision = sent.decision ?? partialString(snapshot, "decision");
          const summary = sent.summary ?? partialString(snapshot, "summary");
          if (sent.writing && decision === sent.decision && summary === sent.summary) return;
          Object.assign(sent, { writing: true, decision, summary });
          notify({ phase: "writing", decision, summary });
        } catch {
          // 진행 표시는 실패해도 답 받기에는 영향이 없어야 한다
        }
      });
    }
    const msg = await stream.finalMessage();
    const usage: Usage = {
      input: msg.usage.input_tokens ?? 0,
      output: msg.usage.output_tokens ?? 0,
      cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
      cacheRead: msg.usage.cache_read_input_tokens ?? 0,
    };
    const base = { usage, model: msg.model, billed: billableTokens(usage), costUsd: costUsd(usage), durationMs: Date.now() - started };
    if (msg.stop_reason === "refusal") {
      const why = msg.stop_details && "category" in msg.stop_details ? (msg.stop_details.category ?? "") : "";
      return { ok: false, reason: "refused", error: `안전 거절${why ? ` (${why})` : ""}`, ...base };
    }
    if (msg.stop_reason === "max_tokens") return { ok: false, reason: "max_tokens", error: "답이 너무 길어 끝까지 받지 못했습니다", ...base };
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    try {
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (!parsed.success) return { ok: false, reason: "invalid", error: `형식이 맞지 않음: ${parsed.error.issues[0]?.message ?? ""}`, ...base };
      return { ok: true, data: parsed.data, ...base };
    } catch {
      return { ok: false, reason: "invalid", error: "JSON 이 아닌 답", ...base };
    }
  } catch (e) {
    const durationMs = Date.now() - started;
    let error = e instanceof Error ? e.message : String(e);
    if (e instanceof Anthropic.AuthenticationError) error = "API 키가 올바르지 않습니다 (ANTHROPIC_API_KEY)";
    else if (e instanceof Anthropic.PermissionDeniedError) error = "이 API 키로는 이 모델을 쓸 수 없습니다";
    else if (e instanceof Anthropic.RateLimitError) error = "요청이 많아 잠시 막혔습니다 (rate limit)";
    else if (e instanceof Anthropic.BadRequestError) error = `잘못된 요청: ${e.message}`;
    else if (e instanceof Anthropic.APIConnectionError) error = "Claude API 에 연결하지 못했습니다";
    return { ok: false, reason: "api", error: error.slice(0, 500), usage: null, model: null, billed: 0, costUsd: 0, durationMs };
  }
}
