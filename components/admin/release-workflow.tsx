"use client";

import { CheckIcon, DatabaseIcon, ExternalLinkIcon, LoaderCircleIcon, LockIcon, RotateCcwIcon, ServerIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  cancelReleaseByAdminAction,
  publishReleaseAction,
  reportReleaseIssueAction,
  setReleaseCheckAction,
  setReleaseDbChangeAction,
  stageReleaseAction,
  type ReleaseActionResult,
} from "@/app/(admin)/admin/releases/actions";
import { RegionThumb } from "@/components/messages/region-thumb";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint, Input, Label, Textarea } from "@/components/ui/input";
import { DEVICE_LABEL, REQUEST_KIND_LABEL, type DeviceKind, type RequestKind } from "@/config/plans";
import { REQUEST_KIND_TONE } from "@/config/requests";
import { CHECK_LABEL, looksLikeDataChange, releaseStage, remainingChecks, requestCheckKey } from "@/config/releases";
import type { Region, ReleaseRow, Screenshot } from "@/lib/types/db";
import { cn, formatDateTime } from "@/lib/utils";

export type WorkflowItem = {
  id: string;
  seq: number;
  pageName: string;
  pagePath: string;
  device: DeviceKind;
  kind: RequestKind;
  message: string;
  shot: Screenshot | null;
  region: Region;
};

type Feedback = { tone: "blue" | "red"; text: string } | null;

/**
 * 웹사이트 적용 세 단계 (관리자). 실제 배포는 담당자가 평소 쓰는 방법으로 하고 여기서는 단계마다 기록한다.
 *   ① 개발 서버에 배포 — 주소를 남긴다. 운영은 아직 그대로.
 *   ② 개발 서버에서 확인 — 사이트 열림 · 실린 수정마다 · 화면 크기 · (폼·DB 변경이면) 개발 DB. 문제가 있으면 다시 고치기 → ①.
 *   ③ 운영에 배포 — ② 를 모두 체크해야 열린다 (폼·DB 변경이면 운영 DB 반영도 먼저). DB 함수가 같은 규칙으로 다시 검사한다.
 *
 * 체크는 누르는 즉시 저장한다 (다른 담당자 · 새로 고침에도 남게). 서버 값이 바뀌면 화면 값을 그 값으로 맞춘다.
 */
export function ReleaseWorkflow({
  release,
  items,
  defaults,
  pageCount,
  screensLabel,
  waitingOutside,
}: {
  release: Pick<
    ReleaseRow,
    "id" | "status" | "staging_rounds" | "staging_url" | "staging_at" | "checks" | "db_change" | "issue_note" | "production_url" | "live_at" | "first_publish"
  >;
  items: WorkflowItem[];
  /** 주소 칸에 미리 채울 값 (이 사이트의 지난 적용에서 쓴 주소) */
  defaults: { stagingUrl: string; productionUrl: string };
  pageCount: number;
  /** "모바일 · 태블릿 · 웹" */
  screensLabel: string;
  /** 끝났지만 아직 어느 적용에도 실리지 않은 수정 수 — 개발 서버에 (다시) 배포하면 같이 실린다 */
  waitingOutside: number;
}) {
  const router = useRouter();
  const stage = releaseStage(release);
  const staged = stage === "staging";
  const active = stage === "new" || stage === "fixing" || stage === "staging";

  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  // 마지막으로 누른 동작. 단계가 바뀌면 그 동작의 안내만 남기고 이전 단계의 안내는 지운다
  const [lastRun, setLastRun] = useState<string | null>(null);

  // 서버 값이 바뀌면(저장 · 다른 담당자 · 단계 변경) 화면 값을 맞춘다
  const stageKey = `${release.status}:${release.staging_rounds}`;
  const serverKey = JSON.stringify([stageKey, release.checks, release.db_change]);
  const [seen, setSeen] = useState({ serverKey, stageKey });
  const [checks, setChecks] = useState<Record<string, boolean>>(release.checks ?? {});
  const [dbChange, setDbChange] = useState(release.db_change);
  if (seen.serverKey !== serverKey) {
    if (seen.stageKey !== stageKey) setFeedback((f) => (lastRun ? { [lastRun]: f[lastRun] ?? null } : {}));
    setSeen({ serverKey, stageKey });
    setChecks(release.checks ?? {});
    setDbChange(release.db_change);
  }

  const [stagingUrl, setStagingUrl] = useState(release.staging_url ?? defaults.stagingUrl);
  const [productionUrl, setProductionUrl] = useState(release.production_url ?? defaults.productionUrl);
  const [restage, setRestage] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const run = (key: string, action: () => Promise<ReleaseActionResult>, after?: () => void) => {
    setBusy(key);
    setLastRun(key);
    setFeedback((f) => ({ ...f, [key]: null }));
    start(async () => {
      const res = await action();
      setBusy(null);
      setFeedback((f) => ({ ...f, [key]: res.ok ? (res.message ? { tone: "blue", text: res.message } : null) : { tone: "red", text: res.error } }));
      if (res.ok) after?.();
      router.refresh();
    });
  };

  // 체크는 화면에 먼저 반영하고 저장한다. 저장이 거절되면 되돌린다 (서버 값이 그대로라 위의 맞추기로는 돌아오지 않는다)
  const toggle = (key: string, value: boolean) => {
    if (!staged) return;
    const before = checks[key] ?? false;
    setChecks((c) => ({ ...c, [key]: value }));
    setFeedback((f) => ({ ...f, checks: null }));
    start(async () => {
      const res = await setReleaseCheckAction(release.id, key, value);
      if (!res.ok) {
        setChecks((c) => ({ ...c, [key]: before }));
        setFeedback((f) => ({ ...f, checks: { tone: "red", text: res.error } }));
      }
    });
  };

  const toggleDb = (value: boolean) => {
    setDbChange(value);
    setFeedback((f) => ({ ...f, db: null }));
    start(async () => {
      const res = await setReleaseDbChangeAction(release.id, value);
      if (!res.ok) {
        setDbChange(!value);
        setFeedback((f) => ({ ...f, db: { tone: "red", text: res.error } }));
      }
    });
  };

  const itemIds = items.map((i) => i.id);
  const left = remainingChecks(checks, dbChange, itemIds);
  const devLeft = remainingChecks({ ...checks, db_prod: true }, dbChange, itemIds);
  const dataHints = items.filter((i) => looksLikeDataChange(i.message));

  return (
    <div className="flex flex-col gap-6">
      {/* ① 개발 서버에 배포 */}
      <Card className={cn(stage === "new" || stage === "fixing" ? "border-sky-400" : undefined)}>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <StepNo n={1} done={staged || stage === "live"} /> 개발 서버에 배포
          </CardTitle>
          {release.staging_rounds > 0 ? <span className="text-xs text-ink-500">{release.staging_rounds}번째 배포</span> : null}
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {stage === "fixing" && release.issue_note ? (
            <Alert tone="red">
              <p className="flex items-center gap-1.5 font-medium">
                <TriangleAlertIcon className="size-4" /> 개발 서버 확인에서 찾은 문제
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px]">{release.issue_note}</p>
              <p className="mt-1.5 text-xs">고친 뒤 개발 서버에 다시 배포하고 아래 버튼을 눌러 주세요. 확인 목록은 처음부터 다시 합니다.</p>
            </Alert>
          ) : null}
          {release.staging_at && release.staging_url && (staged || stage === "live") ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CheckIcon className="size-4 text-sky-600" />
              <span>{formatDateTime(release.staging_at)} 개발 서버 배포</span>
              <a href={release.staging_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-brand-600 hover:underline">
                {release.staging_url} <ExternalLinkIcon className="size-3.5 shrink-0" />
              </a>
            </p>
          ) : null}
          {stage === "new" ? <p className="text-sm text-ink-700">평소 쓰는 방법으로 개발 서버(확인용)에 먼저 배포한 뒤, 그 주소를 넣고 눌러 주세요. 운영 사이트는 아직 바꾸지 않습니다.</p> : null}
          {waitingOutside > 0 && active ? (
            <Alert tone="gray" className="text-[13px]">
              끝났지만 아직 실리지 않은 수정이 {waitingOutside}건 있습니다. 개발 서버에 {staged ? "다시 " : ""}배포하면 그 빌드에 들어 있으므로 이 적용에 같이 실려 확인 목록에 추가됩니다.
            </Alert>
          ) : null}
          {stage === "new" || stage === "fixing" || (staged && restage) ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run("stage", () => stageReleaseAction(release.id, stagingUrl), () => setRestage(false));
              }}
            >
              <Label htmlFor="staging-url">개발 서버 주소</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="staging-url" value={stagingUrl} onChange={(e) => setStagingUrl(e.target.value)} placeholder="https://dev.example.com" inputMode="url" className="flex-1" />
                <Button type="submit" disabled={pending}>
                  {busy === "stage" ? <LoaderCircleIcon className="size-4 animate-spin" /> : <ServerIcon className="size-4" />}
                  {stage === "fixing" ? "고친 뒤 다시 배포했어요" : staged ? "다시 배포했어요" : "개발 서버에 배포했어요"}
                </Button>
              </div>
              {staged ? <Hint>다시 배포하면 확인 목록은 처음부터 다시 합니다.</Hint> : null}
            </form>
          ) : null}
          {staged && !restage ? (
            <button type="button" onClick={() => setRestage(true)} className="self-start text-xs text-ink-500 underline hover:text-ink-900">
              개발 서버에 다시 배포했나요?
            </button>
          ) : null}
          <FeedbackLine value={feedback.stage} />
        </CardBody>
      </Card>

      {/* ② 개발 서버에서 확인 */}
      <Card className={cn(staged ? "border-sky-400" : undefined)}>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <StepNo n={2} done={stage === "live"} /> 개발 서버에서 확인
          </CardTitle>
          {staged ? (
            <span className={cn("text-xs tabular-nums", devLeft === 0 ? "font-semibold text-sky-600" : "text-ink-500")}>
              {devLeft === 0 ? "모두 확인했어요" : `남은 확인 ${devLeft}개`}
            </span>
          ) : null}
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {!staged && stage !== "live" ? (
            <p className="flex items-center gap-1.5 text-sm text-ink-500">
              <LockIcon className="size-3.5" /> 개발 서버에 배포하면 확인할 수 있습니다.
            </p>
          ) : null}

          {active ? (
            <div className="rounded-md border border-ink-200 px-3 py-2.5">
              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={dbChange}
                  disabled={pending}
                  onChange={(e) => toggleDb(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-sky-400"
                />
                <span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <DatabaseIcon className="size-3.5" /> 폼·DB 구조 변경이 있어요
                  </span>{" "}
                  <span className="text-ink-500">(예: 문의하기에 받을 항목 추가) — 켜면 개발 DB · 운영 DB 확인이 더해집니다. 운영 DB에 새 항목이 먼저 있어야 운영 사이트가 오류 없이 저장합니다.</span>
                </span>
              </label>
              {dataHints.length > 0 && !dbChange ? (
                <p className="mt-1.5 pl-6.5 text-xs font-medium text-sky-600">
                  {dataHints.map((i) => `${i.seq}번`).join(" · ")} 수정이 폼·DB를 바꾸는 수정 같아요. 맞다면 켜 두세요.
                </p>
              ) : null}
              <FeedbackLine value={feedback.db} />
            </div>
          ) : release.db_change ? (
            <p className="inline-flex items-center gap-1 text-xs text-ink-500">
              <DatabaseIcon className="size-3.5" /> 폼·DB 구조 변경 포함
            </p>
          ) : null}

          <ul className="flex flex-col gap-2">
            <CheckRow
              checked={Boolean(checks.site)}
              disabled={!staged}
              onChange={(v) => toggle("site", v)}
              label={`${CHECK_LABEL.site} (페이지 ${pageCount}개)`}
              extra={
                release.staging_url && (staged || stage === "live") ? (
                  <a href={release.staging_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    개발 서버 열기 <ExternalLinkIcon className="size-3" />
                  </a>
                ) : null
              }
            />
            {items.map((i) => (
              <CheckRow
                key={i.id}
                checked={Boolean(checks[requestCheckKey(i.id)])}
                disabled={!staged}
                onChange={(v) => toggle(requestCheckKey(i.id), v)}
                label={
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span className="grid size-5 place-items-center bg-mark text-[10px] font-semibold text-white">{i.seq}</span>
                      <span className="font-medium text-ink-900">{i.pageName}</span>
                      <span>{i.pagePath}</span>
                      <span>{DEVICE_LABEL[i.device]}</span>
                      <Badge tone={REQUEST_KIND_TONE[i.kind]}>{REQUEST_KIND_LABEL[i.kind]}</Badge>
                    </span>
                    <span className="line-clamp-3 text-[13px] break-words text-ink-900">{i.message}</span>
                    <span className="text-xs text-ink-500">→ 개발 서버에서 요청대로 바뀌었다</span>
                  </span>
                }
                extra={
                  <span className="flex items-start gap-2">
                    {i.shot ? <RegionThumb shot={i.shot} region={i.region} width={96} height={64} /> : null}
                    <Link href={`/admin/requests/${i.id}`} className="text-xs font-medium whitespace-nowrap text-brand-600 hover:underline">
                      요청 보기
                    </Link>
                  </span>
                }
              />
            ))}
            <CheckRow checked={Boolean(checks.screens)} disabled={!staged} onChange={(v) => toggle("screens", v)} label={`${screensLabel} ${CHECK_LABEL.screens}`} />
            {dbChange ? <CheckRow checked={Boolean(checks.db_dev)} disabled={!staged} onChange={(v) => toggle("db_dev", v)} label={CHECK_LABEL.db_dev} icon={<DatabaseIcon className="size-3.5 text-ink-500" />} /> : null}
          </ul>
          {items.length === 0 ? <p className="text-xs text-ink-500">{release.first_publish ? "첫 공개라 실린 수정 없이 사이트 전체를 확인합니다." : "실린 수정이 없습니다."}</p> : null}
          <FeedbackLine value={feedback.checks} />

          {staged ? (
            issueOpen ? (
              <form
                className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run("issue", () => reportReleaseIssueAction(release.id, issue), () => {
                    setIssue("");
                    setIssueOpen(false);
                  });
                }}
              >
                <Label htmlFor="issue">개발 서버에서 찾은 문제</Label>
                <Textarea id="issue" value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="예: 모바일에서 문의 폼의 새 항목이 화면 밖으로 밀려남" maxLength={1000} className="min-h-20 text-[13px]" />
                <Hint>운영에는 올리지 않고 ① 로 돌아갑니다. 사용자에게는 계속 &lsquo;점검 중&rsquo; 으로 보입니다.</Hint>
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" size="sm" disabled={pending || !issue.trim()}>
                    {busy === "issue" ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <RotateCcwIcon className="size-3.5" />} 다시 고치기로 돌리기
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIssueOpen(false)}>
                    닫기
                  </Button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setIssueOpen(true)} className="inline-flex items-center gap-1 self-start text-xs font-medium text-mark hover:underline">
                <TriangleAlertIcon className="size-3.5" /> 문제가 있나요? 다시 고치기
              </button>
            )
          ) : null}
          <FeedbackLine value={feedback.issue} />
        </CardBody>
      </Card>

      {/* ③ 운영에 배포 */}
      <Card className={cn(staged && left === 0 ? "border-sky-400" : undefined)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StepNo n={3} done={stage === "live"} /> 운영에 배포
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {stage === "live" ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <CheckIcon className="size-4 text-sky-600" />
              <span>{release.live_at ? formatDateTime(release.live_at) : ""} 운영 반영</span>
              {release.production_url ? (
                <a href={release.production_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-brand-600 hover:underline">
                  {release.production_url} <ExternalLinkIcon className="size-3.5 shrink-0" />
                </a>
              ) : null}
              <span className="text-xs text-ink-500">· 사용자에게 &lsquo;적용 완료&rsquo; 를 알렸습니다</span>
            </p>
          ) : active ? (
            <>
              {dbChange ? (
                <ul>
                  <CheckRow checked={Boolean(checks.db_prod)} disabled={!staged} onChange={(v) => toggle("db_prod", v)} label={CHECK_LABEL.db_prod} icon={<DatabaseIcon className="size-3.5 text-ink-500" />} />
                </ul>
              ) : null}
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!window.confirm("운영에 배포했나요? 사용자에게 '적용 완료' 와 웹사이트 주소가 메시지로 갑니다.")) return;
                  run("live", () => publishReleaseAction(release.id, productionUrl));
                }}
              >
                <Label htmlFor="production-url">운영 사이트 주소 (사용자에게 보입니다)</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="production-url" value={productionUrl} onChange={(e) => setProductionUrl(e.target.value)} placeholder="https://www.example.com" inputMode="url" className="flex-1" disabled={!staged} />
                  <Button type="submit" disabled={pending || !staged || left > 0}>
                    {busy === "live" ? <LoaderCircleIcon className="size-4 animate-spin" /> : !staged || left > 0 ? <LockIcon className="size-4" /> : <CheckIcon className="size-4" />}
                    운영에 배포했어요
                  </Button>
                </div>
                <Hint>
                  {!staged
                    ? "개발 서버에 배포하고 확인을 마쳐야 열립니다."
                    : left > 0
                      ? `남은 확인 ${left}개 — 개발 서버 확인${dbChange ? "과 운영 DB 반영" : ""}을 모두 마쳐야 운영에 배포할 수 있습니다.`
                      : "운영에 배포한 뒤 눌러 주세요. 사용자에게 '적용 완료' 와 이 주소가 메시지로 갑니다."}
                </Hint>
              </form>
            </>
          ) : (
            <p className="text-sm text-ink-500">취소된 적용입니다.</p>
          )}
          <FeedbackLine value={feedback.live} />
        </CardBody>
      </Card>

      {active ? (
        cancelOpen ? (
          <form
            className="flex flex-col gap-2 rounded-md border border-ink-200 bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run("cancel", () => cancelReleaseByAdminAction(release.id, cancelNote), () => setCancelOpen(false));
            }}
          >
            <Label htmlFor="cancel-note">취소 사유 (사용자에게 보입니다 · 선택)</Label>
            <Input id="cancel-note" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} placeholder="예: 같은 요청이 두 번 들어왔어요" maxLength={500} />
            <Hint>실렸던 수정은 다시 &lsquo;적용 대기&rsquo; 로 돌아가고, 사용자에게 메시지가 갑니다.</Hint>
            <div className="flex gap-2">
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                {busy === "cancel" ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : null} 적용 요청 취소하기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)}>
                닫기
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setCancelOpen(true)} className="self-start text-xs text-ink-500 underline hover:text-ink-900">
            이 적용 요청 취소하기
          </button>
        )
      ) : null}
      <FeedbackLine value={feedback.cancel} />
    </div>
  );
}

function StepNo({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", done ? "bg-sky-400 text-night-950" : "bg-ink-900 text-ink-50")}>
      {done ? <CheckIcon className="size-3.5" /> : n}
    </span>
  );
}

function CheckRow({
  checked,
  disabled,
  onChange,
  label,
  extra,
  icon,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  extra?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <li className={cn("flex items-start gap-3 rounded-md border px-3 py-2.5", checked ? "border-sky-200 bg-sky-50" : "border-ink-200", disabled && "opacity-60")}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed">
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-sky-400" />
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <span className="min-w-0 flex-1">{label}</span>
      </label>
      {extra ? <span className="shrink-0">{extra}</span> : null}
    </li>
  );
}

function FeedbackLine({ value }: { value: Feedback | undefined }) {
  if (!value) return null;
  return <p className={cn("text-xs", value.tone === "red" ? "text-mark" : "text-brand-700")}>{value.text}</p>;
}
