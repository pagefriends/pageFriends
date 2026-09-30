import type { CreditKind, DeviceKind, PlanCode, RequestKind } from "@/config/plans";

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

/** 사이트 제작에 필요한 필수 입력. 위저드(/projects/new)에서 받는다. */
export type ProjectBrief = {
  siteName: string;
  industry: string;
  purpose: string;
  audience: string;
  tone: string[];
  primaryColor: string;
  pages: string[];
  features: string[];
  referenceUrls: string[];
  prompt: string;
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

export type Screenshot = { url: string; width: number; height: number };

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
  created_at: string;
  resolved_at: string | null;
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
