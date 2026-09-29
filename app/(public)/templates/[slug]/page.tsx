import { CheckIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PayButton } from "@/components/billing/pay-button";
import { buttonClass } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { formatKrw } from "@/config/plans";
import { getSessionUser } from "@/lib/auth/session";
import { getClientEnv } from "@/lib/env";
import { getTemplateBySlug, listPurchasedTemplateIds } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params }: PageProps<"/templates/[slug]">) {
  const { slug } = await params;
  const template = await getTemplateBySlug(slug);
  if (!template) notFound();

  const user = await getSessionUser();
  const purchased = user ? (await listPurchasedTemplateIds(user.id)).has(template.id) : false;
  const env = getClientEnv();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/templates" className="text-sm text-ink-500 hover:text-ink-900">
        ← 템플릿 목록
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          {template.preview_urls.map((url, i) => (
            <div key={url + i} className="overflow-hidden rounded-md border border-ink-200 bg-ink-50">
              <div className="relative max-h-[560px] overflow-hidden">
                <Image src={url} alt={`${template.name} 미리보기 ${i + 1}`} width={1440} height={900} className="h-auto w-full" unoptimized />
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-md border border-ink-200 p-5 lg:sticky lg:top-20">
          <div className="flex items-center gap-2">
            <Badge tone={template.kind === "live" ? "blue" : "gray"}>{template.kind === "live" ? "운영 사이트" : "데모 사이트"}</Badge>
            <span className="text-xs text-ink-500">{template.category}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{template.name}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{template.description}</p>

          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] text-ink-700">
            <li className="flex gap-2">
              <CheckIcon className="mt-0.5 size-3.5 text-brand-600" />
              페이지 구성: {template.pages.join(" · ")}
            </li>
            <li className="flex gap-2">
              <CheckIcon className="mt-0.5 size-3.5 text-brand-600" />
              구매 후 여러 프로젝트에 사용 가능
            </li>
            {template.kind === "live" ? (
              <li className="flex gap-2">
                <CheckIcon className="mt-0.5 size-3.5 text-brand-600" />
                실제 운영 중인 사이트 · 소유자 동의 완료
              </li>
            ) : null}
          </ul>

          <p className="mt-5 text-2xl font-bold">{formatKrw(template.price_krw)}</p>
          <p className="text-xs text-ink-500">플랜과 별도 · 1회 결제</p>

          <div className="mt-4">
            {purchased ? (
              <div className="flex flex-col gap-2">
                <Alert tone="blue">이미 구매한 템플릿입니다.</Alert>
                <Link href={`/projects/new?template=${template.slug}`} className={buttonClass("primary", "md", "w-full")}>
                  이 템플릿으로 프로젝트 만들기
                </Link>
              </div>
            ) : user ? (
              <PayButton
                purchase={{ kind: "template", templateId: template.id }}
                storeId={env.NEXT_PUBLIC_PORTONE_STORE_ID}
                channelKey={env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY}
                customerEmail={user.email}
                className="w-full"
              >
                {formatKrw(template.price_krw)}에 구매
              </PayButton>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/templates/${template.slug}`)}`} className={buttonClass("primary", "md", "w-full")}>
                로그인 후 구매
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
