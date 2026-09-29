import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/card";
import { TEMPLATE_PRICE_KRW, formatKrw } from "@/config/plans";
import { listTemplates } from "@/lib/templates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "템플릿" };
export const dynamic = "force-dynamic";

const KINDS = [
  { key: "all", label: "전체" },
  { key: "demo", label: `데모 사이트 · ${formatKrw(TEMPLATE_PRICE_KRW.demo)}` },
  { key: "live", label: `운영 사이트 · ${formatKrw(TEMPLATE_PRICE_KRW.live)}` },
] as const;

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const sp = await searchParams;
  const kind = sp.kind === "demo" || sp.kind === "live" ? sp.kind : undefined;
  const { templates, error } = await listTemplates(kind);

  return (
    <>
      <section className="bg-night-950 text-white">
        <div className="mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 lg:pt-20">
          <p className="eyebrow text-sky-400">템플릿</p>
          <h1 className="display mt-4 max-w-3xl text-[40px] sm:text-6xl">
            완성된 디자인에서
            <br />
            시작하세요
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            완성된 디자인의 데모 사이트와, 실제 운영 중인 사이트(소유자 동의) 중에서 고르세요. 템플릿 없이 프롬프트만으로 시작해도 됩니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {KINDS.map((k) => {
              const active = (kind ?? "all") === k.key;
              return (
                <Link
                  key={k.key}
                  href={k.key === "all" ? "/templates" : `/templates?kind=${k.key}`}
                  className={cn("rounded-full border px-4 py-2 text-[13px] font-semibold", active ? "border-sky-400 bg-sky-400 text-night-950" : "border-white/20 text-white/80 hover:border-white")}
                >
                  {k.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          {error ? (
            <Alert tone="gray">
              템플릿을 불러오지 못했습니다. Supabase 설정(.env.local)과 <code>supabase/migrations</code>·<code>seed.sql</code> 적용 여부를 확인하세요.
              <span className="mt-1 block text-xs text-ink-500">{error}</span>
            </Alert>
          ) : null}

          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id} className="group overflow-hidden rounded-2xl border border-ink-200 bg-white transition-colors hover:border-ink-900">
                <Link href={`/templates/${t.slug}`}>
                  <div className="relative aspect-[4/3] border-b border-ink-100 bg-ink-50">
                    <Image src={t.thumbnail_url} alt={t.name} fill className="object-cover" unoptimized />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-bold">{t.name}</p>
                      <Badge tone={t.kind === "live" ? "blue" : "gray"}>{t.kind === "live" ? "운영 사이트" : "데모"}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">{t.category}</p>
                    <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-ink-600">{t.description}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {t.pages.map((p) => (
                        <span key={p} className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                          #{p}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-base font-bold">{formatKrw(t.price_krw)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {!error && templates.length === 0 ? <p className="text-sm text-ink-500">아직 등록된 템플릿이 없습니다.</p> : null}

          <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl bg-night-950 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-bold">마음에 드는 템플릿이 없나요?</p>
              <p className="mt-1 text-sm text-white/60">템플릿 없이 원하는 사이트를 글로 설명하면 그대로 제작합니다.</p>
            </div>
            <Link href="/projects/new" className={buttonClass("primary", "md")}>
              프롬프트만으로 시작하기
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
