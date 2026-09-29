import { notFound } from "next/navigation";

import { ProjectEditor } from "@/components/editor/editor";
import { PLAN_BY_CODE } from "@/config/plans";
import { getSubscription, requireUser } from "@/lib/auth/session";
import { getProject, listProjectRequests } from "@/lib/projects";
import { getQuota } from "@/lib/quota";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/projects/${id}`);
  const data = await getProject(user.id, id);
  if (!data) notFound();

  const [{ plan }, requests] = await Promise.all([getSubscription(user.id), listProjectRequests(id)]);
  const quota = await getQuota(user.id, plan);
  // 플랜이 없으면 스타터 기준 화면만 보여주고, 제출은 패널에서 막는다
  const devices = (plan ?? PLAN_BY_CODE.starter).devices;

  return (
    <ProjectEditor
      projectId={id}
      projectName={data.project.name}
      pages={data.pages.map((p) => ({ id: p.id, name: p.name, path: p.path, screenshots: p.screenshots }))}
      allowedDevices={devices}
      existing={requests.map((r) => ({ id: r.id, seq: r.seq, region: r.region, status: r.status, kind: r.kind, message: r.message, page_id: r.page_id, device: r.device }))}
      quota={quota}
      hasPlan={Boolean(plan)}
    />
  );
}
