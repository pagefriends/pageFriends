import "server-only";

import { randomUUID } from "node:crypto";

import samples from "@/config/samples.json";
import type { DeviceKind } from "@/config/plans";
import { renderDraft } from "@/lib/draft-render";
import { imageRequestMessage, pageFullName, type SitePlan } from "@/lib/site-plan";
import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestRow, ProjectBrief, ProjectPageRow, ProjectRow, Region, Screenshot } from "@/lib/types/db";

/** 위저드의 페이지 이름 → 샘플 캡처 종류. 실제 캡처 파이프라인이 붙으면 이 매핑은 필요 없어진다. */
const PAGE_SAMPLE_KEY: Record<string, string> = {
  홈: "home",
  안내: "about",
  소개: "about",
  리뷰: "reviews",
  상품: "products",
  문의: "contact",
  예약: "contact",
  관리자페이지: "admin",
};

const PAGE_PATH: Record<string, string> = {
  홈: "/",
  안내: "/about",
  소개: "/about",
  리뷰: "/reviews",
  상품: "/products",
  문의: "/contact",
  예약: "/reservation",
  관리자페이지: "/admin",
};

type SampleManifest = Record<string, Screenshot>;
const SAMPLES = samples as SampleManifest;

/** 페이지 이름에 맞는 디바이스별 샘플 캡처. 모르는 페이지 이름은 '안내' 레이아웃을 쓴다. */
export function sampleScreenshots(pageName: string, devices: DeviceKind[]): Partial<Record<DeviceKind, Screenshot>> {
  const key = PAGE_SAMPLE_KEY[pageName] ?? "about";
  const out: Partial<Record<DeviceKind, Screenshot>> = {};
  for (const d of devices) {
    const s = SAMPLES[`${key}:${d}`];
    if (s) out[d] = s;
  }
  return out;
}

export function pagePath(pageName: string, index: number): string {
  return PAGE_PATH[pageName] ?? `/page-${index + 1}`;
}

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data as ProjectRow[]) ?? [];
}

/** 보유 사이트(프로젝트) 수. 플랜별 사이트 수 제한 검사에 쓴다. */
export async function countProjects(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

export async function getProject(userId: string, projectId: string): Promise<{ project: ProjectRow; pages: ProjectPageRow[] } | null> {
  const supabase = await createClient();
  const [{ data: project }, { data: pages }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("project_pages").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
  ]);
  if (!project) return null;
  return { project: project as ProjectRow, pages: (pages as ProjectPageRow[]) ?? [] };
}

/** 구성 초안 주소. 페이지 id 와 화면으로 그림을 다시 그린다 (app/api/drafts/[pageId]/[device]/route.ts) */
export function draftUrl(pageId: string, device: DeviceKind): string {
  return `/api/drafts/${pageId}/${device}`;
}

/** 위저드 입력으로 페이지 하나의 화면별 구성 초안 캡처(크기 · 이미지 자리 위치)를 만든다 */
function draftScreenshots(brief: ProjectBrief, site: SitePlan, pageIndex: number, pageId: string, devices: DeviceKind[]): Partial<Record<DeviceKind, Screenshot>> {
  const out: Partial<Record<DeviceKind, Screenshot>> = {};
  if (!brief.business) return out;
  for (const device of devices) {
    const res = renderDraft({
      siteName: brief.siteName,
      industry: brief.industry,
      primaryColor: brief.primaryColor,
      business: brief.business,
      plan: site,
      page: site.pages[pageIndex],
      device,
      year: new Date().getFullYear(),
    });
    out[device] = { url: draftUrl(pageId, device), width: res.width, height: res.height, draft: true, slots: res.slots };
  }
  return out;
}

export type CreatedPage = Pick<ProjectPageRow, "id" | "path" | "screenshots">;

/**
 * 프로젝트 생성 + 페이지 행 생성.
 * 새 위저드(brief.site 있음): 헤더 메뉴·하위 페이지대로 페이지를 만들고 캡처 자리에 구성 초안을 넣는다.
 * 예전 형식(brief.site 없음): 페이지 이름에 맞는 샘플 캡처를 넣는다.
 */
export async function createProject(input: {
  userId: string;
  templateId: string | null;
  brief: ProjectBrief;
  devices: DeviceKind[];
}): Promise<{ id: string; pages: CreatedPage[] } | { error: string }> {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: input.userId, name: input.brief.siteName, template_id: input.templateId, brief: input.brief, status: "building" })
    .select("id")
    .single();
  if (error || !project) return { error: error?.message ?? "프로젝트를 만들지 못했습니다." };
  const projectId = project.id as string;

  const site = input.brief.site;
  const pages = site
    ? site.pages.map((p, i) => {
        // 캡처 주소에 페이지 id 가 들어가므로 id 를 미리 정해 한 번에 넣는다
        const id = randomUUID();
        return { id, project_id: projectId, name: pageFullName(p), path: p.path, sort_order: i, screenshots: draftScreenshots(input.brief, site, i, id, input.devices) };
      })
    : input.brief.pages.map((name, i) => ({
        id: randomUUID(),
        project_id: projectId,
        name,
        path: pagePath(name, i),
        sort_order: i,
        screenshots: sampleScreenshots(name, input.devices),
      }));
  const { error: pageError } = await supabase.from("project_pages").insert(pages);
  if (pageError) return { error: pageError.message };
  return { id: projectId, pages: pages.map((p) => ({ id: p.id, path: p.path, screenshots: p.screenshots })) };
}

/** 위저드에서 "AI로 이미지 만들기" 로 고른 자리 → 수정 요청(AI 반영) 항목. submit_change_requests 의 p_items 형식 */
export type ImageRequestItem = { page_id: string; device: DeviceKind; kind: "ai"; seq: number; region: Region; message: string };

/**
 * 이미지 자리마다 요청 하나. 자리가 처음 나오는 페이지의 캡처 위에 그 자리 위치로 네모를 만든다 —
 * 담당자는 요청 화면에서 어느 자리에 어떤 이미지를 만들지 바로 보고, 사용자는 요청 내역에서 진행 상황을 본다.
 * 토큰은 다른 AI 요청처럼 처리할 때 실제 사용량으로 기록된다.
 */
export function imageRequestItems(site: SitePlan, pages: CreatedPage[], device: DeviceKind): ImageRequestItem[] {
  const pageByPath = new Map(pages.map((p) => [p.path, p]));
  const seq = new Map<string, number>();
  const items: ImageRequestItem[] = [];
  for (const slot of site.images) {
    if (!slot.generate) continue;
    for (const path of slot.pages) {
      const page = pageByPath.get(path);
      const shot = page?.screenshots[device];
      const rect = shot?.slots?.find((s) => s.id === slot.id);
      if (!page || !shot || !rect) continue;
      const n = (seq.get(page.id) ?? 0) + 1;
      seq.set(page.id, n);
      items.push({
        page_id: page.id,
        device,
        kind: "ai",
        seq: n,
        region: { x: rect.x / shot.width, y: rect.y / shot.height, w: rect.w / shot.width, h: rect.h / shot.height },
        message: imageRequestMessage(slot),
      });
      break;
    }
  }
  return items;
}

export async function listProjectRequests(projectId: string): Promise<ChangeRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("change_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  return (data as ChangeRequestRow[]) ?? [];
}
