"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";

import { BENCHMARK_ASPECTS, BENCHMARK_ATTESTATION, MAX_BENCHMARKS } from "@/config/benchmarks";
import { MAX_STYLES, normalizeStyles, styleLabels } from "@/config/design-styles";
import { PLAN_BY_CODE, expertBuildIncluded, formatTokens, type DeviceKind } from "@/config/plans";
import { templateDesign } from "@/config/template-designs";
import { aiConfigured } from "@/lib/ai/claude";
import { startSiteBuild } from "@/lib/ai/engine";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { rulesDesign } from "@/lib/design-doc";
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
import { submitChangeRequests } from "@/lib/submit-requests";
import { cycleOf } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";
import type { ProjectBrief } from "@/lib/types/db";

const KINDS = ["service", ...SELECTABLE_KINDS] as [PageKind, ...PageKind[]];
const CATEGORIES = INDUSTRIES.map((i) => i.code) as [IndustryCategory, ...IndustryCategory[]];
const PURPOSE_CODES = PURPOSES.map((p) => p.code) as [PurposeCode, ...PurposeCode[]];
const ASPECT_KEYS = BENCHMARK_ASPECTS.map((a) => a.key) as [string, ...string[]];

const benchmarkSchema = z
  .object({
    url: z.url({ protocol: /^https?$/, error: "벤치마킹 사이트 주소 형식이 올바르지 않습니다" }).max(300),
    aspects: z.array(z.enum(ASPECT_KEYS)).max(ASPECT_KEYS.length).default([]),
    note: z.string().trim().max(300).default(""),
    permission: z.enum(["own", "granted", "none"], { error: "벤치마킹 사이트마다 허락 상태를 골라 주세요" }),
    permissionNote: z.string().trim().max(200).default(""),
  })
  .refine((b) => b.permission !== "granted" || b.permissionNote.length > 0, { message: "허락받은 사이트는 어떻게 허락받았는지 적어 주세요" });

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
    builder: z.enum(["ai", "expert"]).default("ai"),
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
    styleTags: z.array(z.string().max(20)).max(MAX_STYLES).default([]),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "색상 형식이 올바르지 않습니다"),
    features: z.array(z.string().max(30)).max(20).default([]),
    benchmarks: z.array(benchmarkSchema).max(MAX_BENCHMARKS).default([]),
    attested: z.boolean().default(false),
    prompt: z.string().trim().max(3000).default(""),
    images: z.object({
      generate: z.boolean(),
      overrides: z
        .array(z.object({ id: z.string().max(120), need: z.string().trim().max(200).optional(), generate: z.boolean().optional() }))
        .max(200)
        .default([]),
    }),
  })
  .refine((d) => d.purposes.length > 0 || d.purposeDetail.length > 0, { message: "사이트로 하고 싶은 일을 하나 이상 골라 주세요" })
  // 첫 요청에는 벤치마킹 사이트가 꼭 있어야 한다. 템플릿으로 시작하면 템플릿(사용 허락 포함)이 그 역할을 한다
  .refine((d) => d.templateId !== null || d.benchmarks.length > 0, { message: "벤치마킹할 사이트를 1개 이상 적어 주세요" })
  .refine((d) => d.benchmarks.length === 0 || d.attested, { message: "벤치마킹 사이트 확인 체크를 해 주세요" });

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

  const { plan, subscription } = await getSubscription(user.id);
  const effective = plan ?? PLAN_BY_CODE.starter; // 플랜이 없으면 스타터 기준으로 페이지·디바이스 제한
  // 사람이 처음부터 만드는 첫 제작은 연간 결제에만 들어 있다 (config/plans.ts expertBuildIncluded)
  if (d.builder === "expert" && !(plan && subscription && expertBuildIncluded(cycleOf(subscription)))) {
    return { error: "'전문가에게 맡기기'는 연간 결제 플랜에서 쓸 수 있어요. AI로 시작하거나 연간 결제로 바꿔 주세요." };
  }
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

  let templateSlug: string | null = null;
  if (d.templateId) {
    const supabase = await createClient();
    const { data } = await supabase.from("template_purchases").select("template:templates(slug)").eq("user_id", user.id).eq("template_id", d.templateId).maybeSingle();
    if (!data) return { error: "구매하지 않은 템플릿입니다." };
    templateSlug = ((data as unknown as { template: { slug: string } | null }).template?.slug as string | undefined) ?? null;
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
  const site = buildSitePlan({
    mode: d.mode,
    builder: d.builder,
    siteName: d.siteName,
    business,
    menu: d.menu,
    homeNote: d.homeNote,
    generate: d.images.generate,
    overrides: d.images.overrides,
  });

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
  const styleTags = normalizeStyles(d.styleTags);
  const tpl = templateDesign(templateSlug);
  // 첫 디자인 문서: 고른 디자인 유형(+ 템플릿 테마)으로 규칙에 따라 만든다. AI 로 만들면 뒤에서 AI 가 다듬는다
  const design = rulesDesign({ styleTags, primaryColor: d.primaryColor, preset: tpl?.theme });
  // AI 키가 있을 때만 (없으면 규칙으로 만든 디자인 그대로 — 지금까지처럼 담당자가 마무리)
  const aiBuild = d.builder === "ai" && Boolean(plan) && aiConfigured();
  const brief: ProjectBrief = {
    siteName: d.siteName,
    industry: d.industry,
    purpose: [purposeLabels.join(", "), d.purposeDetail].filter(Boolean).join(" — "),
    audience: d.audience,
    // 예전 화면이 읽는 칸: 톤 = 디자인 유형 이름, 참고 사이트 = 벤치마킹 주소
    tone: styleLabels(styleTags),
    primaryColor: d.primaryColor,
    pages: site.pages.map(pageFullName),
    features,
    referenceUrls: d.benchmarks.map((b) => b.url),
    prompt: d.prompt,
    business,
    site,
    styleTags,
    benchmarks: d.benchmarks.map((b) => ({ ...b, digest: null })),
    // 확인 체크 시각은 서버가 찍는다 (문구가 바뀌어도 어떤 문구에 동의했는지 남게 문구도 함께 저장)
    benchmarkAttestedAt: d.benchmarks.length ? new Date().toISOString() : null,
    benchmarkAttestation: d.benchmarks.length ? BENCHMARK_ATTESTATION : null,
    templateSlug,
    design: { ...design, aiPending: aiBuild },
  };

  const result = await createProject({ userId: user.id, templateId: d.templateId, brief, devices });
  if ("error" in result) return { error: result.error };

  // AI 로 만들기: 응답을 보낸 뒤 백그라운드에서 AI 가 테마 · 문구를 다듬는다 (키 · 하루 한도 · 플랜은 엔진이 다시 확인한다).
  // redirect() 는 예외를 던지므로 그 전에 걸어 둔다
  if (aiBuild) after(() => startSiteBuild(result.id));

  let imagesFailed = false;
  if (imageCount > 0 && plan) {
    const device: DeviceKind = devices.includes("desktop") ? "desktop" : devices[0];
    const items = imageRequestItems(site, result.pages, device);
    if (items.length > 0) {
      const supabase = await createClient();
      const { error } = await submitChangeRequests(supabase, result.id, items, plan);
      imagesFailed = Boolean(error);
    }
  }

  redirect(`/projects/${result.id}?created=1${imagesFailed ? "&images=failed" : ""}`);
}
