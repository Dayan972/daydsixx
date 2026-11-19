import type { ChatAction } from "../db";
import { getStore, listProducts } from "../db";
import { checkBrandUse, scanText } from "../guardrails/brands";
import type { Section, Theme } from "../store-types";
import { executeTool, type TurnBudget } from "./tools";

/**
 * Agent de démonstration, sans IA ni clé d'API. Il reconnaît quelques intentions
 * simples et passe par exactement les mêmes outils que Claude (mêmes garde-fous,
 * mêmes débits). Utile pour développer, tester et faire des démos gratuitement.
 */

interface Template {
  keywords: string[];
  name: string;
  tagline: string;
  description: string;
  theme: Theme;
  features: { title: string; text: string }[];
  story: string;
  products: { title: string; description: string; priceEur: number; tags: string[] }[];
}

const TEMPLATES: Template[] = [
  {
    keywords: ["parfum", "fragrance", "eau de", "senteur"],
    name: "Maison Brume",
    tagline: "Des parfums de niche, composés en petites séries",
    description:
      "Une maison de parfum indépendante qui compose des fragrances originales, en séries limitées.",
    theme: { primaryColor: "#7c5c3b", backgroundColor: "#faf7f2", textColor: "#2b2118", font: "elegant", style: "luxe" },
    features: [
      { title: "Compositions originales", text: "Chaque fragrance est créée pour la maison." },
      { title: "Petites séries", text: "Des lots numérotés, renouvelés chaque saison." },
      { title: "Échantillons", text: "Essayez avant d'adopter un flacon entier." },
    ],
    story: "Racontez ici l'histoire de votre maison : qui compose, où, et pourquoi.",
    products: [
      { title: "Brume d'Ambre", description: "Un sillage chaud et boisé, aux notes d'ambre et de vanille.\n\nFlacon de 50 ml.", priceEur: 89, tags: ["boisé", "ambré"] },
      { title: "Figue Solaire", description: "Une fragrance verte et lumineuse, autour de la feuille de figuier.\n\nFlacon de 50 ml.", priceEur: 79, tags: ["vert", "fruité"] },
      { title: "Coffret découverte", description: "Trois échantillons de 2 ml pour découvrir la collection.", priceEur: 18, tags: ["coffret"] },
    ],
  },
  {
    keywords: ["bougie", "bougies", "cire"],
    name: "Lueur & Cire",
    tagline: "Bougies coulées à la main",
    description: "Des bougies parfumées coulées à la main, pour des intérieurs apaisés.",
    theme: { primaryColor: "#b4532a", backgroundColor: "#fffaf3", textColor: "#3b2a1e", font: "arrondie", style: "chaleureux" },
    features: [
      { title: "Coulées à la main", text: "Chaque bougie est coulée et étiquetée à l'atelier." },
      { title: "Longue durée", text: "Jusqu'à 40 heures de combustion." },
      { title: "Recharges", text: "Rapportez votre pot, nous le remplissons." },
    ],
    story: "Présentez votre atelier et votre façon de travailler.",
    products: [
      { title: "Bougie Feu de Bois", description: "Notes fumées et boisées pour les soirées d'hiver.\n\nPot en verre de 200 g.", priceEur: 32, tags: ["bougie", "boisé"] },
      { title: "Bougie Linge Frais", description: "Une senteur propre et légère.\n\nPot en verre de 200 g.", priceEur: 32, tags: ["bougie", "frais"] },
      { title: "Mini trio", description: "Trois petites bougies de 60 g à offrir.", priceEur: 29, tags: ["coffret"] },
    ],
  },
  {
    keywords: ["bijou", "bijoux", "collier", "bague", "boucles"],
    name: "Atelier Sillon",
    tagline: "Bijoux minimalistes faits main",
    description: "Des bijoux fins et intemporels, façonnés à la main en petites quantités.",
    theme: { primaryColor: "#1f2937", backgroundColor: "#f8f7f4", textColor: "#111827", font: "elegant", style: "minimal" },
    features: [
      { title: "Fait main", text: "Chaque pièce est façonnée à l'atelier." },
      { title: "Pièces durables", text: "Pensées pour être portées tous les jours." },
      { title: "Emballage cadeau", text: "Offert sur chaque commande." },
    ],
    story: "Racontez comment naissent vos créations.",
    products: [
      { title: "Collier Ligne", description: "Une chaîne fine et un pendentif géométrique.\n\nPrécisez ici le métal et la longueur.", priceEur: 59, tags: ["collier"] },
      { title: "Bague Sillon", description: "Un anneau fin, gravé d'une ligne.\n\nPrécisez ici le métal et les tailles disponibles.", priceEur: 45, tags: ["bague"] },
    ],
  },
];

const DEFAULT_TEMPLATE: Template = {
  keywords: [],
  name: "Comptoir Neuf",
  tagline: "Une sélection choisie avec soin",
  description: "Une boutique indépendante. Décrivez à l'IA ce que vous vendez pour personnaliser ce texte.",
  theme: { primaryColor: "#2563eb", backgroundColor: "#ffffff", textColor: "#0f172a", font: "moderne", style: "minimal" },
  features: [
    { title: "Sélection soignée", text: "Des produits choisis un par un." },
    { title: "Expédition rapide", text: "Précisez vos délais dans l'onglet Légal." },
    { title: "Service client", text: "Une vraie personne vous répond." },
  ],
  story: "Présentez votre boutique en quelques phrases.",
  products: [],
};

const COLORS: Record<string, string> = {
  noir: "#111111", blanc: "#ffffff", bleu: "#2563eb", rouge: "#dc2626", vert: "#15803d",
  rose: "#db2777", violet: "#7c3aed", orange: "#ea580c", jaune: "#ca8a04", beige: "#c8b08a",
  dore: "#b8860b", marron: "#7c4a2d", gris: "#6b7280",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function homeSections(t: Template, name: string): Section[] {
  return [
    { type: "hero", title: name, text: t.tagline, buttonLabel: "Découvrir" },
    { type: "features", title: "Pourquoi nous choisir", items: t.features },
    { type: "product_grid", title: "La collection" },
    { type: "text", title: "Notre histoire", text: t.story },
    { type: "newsletter", title: "Restons en contact", text: "Nouveautés et coulisses, une fois par mois." },
  ];
}

export function runDemoTurn(storeId: string, userText: string, budget: TurnBudget) {
  const actions: ChatAction[] = [];
  const replies: string[] = [];
  const text = norm(userText);
  const call = (name: string, input: unknown) => {
    const outcome = executeTool(storeId, name, input, budget);
    actions.push(outcome.action);
    return outcome;
  };

  // 1. Demande d'imitation d'une marque : on explique, on n'exécute rien.
  const verdict = checkBrandUse(userText, "identity", false);
  const brands = scanText(userText).brands;
  if (!verdict.allowed && /boutique|site|marque|identite|copie|clone|facon|comme/.test(text)) {
    return {
      reply:
        `Je ne peux pas reprendre l'univers de ${brands.join(", ") || "cette marque"} : ce serait de la contrefaçon, ` +
        "et votre boutique risquerait d'être fermée. Décrivez-moi plutôt votre gamme de prix, " +
        "l'ambiance voulue et votre public : je vous propose une identité originale.",
      actions,
    };
  }

  // 2. Création complète d'une boutique.
  if (/(cree|creer|lance|monte|fais|faire).*(boutique|site|shop)|boutique de /.test(text)) {
    const t = TEMPLATES.find((tpl) => tpl.keywords.some((k) => text.includes(k))) ?? DEFAULT_TEMPLATE;
    const quoted = userText.match(/[«"“]\s*([^»"”]{2,60})\s*[»"”]/)?.[1];
    const name = quoted ?? t.name;
    call("update_store_identity", { name, tagline: t.tagline, description: t.description });
    call("update_theme", t.theme);
    call("set_homepage_sections", { sections: homeSections(t, name) });
    for (const p of t.products) call("add_product", p);
    const ok = actions.filter((a) => a.ok).length;
    replies.push(
      `J'ai préparé une première version de « ${name} » : identité, couleurs, page d'accueil` +
        (t.products.length ? ` et ${t.products.length} produits d'exemple à adapter` : "") +
        `. ${ok} action(s) réalisée(s).`,
      "Prochaines étapes : remplacez les textes d'exemple par vos vraies informations (matières, contenances), puis complétez l'onglet Légal pour pouvoir publier.",
    );
  }

  // 3. Ajout d'un produit : « ajoute (le produit) X à 25 € ».
  const add = userText.match(/ajoute[rz]?\s+(?:un produit\s+|le produit\s+)?[«"“]?(.+?)[»"”]?\s+(?:à|a|pour)\s+(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i);
  if (add) {
    const title = add[1].trim();
    const priceEur = Number(add[2].replace(",", "."));
    const o = call("add_product", {
      title,
      description: `${title}. Décrivez ici les caractéristiques réelles du produit (matière, dimensions, origine).`,
      priceEur,
    });
    replies.push(o.ok ? `Produit « ${title} » ajouté à ${priceEur} €.` : `Je n'ai pas pu ajouter « ${title} » : ${o.action.detail}`);
  }

  // 4. Code promo : « code promo BIENVENUE10 de 10 % ».
  const coupon = userText.match(/(?:code promo|coupon)\s+([A-Za-z0-9]{3,20}).*?(\d{1,2})\s*%/i);
  if (coupon) {
    const o = call("create_coupon", { code: coupon[1], percentOff: Number(coupon[2]) });
    replies.push(o.ok ? `Code ${coupon[1].toUpperCase()} créé (−${coupon[2]} %).` : `Code non créé : ${o.action.detail}`);
  }

  // 5. Couleur principale : « mets du vert ».
  const color = Object.keys(COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(text));
  if (color && /couleur|theme|mets|passe|change/.test(text) && !/boutique de/.test(text)) {
    const o = call("update_theme", { primaryColor: COLORS[color] });
    replies.push(o.ok ? `Couleur principale passée en ${color}.` : `Thème inchangé : ${o.action.detail}`);
  }

  // 6. Suppression : « supprime X ».
  const del = text.match(/supprime[rz]?\s+(?:le produit\s+)?(.+)$/);
  if (del) {
    const target = listProducts(storeId).find((p) => norm(p.title).includes(del[1].trim()));
    if (target) {
      const o = call("delete_product", { handle: target.handle });
      replies.push(o.ok ? `« ${target.title} » supprimé.` : `Suppression impossible : ${o.action.detail}`);
    } else {
      replies.push("Je n'ai pas trouvé ce produit.");
    }
  }

  // 7. Publication : on donne la liste de contrôle.
  if (/publi|mettre en ligne|en ligne/.test(text)) {
    const o = call("check_publish_readiness", {});
    const list = (JSON.parse(o.content).checklist ?? []) as { ok: boolean; label: string; fix?: string }[];
    const todo = list.filter((i) => !i.ok);
    replies.push(
      todo.length === 0
        ? "Tout est prêt : cliquez sur « Publier la boutique »."
        : "Avant de publier, il reste :\n" + todo.map((i) => `• ${i.label}${i.fix ? ` — ${i.fix}` : ""}`).join("\n"),
    );
  }

  if (replies.length === 0) {
    const store = getStore(storeId);
    replies.push(
      "Mode démo (sans IA) : je comprends des demandes simples comme " +
        "« Crée une boutique de bougies », « Ajoute Bougie Vanille à 28 € », " +
        "« Code promo BIENVENUE10 de 10 % », « Mets du vert », « Supprime Bougie Vanille » ou « Je veux publier ». " +
        `Ajoutez une clé ANTHROPIC_API_KEY pour converser librement avec l'IA${store ? ` sur « ${store.name} »` : ""}.`,
    );
  }

  return { reply: replies.join("\n\n"), actions };
}
