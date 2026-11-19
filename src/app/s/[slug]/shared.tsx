import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getStoreBySlugOrDomain, type Store } from "@/lib/db";
import { FONT_STACKS } from "@/lib/store-types";

/**
 * Une boutique est servie soit sous /s/<slug> (aperçu), soit sur son propre
 * domaine : le proxy réécrit alors maboutique.fr/x vers /s/maboutique.fr/x.
 * La clé contient un point dans le second cas, et les liens restent relatifs au domaine.
 */
export function storeBase(key: string): string {
  return key.includes(".") ? "" : `/s/${key}`;
}

export function loadStore(key: string): Store {
  const store = getStoreBySlugOrDomain(decodeURIComponent(key));
  if (!store) notFound();
  return store;
}

export function themeStyle(store: Store): CSSProperties {
  return {
    "--store-primary": store.theme.primaryColor,
    "--store-bg": store.theme.backgroundColor,
    "--store-fg": store.theme.textColor,
    "--store-font": FONT_STACKS[store.theme.font],
  } as CSSProperties;
}

/** Visuel de remplacement quand le marchand n'a pas fourni de photo. */
export function ProductVisual({ title, imageUrl, large }: { title: string; imageUrl: string | null; large?: boolean }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- images externes fournies par le marchand
    return <img src={imageUrl} alt={title} className="aspect-square w-full object-cover" />;
  }
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div
      role="img"
      aria-label={`${title} (photo à venir)`}
      className={`flex aspect-square w-full items-center justify-center ${large ? "text-6xl" : "text-3xl"}`}
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--store-primary) 22%, var(--store-bg)), color-mix(in srgb, var(--store-primary) 55%, var(--store-bg)))",
        color: "var(--store-bg)",
      }}
    >
      {initials}
    </div>
  );
}
