# Vitrine (nom de travail)

Créateur de boutiques en ligne piloté par IA, pensé pour corriger les défauts relevés chez Nealens : crédits opaques, verrouillage, juridique hors UE, contrefaçon, traceurs sans consentement.

Le détail, défaut par défaut, est dans **[docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)**.

## Démarrer

```bash
npm install
cp .env.example .env.local   # facultatif : ajoutez ANTHROPIC_API_KEY pour la vraie IA
npm run dev                  # http://localhost:3000
```

Sans clé d'API, l'assistant tourne en **mode démo** : il comprend des demandes simples (« Crée une boutique de bougies », « Ajoute Bougie Vanille à 28 € », « Code promo BIENVENUE10 de 10 % », « Je veux publier »). Il passe par les mêmes outils, les mêmes garde-fous et les mêmes débits que Claude.

| Adresse | Contenu |
|---|---|
| `/` | Site de la plateforme : engagements, tarifs, grille complète des crédits |
| `/dashboard` | Espace marchand : conversation avec l'IA, liste de contrôle, produits, commandes, journal des crédits, formulaire légal, domaine et export |
| `/s/<slug>` | Boutique publique : produits, panier, commande (paiement simulé), pages légales, plan du site |

## Commandes

```bash
npm test        # tests (garde-fou des marques, crédits, boucle Claude simulée, commandes, export)
npm run lint
npm run build
```

## Architecture

- **Next.js 16** (App Router, Cache Components), TypeScript, Tailwind.
- **SQLite intégré à Node** (`node:sqlite`) pour le prototype : `src/lib/db.ts`. Passage à PostgreSQL prévu.
- **Agent IA** : `src/lib/agent/`.
  - Boucle d'outils avec l'API Claude (`claude-opus-5-5`), avec cache du prompt système et repli automatique en cas de refus.
  - Chaque appel d'outil est validé (zod), contrôlé par le garde-fou des marques, puis débité dans la même transaction.
- **Crédits** : `src/lib/credits.ts` est la seule source de la grille de prix, affichée telle quelle sur le site.
- **Juridique** : `src/lib/legal.ts` génère les mentions légales, les CGV (droit français, rétractation de 14 jours, médiateur), la politique de confidentialité et la page cookies. À faire relire par un avocat avant la production.
- **Export** : `src/lib/export.ts` produit un JSON complet et un CSV au format d'import Shopify.
- **Domaines personnels** : `src/proxy.ts`.

## Limites du prototype

- Un seul marchand, sans authentification (voir la feuille de route, § 7 du cahier des charges).
- Paiement simulé : Stripe Connect reste à brancher.
- Pas encore d'envoi d'e-mails ni de stockage d'images.
- Le mode Claude a été testé avec une API simulée, pas encore contre l'API réelle.
