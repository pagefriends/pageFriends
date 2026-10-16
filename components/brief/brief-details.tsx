import { ExternalLinkIcon } from "lucide-react";

import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTokens } from "@/config/plans";
import { requestStatus } from "@/config/requests";
import type { SlotRequestState } from "@/components/editor/types";
import { SlotPhotos, type PhotoItem } from "@/components/photos/slot-photos";
import {
  FEATURE_LABEL,
  PAGE_KIND_LABEL,
  PURPOSES,
  RATIO_SHAPE,
  RATIO_SIZE,
  emptyImageCount,
  generatedImageCount,
  headerMenu,
  industryOf,
  pageFullName,
  type ImageSlot,
} from "@/lib/site-plan";
import type { ProjectBrief, ProjectPageRow } from "@/lib/types/db";

/**
 * 위저드 입력(제작 정보) 전체. 제작 담당자가 사이트를 만들 때 기준으로 보는 화면이다 (관리자 → 제작 정보).
 * 회사·서비스 → 메뉴 구성(하위 페이지 · 페이지 종류 · 페이지별 메모) → 이미지 자리(필요한 이미지 · AI 생성 여부) → 디자인 순.
 * 위저드 개편 전에 만든 사이트는 business · site 가 없어서 기본 항목만 보인다.
 */
export function BriefDetails({
  brief,
  pages,
  viewer = "admin",
  slotStatus,
  projectId,
  photos = {},
}: {
  brief: ProjectBrief;
  pages: Pick<ProjectPageRow, "path" | "screenshots">[];
  /** admin: 제작 담당자용 문구 · owner: 사이트 주인용 문구 */
  viewer?: "admin" | "owner";
  /** 이미지 자리마다 그 자리에 보낸 요청의 상태 (components/editor/types.ts slotStatuses). 주면 위저드 선택 대신 지금 상태를 보여 준다 */
  slotStatus?: Map<string, SlotRequestState>;
  /** 주면 자리마다 사진 올리기 · 지우기를 보여 준다 */
  projectId?: string;
  /** 자리마다 올린 사진 */
  photos?: Record<string, PhotoItem[]>;
}) {
  const b = brief.business;
  const site = brief.site;
  // 페이지 캡처 주소 (구성 초안이든 실제 캡처든 지금 편집기에 보이는 것)
  const shotUrl = new Map(pages.map((p) => [p.path, p.screenshots.desktop?.url ?? p.screenshots.mobile?.url ?? null]));
  const nameOf = new Map((site?.pages ?? []).map((p) => [p.path, pageFullName(p)]));
  const ind = b ? industryOf(b.category) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>회사 · 서비스</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Item k="회사 · 브랜드">{brief.siteName}</Item>
            <Item k="업종">
              {brief.industry}
              {ind && ind.code !== "etc" && ind.label !== brief.industry ? <span className="text-ink-500"> ({ind.label})</span> : null}
            </Item>
            {b ? <Item k="한 줄 소개 (첫 화면 제목)" wide>{b.tagline}</Item> : null}
            {b ? (
              <Item k={ind?.offeringMenu ?? "서비스"} wide>
                <ul className="flex flex-col gap-1">
                  {b.offerings.map((o, i) => (
                    <li key={i}>
                      <span className="font-medium">{o.name}</span>
                      {o.description ? <span className="text-ink-500"> — {o.description}</span> : null}
                    </li>
                  ))}
                </ul>
              </Item>
            ) : null}
            <Item k="사이트 목적" wide>
              {brief.purpose}
            </Item>
            {b && b.strengths.length ? <Item k="강점">{b.strengths.join(" · ")}</Item> : null}
            {brief.audience ? <Item k="주요 고객">{brief.audience}</Item> : null}
            {b ? (
              <Item k="연락처" wide>
                {[
                  ["전화", b.contact.phone],
                  ["이메일", b.contact.email],
                  ["주소", b.contact.address],
                  ["운영 시간", b.contact.hours],
                ]
                  .filter(([, v]) => v.trim())
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ") || <span className="text-ink-500">{viewer === "admin" ? "받지 않음 — 사용자에게 물어봐야 합니다" : "적지 않았어요. 넣고 싶으면 담당자에게 메시지로 알려 주세요."}</span>}
              </Item>
            ) : null}
            {b?.about ? (
              <Item k="회사 소개 글" wide>
                <span className="whitespace-pre-wrap">{b.about}</span>
              </Item>
            ) : null}
            {b && b.purposes.length ? <Item k="고른 목적">{b.purposes.map((c) => PURPOSES.find((p) => p.code === c)?.label ?? c).join(", ")}</Item> : null}
            {site && viewer === "admin" ? <Item k="입력 방식">{site.mode === "guided" ? "쉬운 모드 (처음 만드는 사용자)" : "직접 구성 (잘 아는 사용자)"}</Item> : null}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>메뉴 구성 · 페이지 {site ? site.pages.length : brief.pages.length}개</CardTitle>
        </CardHeader>
        <CardBody>
          {site ? (
            <>
              <p className="text-xs text-ink-500">헤더 메뉴 순서대로. 하위 페이지가 있는 메뉴는 누르면 첫 하위 페이지로 갑니다.</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <PageLine label="홈" kind={PAGE_KIND_LABEL.home} path="/" url={shotUrl.get("/")} note={site.pages[0]?.note} />
                {headerMenu(site.pages).map((m, i) =>
                  m.children.length ? (
                    <li key={i}>
                      <p className="font-semibold">{m.label}</p>
                      <ul className="mt-1 ml-4 flex flex-col gap-1 border-l border-ink-200 pl-3">
                        {m.children.map((c) => {
                          const p = site.pages.find((x) => x.path === c.path);
                          return <PageLine key={c.path} label={c.label} kind={p ? PAGE_KIND_LABEL[p.kind] : ""} path={c.path} url={shotUrl.get(c.path)} note={p?.note} />;
                        })}
                      </ul>
                    </li>
                  ) : (
                    (() => {
                      const p = site.pages.find((x) => x.path === m.path);
                      return <PageLine key={i} label={m.label} kind={p ? PAGE_KIND_LABEL[p.kind] : ""} path={m.path} url={shotUrl.get(m.path)} note={p?.note} bold />;
                    })()
                  ),
                )}
              </ul>
            </>
          ) : (
            <p className="text-sm">{brief.pages.join(" · ")}</p>
          )}
          {brief.features.length ? (
            <p className="mt-4 text-sm">
              <span className="text-ink-500">기능 </span>
              {brief.features.map((f) => FEATURE_LABEL[f] ?? f).join(", ")}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {site ? (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>이미지 자리 {site.images.length}곳</CardTitle>
            <span className="text-xs text-ink-500">
              {slotStatus
                ? (() => {
                    const have = (id: string) => photos[id]?.length ?? 0;
                    const requested = site.images.filter((s) => slotStatus.has(s.id)).length;
                    const filled = site.images.filter((s) => !slotStatus.has(s.id) && have(s.id) >= s.count).length;
                    const empty = site.images.filter((s) => !slotStatus.has(s.id) && have(s.id) < s.count);
                    const left = empty.reduce((n, s) => n + s.count - have(s.id), 0);
                    return [`요청 ${requested}곳`, filled ? `사진 올림 ${filled}곳` : null, `비어 있음 ${empty.length}곳${empty.length ? ` (사진 ${left}장)` : ""}`]
                      .filter(Boolean)
                      .join(" · ");
                  })()
                : site.imageGeneration.enabled
                  ? `AI 생성 ${generatedImageCount(site.images)}장 (예상 약 ${formatTokens(site.imageGeneration.estimatedTokens)} 토큰) · 비워 둠 ${emptyImageCount(site.images)}장`
                  : `AI 생성 안 함 · 비워 둠 ${emptyImageCount(site.images)}장`}
            </span>
          </CardHeader>
          <ul className="divide-y divide-ink-100">
            {site.images.map((s) => (
              <li key={s.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.label}</span>
                  {s.count > 1 ? <span className="text-xs text-ink-500">{s.count}장</span> : null}
                  <SlotBadge slot={s} status={slotStatus ? (slotStatus.get(s.id) ?? null) : undefined} photos={photos[s.id]?.length ?? 0} />
                  <span className="text-xs text-ink-500">
                    {RATIO_SIZE[s.ratio]} · {RATIO_SHAPE[s.ratio]} · {s.pages.map((p) => nameOf.get(p) ?? p).join(", ")}
                  </span>
                </div>
                <p className="mt-1 text-ink-700">{s.need}</p>
                {projectId && !slotStatus?.has(s.id) ? (
                  <SlotPhotos projectId={projectId} slotId={s.id} label={s.label} count={s.count} photos={photos[s.id] ?? []} size="md" className="mt-2" />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>디자인 · 추가 요청</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Item k="메인 색상">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block size-4 rounded-sm" style={{ background: brief.primaryColor }} /> {brief.primaryColor}
              </span>
            </Item>
            <Item k="디자인 톤">{brief.tone.join(", ") || "-"}</Item>
            {brief.referenceUrls.length ? (
              <Item k="참고 사이트" wide>
                <ul className="flex flex-col gap-0.5">
                  {brief.referenceUrls.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer noopener" className="break-all text-brand-600 hover:underline">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              </Item>
            ) : null}
            {brief.prompt ? (
              <Item k="추가 요청 · 프롬프트" wide>
                <span className="whitespace-pre-wrap">{brief.prompt}</span>
              </Item>
            ) : null}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * 자리 상태 표시. status 가 undefined 면 위저드에서 고른 그대로(AI로 만들기 · 실제 사진 필요 · 비워 둠),
 * null 이면 요청이 없는 빈 자리, 값이 있으면 그 자리에 보낸 요청의 상태.
 */
function SlotBadge({ slot, status, photos }: { slot: ImageSlot; status: SlotRequestState | null | undefined; photos: number }) {
  if (status) {
    const st = requestStatus(status.kind, status.status);
    return <Badge tone={st.tone}>{st.label}</Badge>;
  }
  if (photos >= slot.count) return <Badge tone="sky">사진 올림</Badge>;
  if (photos > 0) return <Badge tone="blue">{`사진 ${photos}/${slot.count}장`}</Badge>;
  if (status === undefined && slot.generate) return <Badge tone="blue">AI로 만들기</Badge>;
  if (slot.source === "real") return <Badge tone="dark">실제 사진 필요</Badge>;
  return <Badge tone="gray">{status === null ? "비어 있음 · AI 가능" : "비워 둠 · AI 가능"}</Badge>;
}

function Item({ k, wide, children }: { k: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-ink-500">{k}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function PageLine({ label, kind, path, url, note, bold }: { label: string; kind: string; path: string; url?: string | null; note?: string; bold?: boolean }) {
  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={bold ? "font-semibold" : undefined}>{label}</span>
        <span className="text-xs text-ink-500">
          {kind} · {path}
        </span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline">
            화면 보기 <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </div>
      {note ? <p className="mt-0.5 text-xs whitespace-pre-wrap text-ink-700">메모: {note}</p> : null}
    </li>
  );
}
