import type { CreditKind, DeviceKind, PlanCode, RequestKind } from "@/config/plans";
import type { SlotRect } from "@/lib/draft-render";
import type { BusinessInfo, SitePlan } from "@/lib/site-plan";

/** supabase/migrations/0001_init.sql 과 1:1. 컬럼을 바꾸면 여기도 같이 바꾼다. */

export type ProfileRow = { id: string; email: string; display_name: string | null; role: "user" | "admin"; created_at: string };

export type SubscriptionStatus = "active" | "past_due" | "cancelled";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_code: PlanCode;
  status: SubscriptionStatus;
  payment_addon: boolean;
  billing_key_enc: string | null;
  current_period_start: string;
  current_period_end: string;
  /** 해지 예약. true 면 current_period_end 까지만 유지 */
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  /** 다음 갱신 결제의 paymentId (웹훅이 구독을 찾는 키) 와 포트원 예약 id */
  next_payment_id: string | null;
  portone_schedule_id: string | null;
  next_payment_at: string | null;
  failed_attempts: number;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateKind = "demo" | "live";

export type TemplateRow = {
  id: string;
  slug: string;
  name: string;
  kind: TemplateKind;
  category: string;
  description: string;
  price_krw: number;
  thumbnail_url: string;
  preview_urls: string[];
  pages: string[];
  owner_consent: boolean;
  owner_site_url: string | null;
  is_published: boolean;
  created_at: string;
};

export type TemplatePurchaseRow = { id: string; user_id: string; template_id: string; payment_id: string | null; created_at: string };

export type ProjectStatus = "brief" | "building" | "review" | "live";

/**
 * 사이트 제작에 필요한 입력. 위저드(/projects/new)에서 받는다.
 * business · site 는 2026-10 위저드 개편 뒤에 만든 사이트에만 있다 (그 전 사이트는 없음 — 읽는 쪽에서 없을 수 있다고 본다).
 */
export type ProjectBrief = {
  siteName: string;
  industry: string;
  /** 사이트 목적 (고른 목적 + 자세한 설명을 한 문장으로) */
  purpose: string;
  audience: string;
  tone: string[];
  primaryColor: string;
  /** 페이지 이름 목록 (하위 페이지는 "회사 소개 › 인사말") */
  pages: string[];
  features: string[];
  referenceUrls: string[];
  prompt: string;
  /** 회사·서비스 정보: 한 줄 소개 · 서비스 · 강점 · 연락처 */
  business?: BusinessInfo;
  /** 헤더 메뉴·하위 페이지 · 페이지 종류 · 이미지 자리 · AI 이미지 생성 여부 */
  site?: SitePlan;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  template_id: string | null;
  brief: ProjectBrief;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

/**
 * 페이지 캡처. draft 면 위저드 입력으로 그린 구성 초안(/api/drafts/…)이고, slots 는 그 안의 이미지 자리 위치(캡처 픽셀)다.
 * 실제 제작 캡처로 바꿀 때 slots 를 함께 넣으면 편집기의 "이미지 자리" 목록이 그대로 동작한다.
 */
export type Screenshot = { url: string; width: number; height: number; draft?: boolean; slots?: SlotRect[] };

export type ProjectPageRow = {
  id: string;
  project_id: string;
  name: string;
  path: string;
  sort_order: number;
  screenshots: Partial<Record<DeviceKind, Screenshot>>;
};

export type RequestStatus = "pending" | "processing" | "done" | "rejected";

/** 네모 영역은 이미지 픽셀 기준이 아니라 0~1 정규화 좌표로 저장한다 — 캡처가 다시 찍혀 크기가 바뀌어도 위치가 유지된다. */
export type Region = { x: number; y: number; w: number; h: number };

export type ChangeRequestRow = {
  id: string;
  project_id: string;
  page_id: string;
  batch_id: string;
  device: DeviceKind;
  kind: RequestKind;
  status: RequestStatus;
  seq: number;
  region: Region;
  message: string;
  resolution_note: string | null;
  /** 처리 시 기록된 실제 사용 토큰 (AI 반영만). 오류 신고·전문가 요청은 0 */
  tokens_used: number;
  /** 관리자가 질문했고 사용자의 답을 기다리는 중 ("확인 필요"). 0006 적용 전 DB 에는 컬럼이 없다 */
  awaiting_user?: boolean;
  created_at: string;
  resolved_at: string | null;
};

/** supabase/migrations/0006_messages.sql — 사용자 ↔ 관리자 대화. 한 행 = 글 하나 또는 상태 변경 기록 하나 */
export type MessageRole = "user" | "admin";

export type MessageRow = {
  id: string;
  project_id: string;
  /** 있으면 그 요청(네모)의 대화, null 이면 사이트 전체에 대한 메시지 */
  request_id: string | null;
  author_id: string | null;
  author_role: MessageRole;
  body: string | null;
  /** 관리자가 이 기록으로 바꾼 상태. 상태를 바꾸지 않은 글이면 null */
  status: RequestStatus | null;
  created_at: string;
  /** 상대편이 읽은 시각. 사용자 글은 관리자가, 관리자 글은 사용자가 읽으면 찍힌다 */
  read_at: string | null;
};

/** AI 크레딧은 토큰 수, 전문가 크레딧은 횟수 */
export type CreditRow = { user_id: string; kind: CreditKind; balance: number };

export type PaymentKind = "subscription" | "template" | "credits";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type PaymentRow = {
  id: string;
  user_id: string;
  portone_payment_id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  amount_krw: number;
  order_name: string;
  meta: Record<string, unknown>;
  created_at: string;
  paid_at: string | null;
};

/** supabase/migrations/0005_inquiries.sql — 공개 사이트 폼 접수 (상담 · 뉴스레터 · 전문가 지원 · 문의) */
export type InquiryKind = "consultation" | "newsletter" | "application" | "contact";
export type InquiryStatus = "new" | "contacted" | "closed";

export type InquiryRow = {
  id: string;
  kind: InquiryKind;
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  /** 폼별 추가 항목: 상담(siteType · budget · urgency), 지원(role · portfolio · experience) */
  payload: Record<string, unknown>;
  status: InquiryStatus;
  created_at: string;
};
