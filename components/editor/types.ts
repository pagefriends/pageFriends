import type { StyleId } from "@/config/design-styles";
import type { DeviceKind, RequestKind } from "@/config/plans";
import type { ImageSlot } from "@/lib/site-plan";
import type { ChangeRequestRow, Region, RequestStatus, Screenshot } from "@/lib/types/db";

/** 페이지의 이미지 자리 (위저드에서 정한 설명) + 고객이 올린 사진. 위치는 캡처의 screenshots[device].slots 에 있다 */
export type EditorSlot = Pick<ImageSlot, "id" | "label" | "need" | "ratio" | "count" | "source" | "generate"> & {
  photos?: { name: string; url: string }[];
};

/** 아직 제출하지 않은 네모. 좌표는 캡처 이미지 픽셀 기준 (줌과 무관). */
export type DraftBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  message: string;
  kind: RequestKind;
  /** AI 반영 네모의 디자인 유형. 비어 있으면(undefined) 사이트의 디자인 유형을 쓴다 */
  styles?: StyleId[];
  /** AI 반영 네모의 참고 템플릿 (구매한 템플릿 id) */
  templateId?: string | null;
};

/** 편집기의 참고 템플릿 목록 (구매한 것만 고를 수 있다) */
export type EditorTemplate = { id: string; name: string; tags: StyleId[]; purchased: boolean; slug: string };

/** 캡처 주소에 적힌 디자인 버전 (/api/drafts/…?v=3 → 3, 없으면 0) */
export function shotVersion(url: string): number {
  const m = /[?&]v=(\d+)/.exec(url);
  return m ? Number(m[1]) : 0;
}

export type EditorPage = {
  id: string;
  name: string;
  path: string;
  screenshots: Partial<Record<DeviceKind, Screenshot>>;
  /** 메뉴에 보이는 짧은 이름 (하위 페이지면 상위 메뉴 이름을 뺀 것) */
  label?: string;
  /** 상위 메뉴 이름. 하위 페이지만 있다 */
  group?: string | null;
  /** 이 페이지의 이미지 자리 (구성 초안으로 만든 사이트만) */
  slots?: EditorSlot[];
};

/** 이미 보낸 요청. 대화 요약은 오른쪽 패널의 "보낸 요청" 목록이 쓴다. */
export type ExistingRequest = Pick<ChangeRequestRow, "id" | "seq" | "region" | "status" | "kind" | "message" | "page_id" | "device"> & {
  /** 담당자가 내 답을 기다리는 중 ("확인 필요") */
  awaiting?: boolean;
  /** 담당자의 마지막 글. 글 없이 상태만 바꿨으면 그 안내 문장 */
  lastReply?: string | null;
  /** 그 마지막 글을 AI 가 썼다 (messages.via = 'ai') */
  lastReplyByAi?: boolean;
  /** 아직 안 읽은 담당자 글이 있다 */
  unread?: boolean;
  /** 사람이 답하는 요청(전문가 요청 · 오류 신고)이 아직 열려 있으면 답변 기한 ("10월 18일 오후 03:10까지") */
  due?: string | null;
};

/** 제출 payload 항목 (submit_change_requests RPC 의 p_items 와 동일) */
export type SubmitItem = {
  page_id: string;
  device: DeviceKind;
  kind: RequestKind;
  seq: number;
  region: Region;
  message: string;
  /** 네모를 그린 화면의 디자인 버전 (서버가 그사이 바뀌었는지 본다) */
  version: number;
  /** AI 반영 네모의 디자인 유형 · 참고 템플릿 */
  options?: { styles: StyleId[]; templateId: string | null };
};

export const draftKey = (pageId: string, device: DeviceKind) => `${pageId}:${device}`;

const near = (a: number, b: number) => Math.abs(a - b) < 0.002;

/**
 * 이미지 자리에 정확히 겹쳐 보낸 요청 (위저드의 AI 이미지 생성 요청, 편집기의 "AI로 만들기").
 * 요청은 화면 하나에만 그려지지만 이미지는 모든 화면에 같으므로, 다른 화면에서 보낸 요청도 그 화면의 자리 위치로 찾는다.
 * existing 은 최신순이라 자리마다 가장 최근 요청이 남는다. 반영 불가는 다시 요청할 수 있게 뺀다.
 */
export function requestsBySlot<R extends Pick<ExistingRequest, "page_id" | "device" | "region" | "status">>(page: Pick<EditorPage, "id" | "screenshots">, existing: R[]): Map<string, R> {
  const out = new Map<string, R>();
  for (const r of existing) {
    if (r.page_id !== page.id || r.status === "rejected") continue;
    const shot = page.screenshots[r.device];
    for (const s of shot?.slots ?? []) {
      if (out.has(s.id)) continue;
      if (near(r.region.x, s.x / shot!.width) && near(r.region.y, s.y / shot!.height) && near(r.region.w, s.w / shot!.width) && near(r.region.h, s.h / shot!.height)) {
        out.set(s.id, r);
      }
    }
  }
  return out;
}

export function toRegion(d: DraftBox, shot: Screenshot): Region {
  return { x: d.x / shot.width, y: d.y / shot.height, w: d.w / shot.width, h: d.h / shot.height };
}

/** 사이트 전체에서 이미지 자리마다 그 자리에 보낸 가장 최근 요청의 상태 (제작 정보 화면 · 준비할 사진 수). requests 는 최신순 */
export type SlotRequestState = { status: RequestStatus; kind: RequestKind };

export function slotStatuses<R extends Pick<ExistingRequest, "page_id" | "device" | "region" | "status" | "kind">>(
  pages: Pick<EditorPage, "id" | "screenshots">[],
  requests: R[],
): Map<string, SlotRequestState> {
  const out = new Map<string, SlotRequestState>();
  for (const page of pages) {
    for (const [slotId, r] of requestsBySlot(page, requests)) if (!out.has(slotId)) out.set(slotId, { status: r.status, kind: r.kind });
  }
  return out;
}
