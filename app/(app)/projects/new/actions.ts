"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { PLAN_BY_CODE, type DeviceKind } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { countProjects, createProject } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

const briefSchema = z.object({
  templateId: z.uuid().nullable(),
  siteName: z.string().trim().min(1, "사이트 이름을 입력하세요").max(60),
  industry: z.string().trim().min(1, "업종을 입력하세요").max(60),
  purpose: z.string().trim().min(1, "사이트 목적을 입력하세요").max(500),
  audience: z.string().trim().max(200).default(""),
  tone: z.array(z.string().max(20)).max(5).default([]),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않습니다"),
  pages: z.array(z.string().trim().min(1).max(20)).min(1, "페이지를 1개 이상 선택하세요").max(30),
  features: z.array(z.string().max(30)).max(20).default([]),
  referenceUrls: z.array(z.string().trim().url("참고 사이트 URL 형식이 올바르지 않습니다").max(300)).max(5).default([]),
  prompt: z.string().trim().max(3000).default(""),
});

export type CreateProjectState = { error?: string } | null;

/**
 * 위저드 제출. 플랜의 사이트 수·페이지 한도·디바이스를 여기서 강제한다 (UI 는 안내만 하고 진짜 검증은 서버).
 * 플랜이 없어도 프로젝트는 만들 수 있다 — 수정 요청 단계에서 플랜을 요구한다.
 */
export async function createProjectAction(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const user = await requireUser("/projects/new");
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "잘못된 요청입니다." };

  let parsed: z.infer<typeof briefSchema>;
  try {
    parsed = briefSchema.parse(JSON.parse(raw));
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "입력값을 확인하세요." };
    return { error: "입력값을 확인하세요." };
  }

  const { plan } = await getSubscription(user.id);
  const effective = plan ?? PLAN_BY_CODE.starter; // 플랜이 없으면 스타터 기준으로 페이지·디바이스 제한
  if (effective.pageRange && parsed.pages.length > effective.pageRange.max) {
    return { error: `${effective.name} 플랜은 최대 ${effective.pageRange.max}페이지까지 만들 수 있습니다.` };
  }
  const devices: DeviceKind[] = effective.devices;

  // 플랜별 사이트 수 제한 (스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10)
  if (effective.maxSites !== null) {
    const count = await countProjects(user.id);
    if (count >= effective.maxSites) {
      return { error: `${effective.name} 플랜은 사이트를 ${effective.maxSites}개까지 만들 수 있습니다. 더 만들려면 상위 플랜으로 올려주세요.` };
    }
  }

  if (parsed.templateId) {
    const supabase = await createClient();
    const { data } = await supabase.from("template_purchases").select("id").eq("user_id", user.id).eq("template_id", parsed.templateId).maybeSingle();
    if (!data) return { error: "구매하지 않은 템플릿입니다." };
  }

  const { templateId, ...brief } = parsed;
  const result = await createProject({ userId: user.id, templateId, brief, devices });
  if ("error" in result) return { error: result.error };
  redirect(`/projects/${result.id}`);
}
