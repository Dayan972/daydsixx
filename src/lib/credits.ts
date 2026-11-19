/**
 * Grille de crédits publique : source unique de vérité, affichée telle quelle
 * sur la page Tarifs et dans le tableau de bord. Changer un prix ici le change partout.
 */

export const MESSAGE_COST = 1;

export const TOOL_COSTS = {
  get_store_overview: 0,
  check_publish_readiness: 0,
  update_store_identity: 1,
  update_theme: 1,
  set_homepage_sections: 3,
  add_product: 2,
  update_product: 1,
  delete_product: 0,
  create_coupon: 1,
} as const;

export type ToolName = keyof typeof TOOL_COSTS;

export const TOOL_LABELS: Record<ToolName, string> = {
  get_store_overview: "Consulter la boutique",
  check_publish_readiness: "Vérifier si la boutique est prête à publier",
  update_store_identity: "Changer le nom, le slogan ou la description",
  update_theme: "Changer les couleurs et la police",
  set_homepage_sections: "Réécrire la page d'accueil",
  add_product: "Ajouter un produit (fiche optimisée pour le référencement)",
  update_product: "Modifier un produit",
  delete_product: "Supprimer un produit",
  create_coupon: "Créer un code promo",
};

/** Grille affichable, triée par coût puis par libellé. */
export function priceList(): { action: string; cost: number }[] {
  return [
    { action: "Envoyer un message à l'IA", cost: MESSAGE_COST },
    ...(Object.keys(TOOL_COSTS) as ToolName[]).map((t) => ({
      action: TOOL_LABELS[t],
      cost: TOOL_COSTS[t],
    })),
    { action: "Renseigner vos informations légales (formulaire)", cost: 0 },
    { action: "Exporter toutes vos données", cost: 0 },
  ].sort((a, b) => b.cost - a.cost || a.action.localeCompare(b.action, "fr"));
}

export const PLANS = [
  {
    id: "trial",
    name: "Essai",
    monthlyPriceEur: 0,
    yearlyPriceEur: null,
    monthlyCredits: 50,
    highlights: ["14 jours, sans carte bancaire", "Toutes les fonctionnalités", "Export inclus"],
  },
  {
    id: "createur",
    name: "Créateur",
    monthlyPriceEur: 19,
    yearlyPriceEur: 190,
    monthlyCredits: 200,
    highlights: ["1 boutique", "Domaine personnel", "0 % de commission sur vos ventes"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceEur: 49,
    yearlyPriceEur: 490,
    monthlyCredits: 800,
    highlights: ["3 boutiques", "Statistiques avancées", "Support prioritaire"],
  },
] as const;

export const TOP_UP = { credits: 100, priceEur: 5, expires: false } as const;

/**
 * Report mensuel : les crédits restants sont conservés, plafonnés à
 * 2 × l'allocation mensuelle. Renvoie le nouveau solde après renouvellement.
 * Ne concerne que les crédits d'abonnement : les recharges achetées formeront
 * un solde séparé, jamais plafonné ni expiré (à brancher avec la facturation).
 */
export function rolloverCredits(balance: number, monthlyAllowance: number): number {
  return Math.min(balance + monthlyAllowance, 2 * monthlyAllowance);
}

/** Coût maximal d'un message, affiché avant l'envoi. */
export function maxMessageCost(perMessageCap: number): number {
  return Math.max(perMessageCap, MESSAGE_COST);
}
