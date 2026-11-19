import { connection } from "next/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LEGAL_PAGES, buildLegalPage, missingLegalFields, type LegalPage } from "@/lib/legal";
import { loadStore } from "../../shared";

type Props = PageProps<"/s/[slug]/legal/[page]">;

function pageSlug(raw: string): LegalPage["slug"] {
  const found = LEGAL_PAGES.find((p) => p.slug === raw);
  if (!found) notFound();
  return found.slug;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const store = loadStore(slug);
  const title = LEGAL_PAGES.find((p) => p.slug === page)?.title ?? "Informations légales";
  return { title: { absolute: `${title} · ${store.name}` } };
}

export default function LegalPageRoute({ params }: Props) {
  return (
    <Suspense>
      <LegalView params={params} />
    </Suspense>
  );
}

async function LegalView({ params }: Pick<Props, "params">) {
  const { slug, page } = await params;
  await connection();
  const store = loadStore(slug);
  const legal = buildLegalPage(pageSlug(page), store.name, store.legal);
  const incomplete = missingLegalFields(store.legal).length > 0;

  return (
    <main className="sf-container py-16">
      <div className="sf-narrow">
      <h1 className="sf-display sf-h2">{legal.title}</h1>
      {incomplete && (
        <p className="mt-4 border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          Informations en cours de complétion par le vendeur.
        </p>
      )}
      {legal.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="sf-display sf-h3">{s.heading}</h2>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="mt-3 leading-relaxed">{p}</p>
          ))}
        </section>
      ))}
      </div>
    </main>
  );
}
