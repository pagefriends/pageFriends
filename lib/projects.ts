import "server-only";

import samples from "@/config/samples.json";
import type { DeviceKind } from "@/config/plans";
import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestRow, ProjectBrief, ProjectPageRow, ProjectRow, Screenshot } from "@/lib/types/db";

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

export async function getProject(userId: string, projectId: string): Promise<{ project: ProjectRow; pages: ProjectPageRow[] } | null> {
  const supabase = await createClient();
  const [{ data: project }, { data: pages }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("project_pages").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
  ]);
  if (!project) return null;
  return { project: project as ProjectRow, pages: (pages as ProjectPageRow[]) ?? [] };
}

/** 프로젝트 생성 + 페이지 행 생성. 캡처는 샘플로 채운다 (실제 파이프라인 연결 전). */
export async function createProject(input: {
  userId: string;
  templateId: string | null;
  brief: ProjectBrief;
  devices: DeviceKind[];
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: input.userId, name: input.brief.siteName, template_id: input.templateId, brief: input.brief, status: "building" })
    .select("id")
    .single();
  if (error || !project) return { error: error?.message ?? "프로젝트를 만들지 못했습니다." };

  const pages = input.brief.pages.map((name, i) => ({
    project_id: project.id as string,
    name,
    path: pagePath(name, i),
    sort_order: i,
    screenshots: sampleScreenshots(name, input.devices),
  }));
  const { error: pageError } = await supabase.from("project_pages").insert(pages);
  if (pageError) return { error: pageError.message };
  return { id: project.id as string };
}

export async function listProjectRequests(projectId: string): Promise<ChangeRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("change_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  return (data as ChangeRequestRow[]) ?? [];
}
