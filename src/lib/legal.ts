import { z } from "zod";

/**
 * Informations légales du marchand et génération de ses pages obligatoires
 * (mentions légales, CGV, confidentialité, cookies) selon le droit français.
 *
 * Ces gabarits sont des points de départ : ils doivent être relus par un
 * professionnel du droit avant une mise en production.
 *
 * L'IA n'a pas accès à ces champs : ce sont des faits (SIRET, adresse…) que
 * seul le marchand peut fournir. Les inventer serait trompeur.
 */

export const LegalInfoSchema = z.object({
  companyName: z.string().min(2).max(120),
  legalForm: z.string().min(2).max(60),
  siret: z.string().regex(/^\d{14}$/, "14 chiffres sans espace"),
  rcs: z.string().max(80).optional().or(z.literal("")),
  vatNumber: z.string().max(20).optional().or(z.literal("")),
  address: z.string().min(10).max(250),
  email: z.email(),
  phone: z.string().max(30).optional().or(z.literal("")),
  publisherName: z.string().min(2).max(120),
  // Facultatifs : par défaut, l'hébergeur est la plateforme (PLATFORM_HOST_DEFAULTS).
  hostName: z.string().max(120).optional().or(z.literal("")),
  hostAddress: z.string().max(250).optional().or(z.literal("")),
  mediatorName: z.string().min(2).max(160),
  mediatorUrl: z.url(),
  returnDays: z.coerce.number().int().min(14).max(365),
  shippingInfo: z.string().min(10).max(600),
});
export type LegalInfo = z.infer<typeof LegalInfoSchema>;

export const LEGAL_FIELD_LABELS: Record<keyof LegalInfo, string> = {
  companyName: "Raison sociale ou nom de l'entrepreneur",
  legalForm: "Forme juridique (micro-entreprise, SAS, SARL…)",
  siret: "SIRET",
  rcs: "RCS ou RNE (facultatif pour les micro-entrepreneurs)",
  vatNumber: "N° de TVA intracommunautaire (si assujetti)",
  address: "Adresse du siège",
  email: "E-mail de contact",
  phone: "Téléphone (facultatif)",
  publisherName: "Directeur ou directrice de la publication",
  hostName: "Hébergeur du site",
  hostAddress: "Adresse de l'hébergeur",
  mediatorName: "Médiateur de la consommation",
  mediatorUrl: "Site du médiateur",
  returnDays: "Délai de rétractation en jours (14 minimum)",
  shippingInfo: "Livraison : zones, délais et frais",
};

/** Valeurs par défaut pour l'hébergement de la plateforme (à adapter). */
export const PLATFORM_HOST_DEFAULTS = {
  hostName: process.env.PLATFORM_HOST_NAME ?? "Vitrine (hébergement UE, à compléter)",
  hostAddress: process.env.PLATFORM_HOST_ADDRESS ?? "Adresse de l'hébergeur à compléter",
};

export function missingLegalFields(legal: Partial<LegalInfo>): (keyof LegalInfo)[] {
  const result = LegalInfoSchema.safeParse(legal);
  if (result.success) return [];
  return [...new Set(result.error.issues.map((i) => i.path[0] as keyof LegalInfo))];
}

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalPage {
  slug: "mentions-legales" | "cgv" | "confidentialite" | "cookies";
  title: string;
  sections: LegalSection[];
}

export const LEGAL_PAGES: { slug: LegalPage["slug"]; title: string }[] = [
  { slug: "mentions-legales", title: "Mentions légales" },
  { slug: "cgv", title: "Conditions générales de vente" },
  { slug: "confidentialite", title: "Politique de confidentialité" },
  { slug: "cookies", title: "Cookies" },
];

const or = (v: string | undefined, fallback: string) => (v && v.trim() ? v : fallback);

export function buildLegalPage(
  slug: LegalPage["slug"],
  storeName: string,
  l: Partial<LegalInfo>,
): LegalPage {
  const company = or(l.companyName, "[raison sociale à compléter]");
  const email = or(l.email, "[e-mail à compléter]");
  const days = l.returnDays ?? 14;

  switch (slug) {
    case "mentions-legales":
      return {
        slug,
        title: "Mentions légales",
        sections: [
          {
            heading: "Éditeur du site",
            paragraphs: [
              `${storeName} est édité par ${company}, ${or(l.legalForm, "[forme juridique]")}.`,
              `Siège : ${or(l.address, "[adresse à compléter]")}.`,
              `SIRET : ${or(l.siret, "[SIRET à compléter]")}` +
                (l.rcs ? ` · ${l.rcs}` : "") +
                (l.vatNumber ? ` · TVA : ${l.vatNumber}` : "") +
                ".",
              `Contact : ${email}` + (l.phone ? ` · ${l.phone}` : "") + ".",
              `Directeur ou directrice de la publication : ${or(l.publisherName, "[à compléter]")}.`,
            ],
          },
          {
            heading: "Hébergement",
            paragraphs: [
              `${or(l.hostName, PLATFORM_HOST_DEFAULTS.hostName)}, ${or(l.hostAddress, PLATFORM_HOST_DEFAULTS.hostAddress)}.`,
            ],
          },
          {
            heading: "Propriété intellectuelle",
            paragraphs: [
              `Les textes, visuels et marques présents sur ce site appartiennent à ${company} ou sont utilisés avec autorisation.`,
            ],
          },
        ],
      };

    case "cgv":
      return {
        slug,
        title: "Conditions générales de vente",
        sections: [
          {
            heading: "1. Objet",
            paragraphs: [
              `Les présentes conditions régissent les ventes conclues sur ${storeName} entre ${company} (le vendeur) et toute personne effectuant un achat (le client).`,
            ],
          },
          {
            heading: "2. Prix",
            paragraphs: [
              "Les prix sont indiqués en euros toutes taxes comprises (TTC). Les frais de livraison sont indiqués avant la validation de la commande.",
            ],
          },
          {
            heading: "3. Commande et paiement",
            paragraphs: [
              "La commande est confirmée après acceptation du paiement. Un récapitulatif est envoyé par e-mail.",
            ],
          },
          {
            heading: "4. Livraison",
            paragraphs: [or(l.shippingInfo, "[conditions de livraison à compléter]")],
          },
          {
            heading: "5. Droit de rétractation",
            paragraphs: [
              `Conformément à l'article L221-18 du Code de la consommation, le client dispose d'un délai de ${days} jours à compter de la réception du produit pour se rétracter, sans avoir à se justifier.`,
              `Pour l'exercer, il suffit d'envoyer une déclaration dénuée d'ambiguïté à ${email}. Le remboursement intervient dans les 14 jours suivant la réception de cette déclaration, les frais de retour restant à la charge du client sauf mention contraire.`,
            ],
          },
          {
            heading: "6. Garanties légales",
            paragraphs: [
              "Les produits bénéficient de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation) pendant 2 ans, et de la garantie des vices cachés (articles 1641 et suivants du Code civil).",
            ],
          },
          {
            heading: "7. Médiation et litiges",
            paragraphs: [
              `En cas de litige, le client peut recourir gratuitement au médiateur de la consommation : ${or(l.mediatorName, "[médiateur à désigner]")}` +
                (l.mediatorUrl ? ` (${l.mediatorUrl})` : "") +
                ".",
              "Les présentes conditions sont soumises au droit français. Le consommateur conserve la protection des dispositions impératives de la loi de son pays de résidence et peut saisir la juridiction de son domicile.",
            ],
          },
        ],
      };

    case "confidentialite":
      return {
        slug,
        title: "Politique de confidentialité",
        sections: [
          {
            heading: "Responsable du traitement",
            paragraphs: [`${company}, ${or(l.address, "[adresse]")}. Contact : ${email}.`],
          },
          {
            heading: "Données collectées et finalités",
            paragraphs: [
              "Lors d'une commande : nom, adresse e-mail, adresse de livraison et contenu de la commande, pour exécuter le contrat de vente (base légale : contrat).",
              "Données de facturation conservées 10 ans (obligation comptable). Données de compte client conservées 3 ans après le dernier achat.",
            ],
          },
          {
            heading: "Sous-traitants",
            paragraphs: [
              `Hébergement : ${or(l.hostName, PLATFORM_HOST_DEFAULTS.hostName)}. Paiement : prestataire de paiement du vendeur (par exemple Stripe Payments Europe, Irlande).`,
              "Lorsque des données sont transférées hors de l'Union européenne, ce transfert est encadré par les clauses contractuelles types de la Commission européenne ou par une décision d'adéquation.",
            ],
          },
          {
            heading: "Mesure d'audience",
            paragraphs: [
              "Ce site compte les pages vues sans cookie, sans adresse IP et sans identifiant : aucune donnée personnelle n'est collectée à cette fin.",
            ],
          },
          {
            heading: "Vos droits",
            paragraphs: [
              `Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Écrivez à ${email} : réponse sous un mois.`,
              "Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).",
            ],
          },
        ],
      };

    case "cookies":
      return {
        slug,
        title: "Cookies",
        sections: [
          {
            heading: "Ce que ce site dépose",
            paragraphs: [
              "Uniquement ce qui est nécessaire au fonctionnement : le contenu de votre panier (stocké dans votre navigateur) et votre choix concernant les cookies.",
              "Aucun cookie publicitaire ni traceur tiers n'est déposé. La mesure d'audience fonctionne sans cookie.",
            ],
          },
          {
            heading: "Modifier votre choix",
            paragraphs: [
              "Vous pouvez modifier votre choix à tout moment via le lien « Cookies » en bas de chaque page.",
            ],
          },
        ],
      };
  }
}
