/**
 * Garde-fou « marques tierces ».
 *
 * Nealens a été démontré avec un clone de Cartier, et son IA « inspecte » les sites
 * du Labo et de Byredo. Ici, toute action qui reprend une marque protégée est
 * bloquée avant d'être exécutée :
 *  - identité de la boutique, thème, page d'accueil : toujours bloqué ;
 *  - fiche produit : autorisé seulement si le marchand a déclaré revendre des
 *    produits authentiques (revendeur autorisé), sinon bloqué ;
 *  - mots qui signalent une contrefaçon (« dupe », « réplique »…) : toujours bloqués.
 *
 * La liste est volontairement limitée à des termes peu ambigus. En production,
 * la compléter avec une recherche dans les bases INPI / EUIPO / WIPO.
 */

const PROTECTED_BRANDS: string[] = [
  // Horlogerie et joaillerie
  "cartier", "rolex", "patek philippe", "audemars piguet", "omega seamaster", "omega speedmaster",
  "tag heuer", "breitling", "hublot", "richard mille", "jaeger-lecoultre", "vacheron constantin",
  "van cleef", "van cleef & arpels", "boucheron", "chaumet", "tiffany & co", "bulgari", "bvlgari",
  "chopard", "swarovski", "pandora",
  // Mode et maroquinerie
  "hermes", "chanel", "dior", "louis vuitton", "gucci", "prada", "saint laurent", "yves saint laurent",
  "balenciaga", "givenchy", "versace", "fendi", "burberry", "moncler", "lacoste", "ralph lauren",
  "nike", "adidas", "air jordan", "off-white", "stone island", "the north face",
  // Parfumerie (maisons et jus emblématiques vus dans la démo Nealens)
  "le labo", "byredo", "creed", "aventus", "maison francis kurkdjian", "baccarat rouge",
  "frederic malle", "portrait of a lady", "parfums de marly", "layton", "tom ford", "jo malone",
  "diptyque", "guerlain", "lancome", "santal 33", "by kilian", "xerjoff", "maison margiela",
  // Tech et licences
  "apple watch", "iphone", "airpods", "macbook", "samsung galaxy", "playstation", "nintendo",
  "disney", "marvel", "pokemon", "lego", "harry potter", "star wars",
];

/** Termes qui signalent une imitation : bloqués dans tous les cas. */
const COUNTERFEIT_SIGNALS: string[] = [
  "dupe", "dupes", "replique", "repliques", "replica", "contretype", "contretypes", "1:1",
];

/** Tournures suspectes seulement quand une marque protégée les suit (« façon Chanel »). */
const IMITATION_PREFIXES: string[] = [
  "facon", "type", "inspire de", "inspiree de", "inspire du", "copie de", "imitation de", "comme",
];

function normalize(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9&:\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function containsTerm(haystack: string, term: string): boolean {
  return haystack.includes(normalize(term));
}

export interface BrandCheck {
  brands: string[];
  counterfeitSignals: string[];
}

export function scanText(...texts: (string | undefined | null)[]): BrandCheck {
  const hay = normalize(texts.filter(Boolean).join(" \n "));
  const brands = PROTECTED_BRANDS.filter((b) => containsTerm(hay, b));
  const signals = COUNTERFEIT_SIGNALS.filter((s) => containsTerm(hay, s));
  for (const prefix of IMITATION_PREFIXES) {
    if (brands.some((b) => containsTerm(hay, `${prefix} ${b}`))) signals.push(prefix);
  }
  return { brands, counterfeitSignals: signals };
}

/** Récupère toutes les chaînes d'un objet (entrée d'outil) pour les analyser. */
export function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

export type BrandContext = "identity" | "product";

export interface GuardrailVerdict {
  allowed: boolean;
  reason?: string;
}

export function checkBrandUse(
  input: unknown,
  context: BrandContext,
  authenticResellerDeclared: boolean,
): GuardrailVerdict {
  const { brands, counterfeitSignals } = scanText(...collectStrings(input));
  if (counterfeitSignals.length > 0) {
    return {
      allowed: false,
      reason:
        `Termes associés à la contrefaçon détectés (${counterfeitSignals.join(", ")}). ` +
        "Vendre des imitations de produits de marque est illégal (article L716-10 du Code de la propriété intellectuelle). " +
        "Décrivez le produit pour ce qu'il est, sans référence à une autre marque.",
    };
  }
  if (brands.length === 0) return { allowed: true };
  const list = brands.join(", ");
  if (context === "identity") {
    return {
      allowed: false,
      reason:
        `Marque(s) protégée(s) détectée(s) : ${list}. Une boutique ne peut pas reprendre le nom, ` +
        "le logo ou l'univers d'une marque existante (contrefaçon, concurrence déloyale). " +
        "Proposez une identité originale.",
    };
  }
  if (!authenticResellerDeclared) {
    return {
      allowed: false,
      reason:
        `Marque(s) tierce(s) détectée(s) : ${list}. Pour vendre des produits de marque, le marchand doit ` +
        "d'abord déclarer, dans l'onglet Légal, qu'il revend des produits authentiques en tant que " +
        "revendeur autorisé (certaines marques imposent une distribution sélective).",
    };
  }
  return { allowed: true };
}
