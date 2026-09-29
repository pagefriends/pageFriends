import type { DeviceKind, RequestKind } from "@/config/plans";
import type { ChangeRequestRow, Region, Screenshot } from "@/lib/types/db";

/** 아직 제출하지 않은 네모. 좌표는 캡처 이미지 픽셀 기준 (줌과 무관). */
export type DraftBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  message: string;
  kind: RequestKind;
};

export type EditorPage = {
  id: string;
  name: string;
  path: string;
  screenshots: Partial<Record<DeviceKind, Screenshot>>;
};

export type ExistingRequest = Pick<ChangeRequestRow, "id" | "seq" | "region" | "status" | "kind" | "message" | "page_id" | "device">;

/** 제출 payload 항목 (submit_change_requests RPC 의 p_items 와 동일) */
export type SubmitItem = {
  page_id: string;
  device: DeviceKind;
  kind: RequestKind;
  seq: number;
  region: Region;
  message: string;
};

export const draftKey = (pageId: string, device: DeviceKind) => `${pageId}:${device}`;

export function toRegion(d: DraftBox, shot: Screenshot): Region {
  return { x: d.x / shot.width, y: d.y / shot.height, w: d.w / shot.width, h: d.h / shot.height };
}
