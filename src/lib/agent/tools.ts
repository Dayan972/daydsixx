import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  addLedgerEntry,
  createProduct,
  deleteProduct,
  getProduct,
  getStore,
  listCoupons,
  listProducts,
  transaction,
  updateProduct,
  updateStoreIdentity,
  updateStoreSections,
  updateStoreTheme,
  upsertCoupon,
  type ChatAction,
  type Store,
} from "../db";
import { TOOL_COSTS, TOOL_LABELS, type ToolName } from "../credits";
import { checkBrandUse, type BrandContext } from "../guardrails/brands";
import { missingLegalFields } from "../legal";
import { publishReadiness } from "../publish";
import { SectionSchema, ThemeSchema, formatEuros } from "../store-types";

// ---------------------------------------------------------------- Schémas d'entrée

const euros = z.number().positive().max(100_000);

const ProductFields = {
  title: z.string().min(2).max(120).describe("Nom du produit, original"),
  description: z
    .string()
    .min(20)
    .max(2000)
    .describe("Description factuelle et engageante. Paragraphes séparés par une ligne vide."),
  priceEur: euros.describe("Prix de vente TTC en euros"),
  compareAtPriceEur: euros.optional().describe("Ancien prix barré, seulement s'il a réellement été pratiqué"),
  tags: z.array(z.string().min(1).max(30)).max(10).optional().describe("Catégories / mots-clés"),
  imageUrl: z.url().optional().describe("URL d'une image fournie par le marchand"),
  seoTitle: z.string().max(70).optional().describe("Titre pour Google, 70 caractères max"),
  seoDescription: z.string().max(160).optional().describe("Méta-description, 160 caractères max"),
};

export const TOOL_INPUTS = {
  get_store_overview: z.object({}),
  check_publish_readiness: z.object({}),
  update_store_identity: z
    .object({
      name: z.string().min(2).max(60).optional(),
      tagline: z.string().max(120).optional().describe("Slogan court"),
      description: z.string().max(600).optional().describe("Présentation de la boutique"),
    })
    .refine((v) => Object.keys(v).length > 0, "Indiquez au moins un champ"),
  update_theme: ThemeSchema.partial().refine(
    (v) => Object.keys(v).length > 0,
    "Indiquez au moins un champ",
  ),
  set_homepage_sections: z.object({
    sections: z.array(SectionSchema).min(1).max(8).describe("Remplace toutes les sections, dans l'ordre"),
  }),
  add_product: z.object(ProductFields),
  update_product: z
    .object(ProductFields)
    .partial()
    .extend({ handle: z.string().describe("Identifiant du produit (champ handle)") }),
  delete_product: z.object({ handle: z.string() }),
  create_coupon: z.object({
    code: z
      .string()
      .regex(/^[A-Za-z0-9]{3,20}$/, "3 à 20 lettres ou chiffres")
      .describe("Code saisi par le client, ex. BIENVENUE10"),
    percentOff: z.number().int().min(1).max(90).describe("Réduction en pourcentage"),
  }),
} satisfies Record<ToolName, z.ZodType>;

const DESCRIPTIONS: Record<ToolName, string> = {
  get_store_overview:
    "Renvoie l'état complet de la boutique (identité, thème, sections, produits, codes promo). L'état est déjà fourni au début de chaque message : n'appelez cet outil que si vous avez besoin de l'état après vos propres modifications.",
  check_publish_readiness:
    "Renvoie la liste de contrôle avant publication (points bloquants et comment les corriger). La publication elle-même est faite par le marchand.",
  update_store_identity:
    "Modifie le nom, le slogan et/ou la description de la boutique. L'identité doit être originale : aucune marque existante.",
  update_theme:
    "Modifie l'apparence : couleurs (#RRGGBB, contraste lisible), police, ambiance. Seuls les champs fournis changent.",
  set_homepage_sections:
    "Remplace l'ensemble des sections de la page d'accueil. Une grille de produits (product_grid) affiche automatiquement les produits. N'invente ni avis clients, ni chiffres de ventes, ni labels.",
  add_product:
    "Ajoute un produit avec une fiche rédigée et optimisée pour le référencement. N'invente aucune caractéristique (matière, origine, certification) que le marchand n'a pas indiquée.",
  update_product: "Modifie un produit existant ; seuls les champs fournis changent.",
  delete_product: "Supprime un produit.",
  create_coupon: "Crée ou met à jour un code promo en pourcentage.",
};

/** Définitions envoyées à l'API, triées pour garder un préfixe stable (cache). */
export function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  return (Object.keys(TOOL_INPUTS) as ToolName[]).sort().map((name) => {
    const { $schema, ...schema } = z.toJSONSchema(TOOL_INPUTS[name], {
      io: "input",
      unrepresentable: "any",
    }) as Record<string, unknown>;
    void $schema;
    return {
      name,
      description: `${DESCRIPTIONS[name]} (Coût : ${TOOL_COSTS[name]} crédit${TOOL_COSTS[name] > 1 ? "s" : ""}.)`,
      input_schema: { type: "object", ...schema } as Anthropic.Beta.BetaTool.InputSchema,
    };
  });
}

// ---------------------------------------------------------------- Budget d'un message

/** Plafond de crédits d'un message : le marchand le règle, l'IA ne peut pas le dépasser. */
export class TurnBudget {
  spent = 0;
  constructor(
    readonly storeId: string,
    readonly cap: number,
  ) {}

  remaining(): number {
    const balance = getStore(this.storeId)?.creditsBalance ?? 0;
    return Math.max(0, Math.min(this.cap - this.spent, balance));
  }
}

// ---------------------------------------------------------------- Exécution

export interface ToolOutcome {
  ok: boolean;
  /** Contenu renvoyé au modèle (JSON). */
  content: string;
  action: ChatAction;
}

const BRAND_CONTEXT: Partial<Record<ToolName, BrandContext>> = {
  update_store_identity: "identity",
  update_theme: "identity",
  set_homepage_sections: "identity",
  add_product: "product",
  update_product: "product",
  create_coupon: "identity",
};

const cents = (eur: number | undefined) => (eur === undefined ? undefined : Math.round(eur * 100));

export function storeOverview(store: Store) {
  return {
    name: store.name,
    slug: store.slug,
    status: store.status,
    tagline: store.tagline,
    description: store.description,
    theme: store.theme,
    sections: store.sections,
    products: listProducts(store.id).map((p) => ({
      handle: p.handle,
      title: p.title,
      price: formatEuros(p.priceCents),
      tags: p.tags,
    })),
    coupons: listCoupons(store.id).map((c) => `${c.code} (-${c.percentOff} %)`),
    legalInfoComplete: missingLegalFields(store.legal).length === 0,
    authenticResellerDeclared: store.authenticResellerDeclared,
  };
}

function fail(name: ToolName, message: string, cost = 0): ToolOutcome {
  return {
    ok: false,
    content: JSON.stringify({ error: message }),
    action: { tool: name, label: TOOL_LABELS[name], ok: false, cost, detail: message },
  };
}

/**
 * Valide, contrôle (marques, crédits) puis exécute un outil. L'action et son débit
 * sont écrits dans la même transaction : jamais d'action sans débit, ni l'inverse.
 */
export function executeTool(
  storeId: string,
  rawName: string,
  rawInput: unknown,
  budget: TurnBudget,
): ToolOutcome {
  if (!(rawName in TOOL_INPUTS)) {
    return {
      ok: false,
      content: JSON.stringify({ error: `Outil inconnu : ${rawName}` }),
      action: { tool: rawName, label: rawName, ok: false, cost: 0, detail: "Outil inconnu" },
    };
  }
  const name = rawName as ToolName;
  const parsed = TOOL_INPUTS[name].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return fail(name, `Entrée invalide : ${z.prettifyError(parsed.error)}`);
  }
  const input = parsed.data as Record<string, unknown>;

  const store = getStore(storeId);
  if (!store) return fail(name, "Boutique introuvable");

  const brandContext = BRAND_CONTEXT[name];
  if (brandContext) {
    const verdict = checkBrandUse(input, brandContext, store.authenticResellerDeclared);
    if (!verdict.allowed) return fail(name, `Action bloquée (aucun crédit débité). ${verdict.reason}`);
  }

  const cost = TOOL_COSTS[name];
  if (cost > budget.remaining()) {
    return fail(
      name,
      `Crédits insuffisants pour cette action (${cost} requis, ${budget.remaining()} disponibles dans ce message). Rien n'a été modifié ni débité. Proposez au marchand d'augmenter le plafond par message ou de recharger.`,
    );
  }

  try {
    const { result, detail } = transaction(() => {
      const r = runTool(name, input, store);
      addLedgerEntry(storeId, -cost, `IA : ${TOOL_LABELS[name]}${r.detail ? ` (${r.detail})` : ""}`);
      return r;
    });
    budget.spent += cost;
    return {
      ok: true,
      content: JSON.stringify({ ok: true, creditsSpent: cost, ...result }),
      action: { tool: name, label: TOOL_LABELS[name], ok: true, cost, detail },
    };
  } catch (err) {
    return fail(name, err instanceof Error ? err.message : "Erreur inconnue");
  }
}

function runTool(
  name: ToolName,
  input: Record<string, unknown>,
  store: Store,
): { result: Record<string, unknown>; detail?: string } {
  switch (name) {
    case "get_store_overview":
      return { result: { store: storeOverview(store) } };

    case "check_publish_readiness":
      return { result: { checklist: publishReadiness(store, listProducts(store.id)) } };

    case "update_store_identity": {
      const s = updateStoreIdentity(store.id, input as { name?: string });
      return { result: { name: s.name, slug: s.slug }, detail: s.name };
    }

    case "update_theme":
      updateStoreTheme(store.id, { ...store.theme, ...input });
      return { result: { theme: { ...store.theme, ...input } } };

    case "set_homepage_sections": {
      const sections = input.sections as Store["sections"];
      updateStoreSections(store.id, sections);
      return { result: { sectionCount: sections.length }, detail: `${sections.length} sections` };
    }

    case "add_product": {
      const i = input as z.infer<(typeof TOOL_INPUTS)["add_product"]>;
      const p = createProduct(store.id, {
        title: i.title,
        description: i.description,
        priceCents: cents(i.priceEur)!,
        compareAtCents: cents(i.compareAtPriceEur) ?? null,
        imageUrl: i.imageUrl ?? null,
        tags: i.tags,
        seoTitle: i.seoTitle,
        seoDescription: i.seoDescription,
      });
      return { result: { handle: p.handle }, detail: `${p.title}, ${formatEuros(p.priceCents)}` };
    }

    case "update_product": {
      const i = input as { handle: string } & Partial<z.infer<(typeof TOOL_INPUTS)["add_product"]>>;
      if (!getProduct(store.id, i.handle)) throw new Error(`Produit « ${i.handle} » introuvable`);
      const p = updateProduct(store.id, i.handle, {
        title: i.title,
        description: i.description,
        priceCents: cents(i.priceEur),
        compareAtCents: cents(i.compareAtPriceEur),
        imageUrl: i.imageUrl,
        tags: i.tags,
        seoTitle: i.seoTitle,
        seoDescription: i.seoDescription,
      });
      return { result: { handle: p.handle }, detail: p.title };
    }

    case "delete_product": {
      const handle = input.handle as string;
      if (!deleteProduct(store.id, handle)) throw new Error(`Produit « ${handle} » introuvable`);
      return { result: { deleted: handle }, detail: handle };
    }

    case "create_coupon": {
      const c = upsertCoupon(store.id, input.code as string, input.percentOff as number);
      return { result: { code: c.code, percentOff: c.percentOff }, detail: `${c.code} −${c.percentOff} %` };
    }
  }
}
