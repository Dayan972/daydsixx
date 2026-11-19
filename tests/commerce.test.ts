import { beforeEach, describe, expect, it } from "vitest";
import {
  createProduct,
  createStore,
  getStore,
  listCoupons,
  listOrders,
  listProducts,
  resetDbForTests,
  setStoreStatus,
  updateStoreIdentity,
  updateStoreLegal,
  upsertCoupon,
  type Store,
} from "@/lib/db";
import { placeOrder } from "@/lib/checkout";
import { buildJsonExport, buildShopifyCsv, csvCell, SHOPIFY_COLUMNS } from "@/lib/export";
import { buildLegalPage, missingLegalFields, type LegalInfo } from "@/lib/legal";
import { isReadyToPublish, publishReadiness } from "@/lib/publish";

const LEGAL: LegalInfo = {
  companyName: "Lueur & Cire",
  legalForm: "Micro-entreprise",
  siret: "12345678900012",
  address: "12 rue des Lilas, 69001 Lyon",
  email: "bonjour@lueur.fr",
  publisherName: "Camille Martin",
  mediatorName: "CM2C",
  mediatorUrl: "https://www.cm2c.net",
  returnDays: 14,
  shippingInfo: "France métropolitaine, 48 h, 4,90 € (offerte dès 50 €).",
};

let store: Store;

beforeEach(() => {
  resetDbForTests();
  store = updateStoreIdentity(createStore().id, { name: "Lueur & Cire" });
  createProduct(store.id, { title: "Bougie, \"Feu\" de bois", description: "Ligne 1\n\nLigne <2>", priceCents: 3200 });
});

describe("publication", () => {
  it("bloque tant que les informations légales manquent, puis autorise", () => {
    expect(isReadyToPublish(store, listProducts(store.id))).toBe(false);
    const legalItem = publishReadiness(store, listProducts(store.id)).find((i) => i.label.startsWith("Informations légales"));
    expect(legalItem?.fix).toMatch(/SIRET/);
    updateStoreLegal(store.id, LEGAL, false);
    expect(isReadyToPublish(getStore(store.id)!, listProducts(store.id))).toBe(true);
  });

  it("génère des CGV de droit français avec rétractation de 14 jours et médiateur", () => {
    expect(missingLegalFields(LEGAL)).toEqual([]);
    const cgv = buildLegalPage("cgv", "Lueur & Cire", LEGAL);
    const text = cgv.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(text).toMatch(/14 jours/);
    expect(text).toMatch(/CM2C/);
    expect(text).toMatch(/droit français/);
    expect(text).not.toMatch(/Wyoming/);
  });
});

describe("commandes", () => {
  it("refuse les commandes d'une boutique en brouillon", () => {
    const r = placeOrder(store, { email: "a@b.fr", items: [{ handle: "bougie-feu-de-bois", quantity: 1 }], acceptTerms: true });
    expect(r.ok).toBe(false);
  });

  it("recalcule les prix côté serveur et applique le code promo", () => {
    setStoreStatus(store.id, "published");
    upsertCoupon(store.id, "bienvenue10", 10);
    const r = placeOrder(getStore(store.id)!, {
      email: "client@exemple.fr",
      items: [{ handle: "bougie-feu-de-bois", quantity: 2 }],
      couponCode: "BIENVENUE10",
      acceptTerms: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order).toMatchObject({ subtotalCents: 6400, discountCents: 640, totalCents: 5760, number: 1001 });
    expect(listOrders(store.id)).toHaveLength(1);
  });
});

describe("export sans verrouillage", () => {
  it("produit un CSV au format d'import Shopify, correctement échappé", () => {
    const csv = buildShopifyCsv(store, listProducts(store.id));
    const [header, row] = csv.split("\r\n");
    expect(header).toBe(SHOPIFY_COLUMNS.join(","));
    expect(row).toContain('"Bougie, ""Feu"" de bois"');
    expect(row).toContain("<p>Ligne &lt;2&gt;</p>");
    expect(row).toContain("32.00");
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("exporte toutes les données de la boutique, sans les champs de facturation de la plateforme", () => {
    const data = buildJsonExport(getStore(store.id)!, listProducts(store.id), listCoupons(store.id), listOrders(store.id));
    expect(data.format).toBe("vitrine-export");
    expect(data.products).toHaveLength(1);
    expect(data.store).not.toHaveProperty("creditsBalance");
    expect(data.store.name).toBe("Lueur & Cire");
  });
});
