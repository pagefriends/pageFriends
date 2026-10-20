import { AiRerunButton, AiRunList } from "@/components/admin/ai-runs";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_MODEL, PROMPT_VERSION, USD_TO_KRW } from "@/config/ai";
import { STYLE_BY_ID, mergeStyles, normalizeStyles } from "@/config/design-styles";
import { harnessPreview } from "@/lib/ai/harness";
import type { AiRunRow } from "@/lib/ai/run-types";
import { designOf, describeTheme } from "@/lib/design-doc";
import type { ProjectBrief } from "@/lib/types/db";

const KIND_LABEL = { policy: "정책", style: "디자인 유형", industry: "업종", template: "템플릿", benchmark: "벤치마킹" } as const;

/**
 * 관리자 "AI 작업 지시서" — 이 사이트에서 AI 에게 무엇을 어떻게 시키는지 그대로 보여 준다.
 * 고른 디자인 유형의 합친 결과 · 충돌 처리 · 적용되는 스킬 · 실제 지시문 전체(첫 제작 기준) · 지금 디자인 문서 · 실행 기록.
 * 지시문은 화면을 열 때 만든다 (API 를 부르지 않는다).
 */
export function AiBrief({
  projectId,
  brief,
  template,
  runs,
  readiness,
}: {
  projectId: string;
  brief: ProjectBrief;
  template: { slug: string; name: string } | null;
  runs: { available: boolean; runs: AiRunRow[] };
  readiness: { key: boolean; schema: boolean; spentUsd: number; budgetUsd: number };
}) {
  const design = designOf(brief);
  const tags = normalizeStyles(brief.styleTags?.length ? brief.styleTags : brief.tone);
  const merge = mergeStyles(tags);
  const preview = brief.site && brief.business ? harnessPreview({ brief, design, template }) : null;
  const ready = readiness.key && readiness.schema;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI 작업 지시서</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-500">
          <Badge tone={readiness.key ? "dark" : "gray"}>{readiness.key ? "API 키 있음" : "API 키 없음 — 담당자가 처리"}</Badge>
          <Badge tone={readiness.schema ? "dark" : "gray"}>{readiness.schema ? "0008 적용됨" : "0008 적용 전 — 실행 기록 없음"}</Badge>
          <span>
            모델 {AI_MODEL} · 지시서 {PROMPT_VERSION}
          </span>
          {readiness.schema ? (
            <span>
              오늘 AI 비용 ${readiness.spentUsd.toFixed(2)} / 상한 ${readiness.budgetUsd} (약 {Math.round(readiness.spentUsd * USD_TO_KRW).toLocaleString("ko-KR")}원)
            </span>
          ) : null}
        </div>

        <section>
          <h3 className="text-[13px] font-semibold">디자인 유형</h3>
          {tags.length ? (
            <>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((id, i) => (
                  <Badge key={id} tone={i === 0 ? "blue" : "gray"}>
                    {i === 0 ? "★ " : ""}
                    {STYLE_BY_ID[id].label}
                  </Badge>
                ))}
                {brief.styleTags?.length ? null : <span className="text-xs text-ink-500">(예전 &lsquo;디자인 톤&rsquo; 에서 변환)</span>}
              </div>
              <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed text-ink-700">
                {merge.summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
                {merge.conflicts.map((c) => (
                  <li key={c.text} className="text-ink-500">
                    충돌: {c.text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-xs text-ink-500">고르지 않음 — 업종에 맞게 정해요.</p>
          )}
        </section>

        <section>
          <h3 className="text-[13px] font-semibold">
            지금 디자인 문서 · v{design.version} <span className="font-normal text-ink-500">({design.source === "ai" ? "AI 가 만듦" : design.source === "admin" ? "담당자가 고침" : "규칙으로 만듦"})</span>
          </h3>
          <ul className="mt-1.5 text-xs leading-relaxed text-ink-700">
            {describeTheme(design.theme).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {Object.keys(design.copy.site).length + Object.keys(design.copy.pages).length > 0 ? (
            <p className="mt-1 text-xs text-ink-500">
              바꾼 문구: 사이트 공통 {Object.keys(design.copy.site).length}개 · 페이지별 {Object.values(design.copy.pages).reduce((n, m) => n + Object.keys(m).length, 0)}개
            </p>
          ) : null}
          {design.appliedTags?.length ? (
            <ul className="mt-2 list-disc pl-4 text-xs leading-relaxed">
              {design.appliedTags.map((a) => (
                <li key={a.tag}>
                  <b>{STYLE_BY_ID[a.tag]?.label ?? a.tag}</b>: {a.how}
                </li>
              ))}
            </ul>
          ) : null}
          {design.notes ? <p className="mt-1.5 text-xs leading-relaxed text-ink-700">AI 설명: {design.notes}</p> : null}
        </section>

        {preview ? (
          <section>
            <h3 className="text-[13px] font-semibold">적용되는 스킬 {preview.skills.length}개</h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {preview.skills.map((s) => (
                <li key={s.id}>
                  <details className="rounded border border-ink-200 px-2.5 py-1.5 text-xs">
                    <summary className="cursor-pointer">
                      <Badge tone={s.kind === "policy" ? "gray" : s.kind === "style" ? "blue" : "sky"}>{KIND_LABEL[s.kind]}</Badge> <span className="font-medium">{s.title}</span>
                    </summary>
                    <pre className="mt-1.5 text-[11px] leading-relaxed whitespace-pre-wrap text-ink-700">{s.body}</pre>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-medium text-brand-600">
                AI 에게 보내는 지시문 전체 보기 (첫 제작 기준 · {preview.chars.toLocaleString("ko-KR")}자 · 입력 약 {Math.round(preview.approxTokens / 1000)}천 토큰 어림)
              </summary>
              <p className="mt-1.5 text-ink-500">시스템 프롬프트 (고정 부분은 캐시해 다시 읽을 때 싸다)</p>
              <pre className="mt-1 max-h-96 overflow-auto rounded bg-ink-100 p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">{preview.system}</pre>
              <p className="mt-2 text-ink-500">메시지 (사이트 자료 · 문구 자리)</p>
              <pre className="mt-1 max-h-96 overflow-auto rounded bg-ink-100 p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">{preview.user}</pre>
            </details>
          </section>
        ) : (
          <p className="text-xs text-ink-500">위저드 개편 전에 만든 사이트라 AI 지시서가 없습니다 (담당자가 처리).</p>
        )}

        {preview ? <AiRerunButton kind="build" id={projectId} disabled={!ready} label={ready ? "AI로 다시 만들기 (첫 제작)" : "AI로 다시 만들기 — 키 · 0008 필요"} /> : null}

        <section>
          <h3 className="text-[13px] font-semibold">AI 실행 기록</h3>
          <div className="mt-1.5">{runs.available ? <AiRunList runs={runs.runs} path={`/admin/projects/${projectId}`} /> : <p className="text-xs text-ink-500">0008_ai.sql 을 적용하면 기록이 쌓입니다.</p>}</div>
        </section>
      </CardBody>
    </Card>
  );
}
