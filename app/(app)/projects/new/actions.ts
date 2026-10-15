"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { PLAN_BY_CODE, formatTokens, type DeviceKind } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { countProjects, createProject, imageRequestItems } from "@/lib/projects";
import { getQuota } from "@/lib/quota";
import {
  FEATURE_OPTIONS,
  INDUSTRIES,
  MENU_LIMITS,
  PURPOSES,
  SELECTABLE_KINDS,
  buildSitePlan,
  countPages,
  featuresFromPages,
  generatedImageCount,
  pageFullName,
  type IndustryCategory,
  type PageKind,
  type PurposeCode,
} from "@/lib/site-plan";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief } from "@/lib/types/db";

const KINDS = ["service", ...SELECTABLE_KINDS] as [PageKind, ...PageKind[]];
const CATEGORIES = INDUSTRIES.map((i) => i.code) as [IndustryCategory, ...IndustryCategory[]];
const PURPOSE_CODES = PURPOSES.map((p) => p.code) as [PurposeCode, ...PurposeCode[]];

const leafSchema = z.object({
  label: z.string().trim().min(1, "이름이 비어 있는 메뉴가 있습니다").max(MENU_LIMITS.label, `메뉴 이름은 ${MENU_LIMITS.label}자까지 쓸 수 있습니다`),
  kind: z.enum(KINDS).nullable().default(null),
  note: z.string().trim().max(MENU_LIMITS.note).default(""),
  offering: z.number().int().min(0).max(7).nullable().default(null),
});

const briefSchema = z
  .object({
    templateId: z.uuid().nullable(),
    mode: z.enum(["guided", "expert"]),
    siteName: z.string().trim().min(1, "회사·브랜드 이름을 입력하세요").max(60),
    industry: z.string().trim().min(1, "업종을 입력하세요").max(60),
    category: z.enum(CATEGORIES),
    tagline: z.string().trim().min(1, "한 줄 소개를 입력하세요").max(80, "한 줄 소개는 80자까지 쓸 수 있습니다"),
    offerings: z
      .array(z.object({ name: z.string().trim().min(1).max(40, "서비스 이름은 40자까지 쓸 수 있습니다"), description: z.string().trim().max(200).default("") }))
      .min(1, "제공하는 서비스·상품을 1개 이상 적어 주세요")
      .max(8),
    strengths: z.array(z.string().trim().max(80)).max(4).default([]),
    about: z.string().trim().max(1000).default(""),
    contact: z.object({
      phone: z.string().trim().max(40).default(""),
      email: z.string().trim().max(120).default(""),
      address: z.string().trim().max(200).default(""),
      hours: z.string().trim().max(120).default(""),
    }),
    purposes: z.array(z.enum(PURPOSE_CODES)).max(PURPOSE_CODES.length).default([]),
    purposeDetail: z.string().trim().max(500).default(""),
    audience: z.string().trim().max(200).default(""),
    menu: z
      .array(leafSchema.extend({ children: z.array(leafSchema).max(MENU_LIMITS.children).default([]) }))
      .min(1, "헤더 메뉴를 1개 이상 만들어 주세요")
      .max(MENU_LIMITS.top, `헤더 메뉴는 ${MENU_LIMITS.top}개까지 만들 수 있습니다`),
    homeNote: z.string().trim().max(MENU_LIMITS.note).default(""),
    tone: z.array(z.string().max(20)).max(5).default([]),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않습니다"),
    features: z.array(z.string().max(30)).max(20).default([]),
    referenceUrls: z.array(z.string().trim().url("참고 사이트 주소 형식이 올바르지 않습니다").max(300)).max(5).default([]),
    prompt: z.string().trim().max(3000).default(""),
    images: z.object({
      generate: z.boolean(),
      overrides: z
        .array(z.object({ id: z.string().max(120), need: z.string().trim().max(200).optional(), generate: z.boolean().optional() }))
        .max(200)
        .default([]),
    }),
  })
  .refine((d) => d.purposes.length > 0 || d.purposeDetail.length > 0, { message: "사이트로 하고 싶은 일을 하나 이상 골라 주세요" });

export type CreateProjectState = { error?: string } | null;

/**
 * 위저드 제출. 플랜의 사이트 수·페이지 한도·디바이스·남은 토큰을 여기서 강제한다 (UI 는 안내만 하고 진짜 검증은 서버).
 * 플랜이 없어도 사이트는 만들 수 있다 — 수정 요청 단계에서 플랜을 요구한다. 단, AI 이미지 생성은 토큰을 쓰므로 플랜이 있어야 한다.
 *
 * 순서: 검증 → 페이지·이미지 자리 계획(buildSitePlan) → 프로젝트·페이지(구성 초안) 생성 → AI 이미지 생성 요청 접수.
 * 이미지 요청 접수가 실패해도 사이트는 이미 만들어졌으므로 편집 화면으로 보내고 그곳에서 알린다.
 */
export async function createProjectAction(_prev: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  const user = await requireUser("/projects/new");
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { error: "잘못된 요청입니다." };

  let d: z.infer<typeof briefSchema>;
  try {
    d = briefSchema.parse(JSON.parse(raw));
  } catch (e) {
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "입력값을 확인하세요." };
    return { error: "입력값을 확인하세요." };
  }

  const { plan } = await getSubscription(user.id);
  const effective = plan ?? PLAN_BY_CODE.starter; // 플랜이 없으면 스타터 기준으로 페이지·디바이스 제한
  const maxPages = effective.pageRange?.max ?? 30;
  const pageCount = countPages(d.menu);
  if (pageCount > maxPages) {
    return { error: `${effective.name} 플랜은 홈을 포함해 ${maxPages}페이지까지 만들 수 있습니다. 지금 구성은 ${pageCount}페이지입니다.` };
  }
  const devices: DeviceKind[] = effective.devices;

  // 플랜별 사이트 수 제한 (스타터 1 · 비즈니스 2 · 프로 5 · 엔터프라이즈 10)
  if (effective.maxSites !== null) {
    const count = await countProjects(user.id);
    if (count >= effective.maxSites) {
      return { error: `${effective.name} 플랜은 사이트를 ${effective.maxSites}개까지 만들 수 있습니다. 더 만들려면 상위 플랜으로 올려주세요.` };
    }
  }

  if (d.templateId) {
    const supabase = await createClient();
    const { data } = await supabase.from("template_purchases").select("id").eq("user_id", user.id).eq("template_id", d.templateId).maybeSingle();
    if (!data) return { error: "구매하지 않은 템플릿입니다." };
  }

  const business = {
    category: d.category,
    tagline: d.tagline,
    offerings: d.offerings,
    strengths: d.strengths.filter(Boolean),
    about: d.about,
    contact: d.contact,
    purposes: d.purposes,
  };
  const site = buildSitePlan({ mode: d.mode, siteName: d.siteName, business, menu: d.menu, homeNote: d.homeNote, generate: d.images.generate, overrides: d.images.overrides });

  // AI 이미지 생성: 플랜 필요 + 예상 토큰이 남은 토큰(한도 + 크레딧) 안이어야 한다
  const imageCount = generatedImageCount(site.images);
  if (imageCount > 0) {
    if (!plan) return { error: "AI 이미지 생성은 토큰을 쓰므로 플랜이 있어야 합니다. 이미지 생성을 끄거나 플랜을 먼저 선택해 주세요." };
    const quota = await getQuota(user.id, plan);
    const left = quota.ai.remaining === null ? null : quota.ai.remaining + quota.ai.credits;
    const estimate = site.imageGeneration.estimatedTokens;
    if (left !== null && estimate > left) {
      return {
        error: `남은 토큰(${formatTokens(left)})보다 이미지 생성 예상 토큰(약 ${formatTokens(estimate)})이 많습니다. 만들 이미지를 줄이거나 토큰 크레딧을 구매해 주세요.`,
      };
    }
  }

  const allowed = new Set(FEATURE_OPTIONS.filter((f) => !f.needsPlan || effective.paymentSystem !== "none").map((f) => f.key));
  const features = [...new Set([...featuresFromPages(site.pages), ...d.features.filter((f) => allowed.has(f))])];
  const purposeLabels = d.purposes.map((c) => PURPOSES.find((p) => p.code === c)?.label ?? c);
  const brief: ProjectBrief = {
    siteName: d.siteName,
    industry: d.industry,
    purpose: [purposeLabels.join(", "), d.purposeDetail].filter(Boolean).join(" — "),
    audience: d.audience,
    tone: d.tone,
    primaryColor: d.primaryColor,
    pages: site.pages.map(pageFullName),
    features,
    referenceUrls: d.referenceUrls,
    prompt: d.prompt,
    business,
    site,
  };

  const result = await createProject({ userId: user.id, templateId: d.templateId, brief, devices });
  if ("error" in result) return { error: result.error };

  let imagesFailed = false;
  if (imageCount > 0 && plan) {
    const device: DeviceKind = devices.includes("desktop") ? "desktop" : devices[0];
    const items = imageRequestItems(site, result.pages, device);
    if (items.length > 0) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("submit_change_requests", {
        p_project_id: result.id,
        p_items: items,
        p_monthly_ai_tokens: plan.monthlyAiTokens,
        p_weekly_expert: plan.weeklyExpert,
      });
      imagesFailed = Boolean(error);
    }
  }

  redirect(`/projects/${result.id}?created=1${imagesFailed ? "&images=failed" : ""}`);
}
