import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listProducts, recordPageview, type Product, type Store } from "@/lib/db";
import type { Section } from "@/lib/store-types";
import { formatEuros } from "@/lib/store-types";
import { ProductVisual, loadStore, storeBase } from "./shared";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const store = loadStore(slug);
  const description = store.tagline || store.description || `Boutique en ligne ${store.name}`;
  const canonical = store.customDomain ? `https://${store.customDomain}/` : `/s/${store.slug}`;
  return {
    title: { absolute: store.name },
    description,
    alternates: { canonical },
    openGraph: { title: store.name, description, type: "website", url: canonical },
    // Un brouillon ne doit pas être indexé par les moteurs de recherche.
    robots: store.status === "published" ? undefined : { index: false, follow: false },
  };
}

export default function StoreHome({ params }: PageProps<"/s/[slug]">) {
  return (
    <Suspense>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: Pick<PageProps<"/s/[slug]">, "params">) {
  const { slug } = await params;
  await connection();
  const store = loadStore(slug);
  const base = storeBase(slug);
  const products = listProducts(store.id);
  if (store.status === "published") recordPageview(store.id, "/");

  const sections: Section[] =
    store.sections.length > 0
      ? store.sections
      : [
          { type: "hero", title: store.name, text: store.tagline || "Boutique en préparation." },
          { type: "product_grid", title: "Nos produits" },
        ];

  return (
    <main>
      {sections.map((s, i) => (
        <SectionView key={i} section={s} store={store} products={products} base={base} />
      ))}
    </main>
  );
}

function SectionView({
  section,
  store,
  products,
  base,
}: {
  section: Section;
  store: Store;
  products: Product[];
  base: string;
}) {
  switch (section.type) {
    case "hero":
      return (
        <section className="store-surface">
          <div className="mx-auto max-w-5xl px-4 py-24 text-center">
            <h1 className="text-4xl sm:text-5xl">{section.title}</h1>
            {section.text && <p className="store-muted mx-auto mt-4 max-w-2xl text-lg">{section.text}</p>}
            {section.buttonLabel && products.length > 0 && (
              <a href="#produits" className="store-btn mt-8 inline-block px-6 py-3 text-sm font-semibold">
                {section.buttonLabel}
              </a>
            )}
          </div>
        </section>
      );
    case "features":
      return (
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl">{section.title}</h2>
          {section.text && <p className="store-muted mt-2 text-center">{section.text}</p>}
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {(section.items ?? []).map((item) => (
              <div key={item.title} className="store-border store-card border p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="store-muted mt-2 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "product_grid":
      return (
        <section id="produits" className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl">{section.title}</h2>
          {products.length === 0 ? (
            <p className="store-muted mt-4">Les produits arrivent bientôt.</p>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3">
              {products.map((p) => (
                <Link key={p.id} href={`${base}/produits/${p.handle}`} className="group block">
                  {/* L'arrondi ne s'applique qu'au visuel, pour ne pas rogner le texte en dessous. */}
                  <div className="store-card overflow-hidden">
                    <ProductVisual title={p.title} imageUrl={p.imageUrl} />
                  </div>
                  <p className="mt-3 font-medium group-hover:underline">{p.title}</p>
                  <p className="store-muted text-sm">
                    {formatEuros(p.priceCents)}
                    {p.compareAtCents && p.compareAtCents > p.priceCents && (
                      <s className="ml-2">{formatEuros(p.compareAtCents)}</s>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      );
    case "text":
      return (
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl">{section.title}</h2>
          {section.text && <p className="store-muted mt-4 whitespace-pre-line leading-relaxed">{section.text}</p>}
        </section>
      );
    case "newsletter":
      return (
        <section className="store-surface">
          <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <h2 className="text-2xl">{section.title}</h2>
            {section.text && <p className="store-muted mt-2">{section.text}</p>}
            <p className="store-muted mt-4 text-sm">
              Écrivez-nous à {store.legal.email || "notre adresse de contact"} pour vous inscrire.
            </p>
          </div>
        </section>
      );
  }
}
