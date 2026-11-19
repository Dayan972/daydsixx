import type { ChatAction } from "../db";
import { getStore, listProducts } from "../db";
import { checkBrandUse, scanText } from "../guardrails/brands";
import type { PaletteId, Section, Theme } from "../store-types";
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
  sections: (name: string) => Section[];
  products: { title: string; description: string; priceEur: number; tags: string[] }[];
}

const TEMPLATES: Template[] = [
  {
    keywords: ["parfum", "fragrance", "eau de", "senteur"],
    name: "Maison Brume",
    tagline: "Parfums de niche composés en petites séries",
    description: "Une maison de parfum indépendante : des compositions originales, produites en séries numérotées.",
    theme: { template: "maison", palette: "nuit" },
    sections: (name) => [
      { type: "hero", eyebrow: "Parfums de niche", title: name, text: "Des sillages composés comme des souvenirs, en séries numérotées.", buttonLabel: "Découvrir la collection" },
      { type: "marquee", title: "Nos engagements", items: [{ title: "Séries numérotées" }, { title: "Compositions originales" }, { title: "Échantillons offerts" }] },
      { type: "product_grid", eyebrow: "La collection", title: "Trois sillages, trois saisons" },
      { type: "manifesto", eyebrow: "Notre approche", title: "Un parfum ne se porte pas, il se raconte.", text: "Chaque composition commence par un lieu, une heure, une matière." },
      { type: "featured_product", eyebrow: "La signature", title: "Brume d'Ambre", productHandle: "brume-d-ambre" },
      { type: "split", eyebrow: "L'atelier", title: "Composé lentement", text: "Racontez ici qui compose vos parfums, où, et avec quelles matières. Ce texte est un exemple à remplacer.", imagePosition: "droite" },
      { type: "faq", eyebrow: "Questions", title: "Avant de choisir", items: [
        { title: "Puis-je essayer avant d'acheter ?", text: "Le coffret découverte contient trois échantillons de 2 ml." },
        { title: "Quels sont les délais de livraison ?", text: "Précisez vos délais dans l'onglet Légal : ils s'afficheront ici." },
      ] },
      { type: "newsletter", eyebrow: "Lettre", title: "Les prochaines séries", text: "Soyez prévenu avant l'ouverture de chaque série." },
    ],
    products: [
      { title: "Brume d'Ambre", description: "Un sillage chaud et boisé, autour de l'ambre et de la vanille.\n\nFlacon de 50 ml.", priceEur: 89, tags: ["Boisé", "ambré"] },
      { title: "Figue Solaire", description: "Une fragrance verte et lumineuse, autour de la feuille de figuier.\n\nFlacon de 50 ml.", priceEur: 79, tags: ["Vert", "fruité"] },
      { title: "Coffret découverte", description: "Trois échantillons de 2 ml pour découvrir la collection avant de choisir un flacon.", priceEur: 18, tags: ["Coffret"] },
    ],
  },
  {
    keywords: ["bougie", "bougies", "cire"],
    name: "Lueur & Cire",
    tagline: "Bougies coulées à la main",
    description: "Des bougies parfumées coulées à la main, pour des intérieurs apaisés.",
    theme: { template: "atelier", palette: "terracotta" },
    sections: (name) => [
      { type: "hero", eyebrow: "Atelier de bougies", title: "La lumière des soirs lents", text: `${name} coule chaque bougie à la main, en petites fournées.`, buttonLabel: "Voir les bougies" },
      { type: "product_grid", eyebrow: "La collection", title: "Nos bougies" },
      { type: "split", eyebrow: "L'atelier", title: "Coulées une à une", text: "Présentez ici votre atelier et votre façon de travailler : c'est ce qui vous distingue. Ce texte est un exemple à remplacer.", imagePosition: "gauche" },
      { type: "features", eyebrow: "Nos engagements", title: "Pensées pour durer", items: [
        { title: "Coulées à la main", text: "Chaque bougie est coulée et étiquetée à l'atelier." },
        { title: "Longue combustion", text: "Indiquez ici la durée réelle de combustion." },
        { title: "Pots rechargeables", text: "Rapportez votre pot, nous le remplissons." },
      ] },
      { type: "marquee", title: "Esprit atelier", items: [{ title: "Fait main" }, { title: "Petites fournées" }, { title: "Pots rechargeables" }] },
      { type: "newsletter", eyebrow: "Restons en contact", title: "Les nouvelles fournées", text: "Nouveautés et coulisses de l'atelier, une fois par mois." },
    ],
    products: [
      { title: "Feu de Bois", description: "Notes fumées et boisées pour les soirées d'hiver.\n\nPot en verre de 200 g.", priceEur: 32, tags: ["Boisé"] },
      { title: "Linge Frais", description: "Une senteur propre et légère.\n\nPot en verre de 200 g.", priceEur: 32, tags: ["Frais"] },
      { title: "Mini trio", description: "Trois petites bougies de 60 g à offrir.", priceEur: 29, tags: ["Coffret"] },
    ],
  },
  {
    keywords: ["bijou", "bijoux", "collier", "bague", "boucles", "joaillerie"],
    name: "Atelier Sillon",
    tagline: "Bijoux fins, façonnés à la main",
    description: "Des bijoux fins et intemporels, façonnés à la main en petites quantités.",
    theme: { template: "epure", palette: "blanc" },
    sections: (name) => [
      { type: "hero", eyebrow: "Nouvelle collection", title: "Des lignes qui restent", text: `${name} façonne des bijoux fins, pensés pour être portés tous les jours.`, buttonLabel: "Voir la collection" },
      { type: "product_grid", eyebrow: "Collection", title: "Pièces essentielles" },
      { type: "split", eyebrow: "Savoir-faire", title: "Façonnés à la main", text: "Expliquez ici vos matériaux et votre façon de travailler. Ce texte est un exemple à remplacer.", imagePosition: "droite" },
      { type: "gallery", title: "À porter" },
      { type: "faq", eyebrow: "Questions", title: "Bon à savoir", items: [
        { title: "Comment entretenir mes bijoux ?", text: "Indiquez ici vos conseils d'entretien selon le métal utilisé." },
        { title: "L'emballage cadeau est-il possible ?", text: "Précisez ici si vous le proposez." },
      ] },
      { type: "newsletter", title: "Les nouvelles pièces en avant-première" },
    ],
    products: [
      { title: "Collier Ligne", description: "Une chaîne fine et un pendentif géométrique.\n\nPrécisez ici le métal et la longueur.", priceEur: 59, tags: ["Collier"] },
      { title: "Bague Sillon", description: "Un anneau fin, gravé d'une ligne.\n\nPrécisez ici le métal et les tailles disponibles.", priceEur: 45, tags: ["Bague"] },
      { title: "Créoles Arc", description: "Des créoles légères au profil arrondi.\n\nPrécisez ici le métal et le diamètre.", priceEur: 52, tags: ["Boucles d'oreilles"] },
    ],
  },
];

const DEFAULT_TEMPLATE: Template = {
  keywords: [],
  name: "Comptoir Neuf",
  tagline: "Une sélection choisie avec soin",
  description: "Une boutique indépendante. Décrivez à l'IA ce que vous vendez pour personnaliser ce texte.",
  theme: { template: "epure", palette: "ivoire" },
  sections: (name) => [
    { type: "hero", eyebrow: "Boutique indépendante", title: name, text: "Une sélection choisie avec soin.", buttonLabel: "Découvrir" },
    { type: "product_grid", title: "La sélection" },
    { type: "text", eyebrow: "À propos", title: "Notre histoire", text: "Présentez votre boutique en quelques phrases. Ce texte est un exemple à remplacer." },
    { type: "newsletter", title: "Restons en contact" },
  ],
  products: [],
};

/** Couleurs demandées en langage courant → palette conçue pour rester lisible. */
const PALETTE_WORDS: [RegExp, PaletteId][] = [
  [/\b(sombre|noir|nuit|dark)\b/, "nuit"],
  [/\b(blanc|clair|minimal)\b/, "blanc"],
  [/\b(vert|sauge|nature)\b/, "sauge"],
  [/\b(rose|poudre)\b/, "poudre"],
  [/\b(beige|sable)\b/, "sable"],
  [/\b(orange|terracotta|terre)\b/, "terracotta"],
  [/\b(gris|bleu|ardoise)\b/, "ardoise"],
  [/\b(creme|ivoire)\b/, "ivoire"],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Place les photos jointes : ouverture, puis produits, puis sections image + texte. */
function withPhotos(sections: Section[], photos: string[]): { sections: Section[]; rest: string[] } {
  const queue = [...photos];
  const out = sections.map((s) => {
    if ((s.type === "hero" || s.type === "split") && queue.length > 0) return { ...s, image: queue.shift() };
    if (s.type === "gallery" && photos.length > 0) return { ...s, images: photos.slice(0, 5) };
    return s;
  });
  return { sections: out, rest: queue };
}

export function runDemoTurn(storeId: string, userText: string, budget: TurnBudget, photos: string[] = []) {
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

  let photosUsed = false;

  // 2. Création complète d'une boutique.
  if (/(cree|creer|lance|monte|fais|faire).*(boutique|site|shop)|boutique de /.test(text)) {
    const t = TEMPLATES.find((tpl) => tpl.keywords.some((k) => text.includes(k))) ?? DEFAULT_TEMPLATE;
    const quoted = userText.match(/[«"“]\s*([^»"”]{2,60})\s*[»"”]/)?.[1];
    const name = quoted ?? t.name;
    // Les photos vont d'abord aux produits (ce que le client achète), puis à l'ouverture.
    const productPhotos = photos.slice(0, t.products.length);
    const { sections } = withPhotos(t.sections(name), photos.slice(t.products.length).concat(photos.slice(0, 1)));
    call("update_store_identity", { name, tagline: t.tagline, description: t.description });
    call("update_theme", t.theme);
    call("set_homepage_sections", { sections });
    t.products.forEach((p, i) => call("add_product", productPhotos[i] ? { ...p, images: [productPhotos[i]] } : p));
    photosUsed = photos.length > 0;
    const ok = actions.filter((a) => a.ok).length;
    replies.push(
      `J'ai préparé une première version de « ${name} » : modèle ${t.theme.template}, page d'accueil en ${sections.length} sections` +
        (t.products.length ? ` et ${t.products.length} produits d'exemple à adapter` : "") +
        `. ${ok} action(s) réalisée(s).`,
      photos.length
        ? "Vos photos ont été placées sur les produits et en ouverture."
        : "Envoyez vos photos (bouton trombone) : c'est ce qui fera le plus progresser le rendu de la boutique.",
      "Remplacez ensuite les textes d'exemple par vos vraies informations, puis complétez l'onglet Légal pour pouvoir publier.",
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
      ...(photos.length && !photosUsed ? { images: photos } : {}),
    });
    photosUsed ||= photos.length > 0;
    replies.push(o.ok ? `Produit « ${title} » ajouté à ${priceEur} €.` : `Je n'ai pas pu ajouter « ${title} » : ${o.action.detail}`);
  }

  // 4. Code promo : « code promo BIENVENUE10 de 10 % ».
  const coupon = userText.match(/(?:code promo|coupon)\s+([A-Za-z0-9]{3,20}).*?(\d{1,2})\s*%/i);
  if (coupon) {
    const o = call("create_coupon", { code: coupon[1], percentOff: Number(coupon[2]) });
    replies.push(o.ok ? `Code ${coupon[1].toUpperCase()} créé (−${coupon[2]} %).` : `Code non créé : ${o.action.detail}`);
  }

  // 5. Ambiance de couleurs : « passe en sombre », « mets du vert ».
  const palette = PALETTE_WORDS.find(([re]) => re.test(text))?.[1];
  if (palette && /couleur|theme|mets|passe|change|ambiance/.test(text) && !/boutique de/.test(text)) {
    const o = call("update_theme", { palette });
    replies.push(o.ok ? `Palette « ${palette} » appliquée.` : `Thème inchangé : ${o.action.detail}`);
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

  // 7. Photos envoyées sans autre consigne : elles vont dans l'ouverture et les produits sans visuel.
  if (photos.length > 0 && !photosUsed) {
    const store = getStore(storeId)!;
    const queue = [...photos];
    for (const p of listProducts(storeId).filter((x) => x.images.length === 0)) {
      if (!queue.length) break;
      call("update_product", { handle: p.handle, images: [queue.shift()!] });
    }
    if (queue.length && store.sections.length) {
      call("set_homepage_sections", { sections: withPhotos(store.sections, queue).sections });
    }
    replies.push(`${photos.length} photo(s) placée(s) dans la boutique.`);
  }

  // 8. Publication : on donne la liste de contrôle.
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
        "« Crée une boutique de parfums », « Crée une boutique de bougies », « Ajoute Bougie Vanille à 28 € », " +
        "« Code promo BIENVENUE10 de 10 % », « Passe en sombre », « Supprime Bougie Vanille » ou « Je veux publier ». " +
        `Ajoutez une clé ANTHROPIC_API_KEY pour converser librement avec l'IA${store ? ` sur « ${store.name} »` : ""}.`,
    );
  }

  return { reply: replies.join("\n\n"), actions };
}
