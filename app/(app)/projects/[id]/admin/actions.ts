"use server";

import { revalidatePath } from "next/cache";

import { getSubscription, requireUser } from "@/lib/auth/session";
import { coerceRow, type Collection } from "@/lib/collections";
import { designOf } from "@/lib/design-doc";
import { getProject } from "@/lib/projects";
import { deleteRow, saveRow } from "@/lib/site-db/data";

export type RowActionState = { error?: string; saved?: boolean } | null;

/** 사이트 주인 · 관리자 페이지를 쓸 수 있는 플랜 · 디자인 문서에 있는 목록인지 확인한다 */
async function guard(projectId: string, collectionKey: string): Promise<{ collection: Collection } | { error: string }> {
  const user = await requireUser(`/projects/${projectId}/admin`);
  const data = await getProject(user.id, projectId);
  if (!data) return { error: "사이트를 찾을 수 없습니다." };
  const { plan } = await getSubscription(user.id);
  if (!plan?.cms) return { error: "관리자 페이지는 비즈니스 플랜부터 쓸 수 있어요." };
  const collection = (designOf(data.project.brief).collections ?? []).find((c) => c.key === collectionKey);
  if (!collection) return { error: "목록을 찾을 수 없습니다." };
  return { collection };
}

/** 새 글 · 고치기 (rowId 가 있으면 고치기) */
export async function saveRowAction(projectId: string, collectionKey: string, rowId: string | null, _prev: RowActionState, formData: FormData): Promise<RowActionState> {
  const g = await guard(projectId, collectionKey);
  if ("error" in g) return { error: g.error };
  const input: Record<string, unknown> = {};
  for (const f of g.collection.fields) input[f.key] = formData.get(f.key) ?? "";
  const { values, errors } = coerceRow(g.collection, input);
  if (errors.length) return { error: errors[0] };
  const res = await saveRow(projectId, g.collection, rowId, values, {
    published: formData.get("published") === "on",
    sort: Number(formData.get("sort") ?? 0),
  });
  if (!res.ok) {
    console.error("[site-admin] save", res.error);
    return { error: "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
  revalidatePath(`/projects/${projectId}/admin`);
  return { saved: true };
}

export async function deleteRowAction(projectId: string, collectionKey: string, rowId: string): Promise<{ error?: string }> {
  const g = await guard(projectId, collectionKey);
  if ("error" in g) return { error: g.error };
  const res = await deleteRow(projectId, g.collection, rowId);
  if (!res.ok) {
    console.error("[site-admin] delete", res.error);
    return { error: "지우지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
  revalidatePath(`/projects/${projectId}/admin`);
  return {};
}
