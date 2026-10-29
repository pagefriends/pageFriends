import { z } from "zod";

import { SITE_DB_DRAFT_ROWS } from "@/config/site-db";
import { apiError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import type { CollectionRow } from "@/lib/collections";
import { designOf } from "@/lib/design-doc";
import { renderDraft } from "@/lib/draft-render";
import { draftVersion } from "@/lib/projects";
import { draftRows } from "@/lib/site-db/data";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief, ProjectPageRow } from "@/lib/types/db";

const paramsSchema = z.object({ pageId: z.uuid(), device: z.enum(["mobile", "tablet", "desktop"]) });

/**
 * 구성 초안 그림 (SVG). 편집기 캔버스 · 요청 미리보기 · 관리자 화면의 <img> 가 부른다.
 *   GET /api/drafts/{pageId}/{device}
 * 읽기 권한은 RLS 가 정한다 — 사이트 주인과 관리자만 페이지·프로젝트를 읽을 수 있다.
 * 그림은 저장된 위저드 입력(brief.site)으로 매번 다시 그리고, 높이는 프로젝트를 만들 때 저장한 캡처 크기를 따른다.
 * 관리자 목록이 붙은 페이지면 사이트 DB 에서 공개된 글을 읽어 함께 그린다 (읽기 권한은 위에서 RLS 로 확인한 뒤 서버가 읽는다).
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
  // 디자인 문서는 사이트 주인이 직접 고칠 수도 있으므로 designOf 가 값을 다시 검사한다.
  // 저장된 캡처가 지금 디자인 버전으로 그린 것이 아니면(주소의 v 가 다르면) 저장된 높이를 강제하지 않는다 — 잘리거나 빈 띠가 생기지 않게
  const design = designOf(brief);
  const current = !stored || draftVersion(stored.url) === design.version;
  const listed = (design.collections ?? []).find((c) => c.page === page.path);
  const listRows = listed ? await draftRows(page.project_id, listed, SITE_DB_DRAFT_ROWS[listed.layout]) : null;
  const rows: Record<string, CollectionRow[]> | undefined = listed && listRows ? { [listed.key]: listRows } : undefined;
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
      design: brief.design ? design : undefined,
      rows,
    },
    current ? stored?.height : undefined,
  );

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // 관리자 목록이 있는 페이지는 글을 올리면 바로 보이게 짧게만 둔다
      "Cache-Control": current ? (listed ? "private, max-age=5" : "private, max-age=60") : "no-store",
      // 주소를 직접 열어도 SVG 안에서 스크립트·외부 자원이 돌지 않게
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
