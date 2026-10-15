import { z } from "zod";

import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { renderDraft } from "@/lib/draft-render";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief, ProjectPageRow } from "@/lib/types/db";

const paramsSchema = z.object({ pageId: z.uuid(), device: z.enum(["mobile", "tablet", "desktop"]) });

/**
 * 구성 초안 그림 (SVG). 편집기 캔버스 · 요청 미리보기 · 관리자 화면의 <img> 가 부른다.
 *   GET /api/drafts/{pageId}/{device}
 * 읽기 권한은 RLS 가 정한다 — 사이트 주인과 관리자만 페이지·프로젝트를 읽을 수 있다.
 * 그림은 저장된 위저드 입력(brief.site)으로 매번 다시 그리고, 높이는 프로젝트를 만들 때 저장한 캡처 크기를 따른다.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/drafts/[pageId]/[device]">) {
  const parsed = paramsSchema.safeParse(await ctx.params);
  if (!parsed.success) return apiError(404, "NOT_FOUND", "초안을 찾을 수 없습니다.");
  const { pageId, device } = parsed.data;

  const user = await getSessionUser();
  if (!user) return apiError(401, "UNAUTHORIZED", "로그인이 필요합니다.");

  const supabase = await createClient();
  const { data: page } = await supabase.from("project_pages").select("id, project_id, path, screenshots").eq("id", pageId).maybeSingle();
  if (!page) return apiError(404, "NOT_FOUND", "초안을 찾을 수 없습니다.");
  const { data: project } = await supabase.from("projects").select("brief").eq("id", page.project_id).maybeSingle();
  const brief = (project?.brief ?? null) as ProjectBrief | null;
  const planned = brief?.site?.pages.find((p) => p.path === page.path);
  if (!brief?.site || !brief.business || !planned) return apiError(404, "NOT_FOUND", "초안을 찾을 수 없습니다.");

  const stored = (page as Pick<ProjectPageRow, "screenshots">).screenshots[device];
  const { svg } = renderDraft(
    {
      siteName: brief.siteName,
      industry: brief.industry,
      primaryColor: brief.primaryColor,
      business: brief.business,
      plan: brief.site,
      page: planned,
      device,
      year: Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Seoul" }).format(new Date())),
    },
    stored?.height,
  );

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      // 주소를 직접 열어도 SVG 안에서 스크립트·외부 자원이 돌지 않게
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
