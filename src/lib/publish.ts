import type { Product, Store } from "./db";
import { checkBrandUse } from "./guardrails/brands";
import { LEGAL_FIELD_LABELS, missingLegalFields } from "./legal";

export interface ReadinessItem {
  ok: boolean;
  label: string;
  fix?: string;
}

/**
 * Liste de contrôle avant publication. La boutique ne peut pas être mise en
 * ligne tant qu'un point bloque : on protège le marchand plutôt que de lui
 * laisser porter seul les risques (au contraire des CGU de Nealens).
 */
export function publishReadiness(store: Store, products: Product[]): ReadinessItem[] {
  const missing = missingLegalFields(store.legal);
  const identity = checkBrandUse(
    { name: store.name, tagline: store.tagline, description: store.description, sections: store.sections },
    "identity",
    false,
  );
  const blockedProducts = products.filter(
    (p) => !checkBrandUse(p, "product", store.authenticResellerDeclared).allowed,
  );

  return [
    {
      ok: store.name.trim() !== "" && store.name !== "Ma boutique",
      label: "La boutique a un nom",
      fix: "Demandez à l'IA de proposer un nom original.",
    },
    {
      ok: products.length > 0,
      label: "Au moins un produit est en vente",
      fix: "Ajoutez un produit avec l'IA.",
    },
    {
      ok: products.every((p) => p.priceCents > 0),
      label: "Tous les produits ont un prix",
    },
    {
      ok: missing.length === 0,
      label: "Informations légales complètes (mentions légales, CGV, confidentialité)",
      fix:
        missing.length > 0
          ? `À compléter dans l'onglet Légal : ${missing.map((f) => LEGAL_FIELD_LABELS[f]).join(", ")}.`
          : undefined,
    },
    {
      ok: identity.allowed,
      label: "L'identité de la boutique ne reprend aucune marque protégée",
      fix: identity.reason,
    },
    {
      ok: blockedProducts.length === 0,
      label: "Aucun produit ne reprend une marque tierce sans autorisation",
      fix:
        blockedProducts.length > 0
          ? `Produits concernés : ${blockedProducts.map((p) => p.title).join(", ")}.`
          : undefined,
    },
  ];
}

export function isReadyToPublish(store: Store, products: Product[]): boolean {
  return publishReadiness(store, products).every((i) => i.ok);
}
