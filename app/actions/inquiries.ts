"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 공개 사이트 폼 접수 (로그인 불필요). 상담 신청 · 뉴스레터 · 전문가 지원 · 일반 문의.
 * inquiries 테이블(0005_inquiries.sql)에 service role 로 저장한다. 관리자 화면 /admin/inquiries 에서 본다.
 */
export type InquiryState = { ok?: boolean; error?: string; message?: string } | null;

const email = z.string().trim().email("이메일 주소를 확인하세요.").max(200);

const consultationSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  email,
  phone: z.string().trim().max(30).default(""),
  company: z.string().trim().max(100).default(""),
  siteType: z.string().trim().max(60).default(""),
  budget: z.string().trim().max(60).default(""),
  urgency: z.string().trim().max(60).default(""),
  message: z.string().trim().max(3000).default(""),
  agree: z.literal("on", { message: "개인정보 수집 · 이용에 동의해 주세요." }),
});

export async function submitConsultationAction(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const parsed = consultationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("inquiries").insert({
    kind: "consultation",
    name: d.name,
    email: d.email,
    phone: d.phone || null,
    company: d.company || null,
    message: d.message || null,
    payload: { siteType: d.siteType, budget: d.budget, urgency: d.urgency },
  });
  if (error) return { error: "접수 중 오류가 났습니다. 잠시 후 다시 시도하세요." };
  return { ok: true, message: "상담 신청을 접수했습니다. 영업일 기준 1일 안에 연락드립니다." };
}

export async function subscribeNewsletterAction(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "이메일을 확인하세요." };
  const admin = createAdminClient();
  const { error } = await admin.from("inquiries").insert({ kind: "newsletter", email: parsed.data });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "이미 구독 중인 이메일입니다." };
    return { error: "구독 처리 중 오류가 났습니다." };
  }
  return { ok: true, message: "구독을 신청했습니다. 새 글과 제품 소식을 보내드립니다." };
}

const applicationSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  email,
  phone: z.string().trim().max(30).default(""),
  role: z.string().trim().min(1, "지원 분야를 선택하세요.").max(60),
  portfolio: z.string().trim().url("포트폴리오 URL 형식이 올바르지 않습니다.").max(300),
  experience: z.string().trim().max(60).default(""),
  message: z.string().trim().max(3000).default(""),
  agree: z.literal("on", { message: "개인정보 수집 · 이용에 동의해 주세요." }),
});

export async function submitApplicationAction(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const parsed = applicationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("inquiries").insert({
    kind: "application",
    name: d.name,
    email: d.email,
    phone: d.phone || null,
    message: d.message || null,
    payload: { role: d.role, portfolio: d.portfolio, experience: d.experience },
  });
  if (error) return { error: "접수 중 오류가 났습니다. 잠시 후 다시 시도하세요." };
  return { ok: true, message: "지원서를 접수했습니다. 검토 후 이메일로 연락드립니다." };
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요.").max(60),
  email,
  message: z.string().trim().min(1, "문의 내용을 입력하세요.").max(3000),
  agree: z.literal("on", { message: "개인정보 수집 · 이용에 동의해 주세요." }),
});

export async function submitContactAction(_prev: InquiryState, formData: FormData): Promise<InquiryState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요." };
  const d = parsed.data;
  const admin = createAdminClient();
  const { error } = await admin.from("inquiries").insert({ kind: "contact", name: d.name, email: d.email, message: d.message });
  if (error) return { error: "접수 중 오류가 났습니다. 잠시 후 다시 시도하세요." };
  return { ok: true, message: "문의를 접수했습니다. 영업일 기준 1일 안에 답변드립니다." };
}
