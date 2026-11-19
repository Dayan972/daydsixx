import { z } from "zod";

/**
 * Système de thèmes des boutiques.
 *
 * Principe : l'IA ne dessine pas la mise en page, elle **choisit** parmi des modèles
 * conçus à la main (typographie, espacements, comportements) et des palettes dont
 * les contrastes sont vérifiés. C'est ce qui garantit un résultat propre à chaque fois.
 */

// ---------------------------------------------------------------- Modèles

export const TEMPLATE_IDS = ["maison", "epure", "atelier"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATES: Record<
  TemplateId,
  { label: string; description: string; display: string; body: string; idealFor: string }
> = {
  maison: {
    label: "Maison",
    description: "Luxe éditorial : grandes capitales à empattements, beaucoup d'air, détails fins.",
    display: '"Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif',
    body: '"Manrope Variable", Manrope, ui-sans-serif, system-ui, sans-serif',
    idealFor: "parfumerie, joaillerie, horlogerie, mode haut de gamme, maroquinerie",
  },
  epure: {
    label: "Épure",
    description: "Minimal contemporain : typographie serrée, grandes images, grille nette.",
    display: '"Inter Tight Variable", "Inter Tight", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    idealFor: "mode, design, high-tech, cosmétique moderne, objets",
  },
  atelier: {
    label: "Atelier",
    description: "Artisanal et chaleureux : empattements doux, formes arrondies, tons naturels.",
    display: '"Fraunces Variable", Fraunces, Georgia, serif',
    body: '"DM Sans Variable", "DM Sans", ui-sans-serif, system-ui, sans-serif',
    idealFor: "bougies, céramique, épicerie fine, cosmétique naturelle, déco, créateurs",
  },
};

// ---------------------------------------------------------------- Palettes

export const PALETTE_IDS = [
  "ivoire",
  "nuit",
  "blanc",
  "ardoise",
  "sable",
  "terracotta",
  "sauge",
  "poudre",
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export interface Palette {
  label: string;
  bg: string;
  fg: string;
  surface: string;
  accent: string;
  /** Texte posé sur la couleur d'accent. */
  onAccent: string;
  dark: boolean;
}

export const PALETTES: Record<PaletteId, Palette> = {
  ivoire: { label: "Ivoire", bg: "#f6f1e9", fg: "#1c1813", surface: "#ebe3d6", accent: "#7a5c3a", onAccent: "#f6f1e9", dark: false },
  nuit: { label: "Nuit", bg: "#0f0e0c", fg: "#efe8dd", surface: "#1b1916", accent: "#c9a97c", onAccent: "#0f0e0c", dark: true },
  blanc: { label: "Blanc", bg: "#ffffff", fg: "#0f0f0f", surface: "#f3f3f1", accent: "#0f0f0f", onAccent: "#ffffff", dark: false },
  ardoise: { label: "Ardoise", bg: "#13171a", fg: "#e8ecee", surface: "#1d2327", accent: "#a9bccb", onAccent: "#13171a", dark: true },
  sable: { label: "Sable", bg: "#eee5d7", fg: "#2a2118", surface: "#e2d5c1", accent: "#8f5631", onAccent: "#f6efe4", dark: false },
  terracotta: { label: "Terracotta", bg: "#f7ede3", fg: "#31221a", surface: "#ecdccb", accent: "#a84a24", onAccent: "#fff7f0", dark: false },
  sauge: { label: "Sauge", bg: "#eef0e8", fg: "#1e251c", surface: "#e0e5d7", accent: "#4f6447", onAccent: "#f4f6ef", dark: false },
  poudre: { label: "Poudré", bg: "#f8eeeb", fg: "#2d1e1c", surface: "#f0dfd9", accent: "#9b4a52", onAccent: "#fff6f4", dark: false },
};

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue");

export const ThemeSchema = z.object({
  template: z
    .enum(TEMPLATE_IDS)
    .describe(
      "Modèle de mise en page : " +
        TEMPLATE_IDS.map((t) => `${t} = ${TEMPLATES[t].description} Idéal pour ${TEMPLATES[t].idealFor}.`).join(" "),
    ),
  palette: z
    .enum(PALETTE_IDS)
    .describe("Palette de couleurs : " + PALETTE_IDS.map((p) => `${p} (${PALETTES[p].dark ? "fond sombre" : "fond clair"})`).join(", ")),
  accentColor: hexColor
    .optional()
    .describe("Facultatif : remplace la couleur d'accent de la palette (#RRGGBB). À éviter sauf demande explicite."),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = { template: "epure", palette: "blanc" };

/** Lit un thème stocké, y compris l'ancien format (couleurs libres), sans planter. */
export function normalizeTheme(raw: unknown): Theme {
  const parsed = ThemeSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

/** Contraste WCAG entre deux couleurs #RRGGBB. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Palette effective : l'accent personnalisé n'est retenu que s'il reste lisible sur le fond. */
export function resolvePalette(theme: Theme): Palette {
  const base = PALETTES[theme.palette];
  if (theme.accentColor && contrastRatio(theme.accentColor, base.bg) >= 3) {
    const onAccent = contrastRatio(theme.accentColor, "#ffffff") >= 4.5 ? "#ffffff" : "#111111";
    return { ...base, accent: theme.accentColor, onAccent };
  }
  return base;
}

// ---------------------------------------------------------------- Sections

/** Référence d'image : « media:<id> » (médiathèque) ou URL https. */
export const MediaRef = z
  .string()
  .regex(/^(media:[0-9a-f-]{36}|https:\/\/\S+)$/, "Référence média attendue : media:<id> ou URL https")
  .describe("Image de la médiathèque (media:<id>) ou URL https fournie par le marchand");

export const SECTION_TYPES = [
  "hero",
  "split",
  "manifesto",
  "marquee",
  "product_grid",
  "featured_product",
  "gallery",
  "features",
  "faq",
  "newsletter",
  "text",
] as const;

/**
 * Pas de type « témoignages » ni « presse » : l'IA ne doit pas inventer d'avis
 * ou de citations (pratique commerciale trompeuse).
 */
export const SectionSchema = z.object({
  type: z
    .enum(SECTION_TYPES)
    .describe(
      "hero = ouverture plein écran (image de fond si fournie) ; split = image + texte côte à côte ; " +
        "manifesto = grande phrase d'intention ; marquee = bandeau défilant de mots courts (items) ; " +
        "product_grid = grille des produits ; featured_product = un produit mis en scène (productHandle) ; " +
        "gallery = mosaïque d'images (images) ; features = 3 ou 4 engagements (items) ; " +
        "faq = questions/réponses (items) ; newsletter = inscription ; text = paragraphe libre",
    ),
  eyebrow: z.string().max(40).optional().describe("Petit sur-titre en capitales, ex. « Collection automne »"),
  title: z.string().min(1).max(140),
  text: z.string().max(1200).optional(),
  buttonLabel: z.string().max(40).optional(),
  image: MediaRef.optional(),
  images: z.array(MediaRef).max(8).optional(),
  imagePosition: z.enum(["gauche", "droite"]).optional().describe("Pour split : côté de l'image"),
  productHandle: z.string().optional().describe("Pour featured_product : identifiant du produit"),
  items: z
    .array(z.object({ title: z.string().max(120), text: z.string().max(400).optional() }))
    .max(8)
    .optional(),
});
export type Section = z.infer<typeof SectionSchema>;

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
