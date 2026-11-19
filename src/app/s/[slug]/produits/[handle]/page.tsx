import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, recordPageview } from "@/lib/db";
import { formatEuros } from "@/lib/store-types";
import { AddToCart } from "../../client";
import { ProductVisual, loadStore, storeBase } from "../../shared";

type Props = PageProps<"/s/[slug]/produits/[handle]">;

async function load(params: Props["params"]) {
  const { slug, handle } = await params;
  const store = loadStore(slug);
  const product = getProduct(store.id, decodeURIComponent(handle));
  if (!product) notFound();
  return { slug, store, product };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store, product } = await load(params);
  const path = `/produits/${product.handle}`;
  const canonical = store.customDomain ? `https://${store.customDomain}${path}` : `/s/${store.slug}${path}`;
  return {
    title: { absolute: `${product.seoTitle || product.title} · ${store.name}` },
    description: product.seoDescription || product.description.slice(0, 155),
    alternates: { canonical },
    openGraph: {
      title: product.title,
      description: product.seoDescription,
      url: canonical,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
    robots: store.status === "published" ? undefined : { index: false, follow: false },
  };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense>
      <ProductView params={params} />
    </Suspense>
  );
}

async function ProductView({ params }: Pick<Props, "params">) {
  await connection();
  const { slug, store, product } = await load(params);
  const base = storeBase(slug);
  if (store.status === "published") recordPageview(store.id, `/produits/${product.handle}`);

  // Données structurées : Google peut afficher le prix et la disponibilité dans ses résultats.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.imageUrl ?? undefined,
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Link href={base || "/"} className="store-link text-sm">← Retour à la boutique</Link>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <ProductVisual title={product.title} imageUrl={product.imageUrl} large />
        <div>
          <h1 className="text-3xl">{product.title}</h1>
          <p className="mt-3 text-2xl">
            {formatEuros(product.priceCents)}
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <s className="store-muted ml-3 text-lg">{formatEuros(product.compareAtCents)}</s>
            )}
          </p>
          <p className="store-muted text-xs">TTC</p>
          <div className="mt-6">
            <AddToCart
              store={store.slug}
              disabled={store.status !== "published"}
              product={{ handle: product.handle, title: product.title, unitPriceCents: product.priceCents }}
            />
          </div>
          <div className="mt-8 space-y-4 leading-relaxed">
            {product.description.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
          <p className="store-muted mt-8 text-sm">
            Retour possible sous {store.legal.returnDays ?? 14} jours ·{" "}
            <Link href={`${base}/legal/cgv`} className="store-link underline">Conditions de vente</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
