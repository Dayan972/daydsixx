import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { getMedia, getStoreBySlugOrDomain, type Store } from "@/lib/db";
import { isMediaRef, mediaUrl } from "@/lib/media";
import { TEMPLATES, resolvePalette } from "@/lib/store-types";

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
  const p = resolvePalette(store.theme);
  const t = TEMPLATES[store.theme.template];
  return {
    "--s-bg": p.bg,
    "--s-fg": p.fg,
    "--s-surface": p.surface,
    "--s-accent": p.accent,
    "--s-on-accent": p.onAccent,
    "--s-line": `color-mix(in srgb, ${p.fg} 14%, transparent)`,
    "--s-display": t.display,
    "--s-body": t.body,
    colorScheme: p.dark ? "dark" : "light",
  } as CSSProperties;
}

/** Texte alternatif : celui de la médiathèque s'il existe, sinon le libellé fourni. */
function altFor(ref: string, fallback: string): string {
  if (isMediaRef(ref)) return getMedia(ref.slice(6))?.alt || fallback;
  return fallback;
}

/**
 * Visuel d'un produit ou d'une section. Sans image, on affiche une plaque de couleur
 * travaillée (dégradé + grain) plutôt qu'un carré vide : la page reste élégante.
 */
export function Visual({
  refs,
  label,
  ratio = "4 / 5",
  priority,
  className = "",
}: {
  refs: (string | undefined)[];
  label: string;
  ratio?: string;
  priority?: boolean;
  className?: string;
}) {
  const urls = refs.map((r) => ({ ref: r, url: mediaUrl(r) })).filter((x) => x.url) as { ref: string; url: string }[];
  return (
    <div className={`sf-media ${className}`} style={{ aspectRatio: ratio }}>
      {urls.length === 0 ? (
        <div className="sf-plate" role="img" aria-label={`${label} (visuel à venir)`}>
          <span>{label}</span>
        </div>
      ) : (
        urls.slice(0, 2).map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- médiathèque servie par nos soins
          <img
            key={u.ref}
            src={u.url}
            alt={i === 0 ? altFor(u.ref, label) : ""}
            loading={priority && i === 0 ? "eager" : "lazy"}
            fetchPriority={priority && i === 0 ? "high" : undefined}
            decoding="async"
          />
        ))
      )}
    </div>
  );
}
