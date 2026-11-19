import { z } from "zod";

/** Types partagés client/serveur pour l'apparence d'une boutique. */

export const FONT_STACKS = {
  elegant: 'Georgia, "Times New Roman", serif',
  moderne: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  arrondie: '"Trebuchet MS", "Avenir Next", ui-rounded, system-ui, sans-serif',
  technique: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue");

export const ThemeSchema = z.object({
  primaryColor: hexColor.describe("Couleur principale (boutons, liens), format #RRGGBB"),
  backgroundColor: hexColor.describe("Couleur de fond, format #RRGGBB"),
  textColor: hexColor.describe("Couleur du texte, format #RRGGBB, bien contrastée avec le fond"),
  font: z.enum(["elegant", "moderne", "arrondie", "technique"]).describe("Famille de police"),
  style: z
    .enum(["minimal", "chaleureux", "luxe", "audacieux"])
    .describe("Ambiance générale : espacements, arrondis, casse des titres"),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = {
  primaryColor: "#1f2937",
  backgroundColor: "#ffffff",
  textColor: "#111827",
  font: "moderne",
  style: "minimal",
};

/**
 * Sections de page d'accueil. Pas de type « témoignages » : l'IA ne doit pas
 * inventer d'avis clients (pratique commerciale trompeuse).
 */
export const SectionSchema = z.object({
  type: z
    .enum(["hero", "features", "product_grid", "text", "newsletter"])
    .describe(
      "hero = grand bandeau d'accroche ; features = 3 à 4 arguments ; product_grid = grille des produits ; text = paragraphe libre (histoire de la marque) ; newsletter = inscription",
    ),
  title: z.string().min(1).max(120),
  text: z.string().max(1200).optional().describe("Texte d'accompagnement"),
  buttonLabel: z.string().max(40).optional().describe("Libellé du bouton (hero uniquement)"),
  items: z
    .array(z.object({ title: z.string().max(80), text: z.string().max(300) }))
    .max(6)
    .optional()
    .describe("Éléments de la section features"),
});
export type Section = z.infer<typeof SectionSchema>;

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}
