import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { listProducts, recordPageview } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import type { Section } from "@/lib/store-types";
import { SectionView } from "./sections";
import { loadStore, storeBase } from "./shared";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const store = loadStore(slug);
  const description = store.tagline || store.description || `Boutique en ligne ${store.name}`;
  const canonical = store.customDomain ? `https://${store.customDomain}/` : `/s/${store.slug}`;
  const heroImage = mediaUrl(store.sections.find((s) => s.type === "hero")?.image);
  return {
    title: { absolute: store.name },
    description,
    alternates: { canonical },
    openGraph: {
      title: store.name,
      description,
      type: "website",
      url: canonical,
      images: heroImage ? [heroImage] : undefined,
    },
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
          { type: "hero", title: store.name, text: store.tagline || "Boutique en préparation.", buttonLabel: "Découvrir" },
          { type: "product_grid", title: "La collection" },
        ];

  return (
    <main>
      {sections.map((s, i) => (
        <SectionView key={i} section={s} ctx={{ store, products, base, index: i }} />
      ))}
    </main>
  );
}
