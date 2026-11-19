import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct, listProducts, recordPageview } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { formatEuros } from "@/lib/store-types";
import { AddToCart } from "../../client";
import { ProductCard } from "../../sections";
import { Visual, loadStore, storeBase } from "../../shared";

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
  const image = mediaUrl(product.images[0]);
  return {
    title: { absolute: `${product.seoTitle || product.title} · ${store.name}` },
    description: product.seoDescription || product.description.slice(0, 155),
    alternates: { canonical },
    openGraph: { title: product.title, description: product.seoDescription, url: canonical, images: image ? [image] : undefined },
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
  const others = listProducts(store.id).filter((p) => p.id !== product.id).slice(0, 4);
  const images = product.images.length > 0 ? product.images : [undefined];

  // Données structurées : Google peut afficher le prix et la disponibilité dans ses résultats.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map(mediaUrl).filter(Boolean),
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="sf-container pt-8">
        <nav className="sf-muted text-xs" aria-label="Fil d'Ariane">
          <Link href={base || "/"} className="hover:underline">Accueil</Link>
          <span className="mx-2">/</span>
          <Link href={`${base}/#collection`} className="hover:underline">Collection</Link>
          <span className="mx-2">/</span>
          <span>{product.title}</span>
        </nav>
      </div>

      <div className="sf-container grid gap-10 pb-24 pt-8 lg:grid-cols-[1.35fr_1fr] lg:gap-20">
        <div className="grid gap-3 sm:grid-cols-2">
          {images.map((ref, i) => (
            <div key={i} className={i === 0 ? "sm:col-span-2" : ""}>
              <Visual refs={[ref]} label={product.title} ratio={i === 0 ? "4 / 5" : "1 / 1"} priority={i === 0} />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          {product.tags[0] && <p className="sf-eyebrow mb-4">{product.tags[0]}</p>}
          <h1 className="sf-display sf-h2">{product.title}</h1>
          <p className="mt-5 text-xl">
            {formatEuros(product.priceCents)}
            {product.compareAtCents && product.compareAtCents > product.priceCents && (
              <s className="sf-muted ml-3 text-base">{formatEuros(product.compareAtCents)}</s>
            )}
            <span className="sf-muted ml-2 text-xs">TTC</span>
          </p>
          <div className="mt-8">
            <AddToCart
              store={store.slug}
              disabled={store.status !== "published"}
              product={{ handle: product.handle, title: product.title, unitPriceCents: product.priceCents }}
            />
          </div>
          <div className="sf-lead mt-10 space-y-4 text-base">
            {product.description.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
          <div className="sf-faq sf-border mt-10 border-t">
            <details>
              <summary>Livraison</summary>
              <p className="sf-muted pb-6 text-sm">{store.legal.shippingInfo || "Conditions de livraison précisées à la commande."}</p>
            </details>
            <details>
              <summary>Retours</summary>
              <p className="sf-muted pb-6 text-sm">
                Vous disposez de {store.legal.returnDays ?? 14} jours après réception pour changer d&apos;avis.{" "}
                <Link href={`${base}/legal/cgv`} className="sf-link">Conditions de vente</Link>
              </p>
            </details>
          </div>
        </div>
      </div>

      {others.length > 0 && (
        <section className="sf-section sf-border border-t">
          <div className="sf-container">
            <h2 className="sf-display sf-h3 mb-10">Vous aimerez aussi</h2>
            <div className="sf-grid" data-count={4}>
              {others.map((p, i) => (
                <ProductCard key={p.id} p={p} base={base} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
