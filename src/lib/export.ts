import type { Coupon, Order, Product, Store } from "./db";

/**
 * Export complet, sans verrouillage : un JSON qui contient toutes les données de
 * la boutique et un CSV au format d'import produits de Shopify (on peut partir
 * chez un concurrent en quelques minutes, c'est voulu).
 */

export const EXPORT_FORMAT_VERSION = 1;

export interface StoreExport {
  format: "vitrine-export";
  version: number;
  exportedAt: string;
  store: Omit<Store, "creditsBalance" | "monthlyAllowance" | "perMessageCap" | "plan">;
  products: Product[];
  coupons: Coupon[];
  orders: Order[];
}

export function buildJsonExport(
  store: Store,
  products: Product[],
  coupons: Coupon[],
  orders: Order[],
): StoreExport {
  // Les champs de facturation de la plateforme ne sont pas des données de la boutique.
  const { creditsBalance, monthlyAllowance, perMessageCap, plan, ...storeData } = store;
  void creditsBalance;
  void monthlyAllowance;
  void perMessageCap;
  void plan;
  return {
    format: "vitrine-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    store: storeData,
    products,
    coupons,
    orders,
  };
}

/** Colonnes acceptées par l'import produits de Shopify (produit à variante unique). */
export const SHOPIFY_COLUMNS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant Price",
  "Variant Compare At Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Image Src",
  "Image Position",
  "Image Alt Text",
  "SEO Title",
  "SEO Description",
  "Status",
] as const;

export function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convertit une description texte (paragraphes séparés par des lignes vides) en HTML simple. */
export function descriptionToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const euros = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));

export function buildShopifyCsv(store: Store, products: Product[]): string {
  const published = store.status === "published";
  const rows = products.map((p) =>
    [
      p.handle,
      p.title,
      descriptionToHtml(p.description),
      store.name,
      p.tags[0] ?? "",
      p.tags.join(", "),
      published ? "TRUE" : "FALSE",
      "Title",
      "Default Title",
      euros(p.priceCents),
      euros(p.compareAtCents),
      "TRUE",
      "TRUE",
      p.imageUrl ?? "",
      p.imageUrl ? 1 : "",
      p.imageUrl ? p.title : "",
      p.seoTitle,
      p.seoDescription,
      published ? "active" : "draft",
    ]
      .map(csvCell)
      .join(","),
  );
  return [SHOPIFY_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
