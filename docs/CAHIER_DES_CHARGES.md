# Cahier des charges : « Vitrine » (nom de travail)

Créateur de boutiques en ligne piloté par IA, conçu pour corriger un par un les défauts constatés chez Nealens (nealens.com, analysé le 19/11/2026).

> Le nom « Vitrine » est provisoire. Il se change via la variable `NEXT_PUBLIC_BRAND_NAME`. Avant de déposer un nom définitif, vérifiez sa disponibilité à l'INPI et à l'EUIPO.

---

## 1. Promesse produit

« Décrivez votre boutique, l'IA la construit. Elle reste **à vous** : votre domaine, vos données, exportables à tout moment, conforme au droit européen dès le premier jour. »

Cible : les créateurs et petits commerçants francophones qui débutent, sans compétences techniques.

---

## 2. Défauts de Nealens et réponse de Vitrine

| # | Défaut constaté chez Nealens | Réponse de Vitrine | Statut dans le prototype |
|---|---|---|---|
| 1 | Crédits jamais expliqués (« 100 crédits/mois », sans savoir ce que coûte une action) | **Grille publique** : chaque action a un coût fixe affiché, l'estimation apparaît *avant* l'envoi et un journal détaille chaque débit | ✅ `src/lib/credits.ts`, journal dans le tableau de bord |
| 2 | Crédits non reportés, recharges qui expirent au bout de 180 jours et ne sont pas remboursables | Report des crédits du mois (plafond : 2 × l'allocation mensuelle). Les recharges **n'expirent jamais** et sont remboursables 14 jours si elles n'ont pas été utilisées | ✅ règle de report codée (`rolloverCredits`) |
| 3 | Prix en dollars, HT ou TTC non précisé, une seule formule | Prix en **€ TTC**, 3 formules, formule annuelle affichée | ✅ page Tarifs |
| 4 | Essai de 3 jours | Essai de **14 jours** sans carte bancaire | ✅ affiché |
| 5 | Aucune preuve sociale, galerie de 3 modèles répétés | Galerie de vraies boutiques (avec l'accord des marchands), statistiques publiques, page « Statut » | 🟡 à faire après le lancement |
| 6 | Éditeur anonyme : LLC du Wyoming à une adresse de domiciliation | **Société de droit français ou européen** (SAS), mentions légales complètes, dirigeant nommé | 📄 démarche juridique, gabarit de mentions légales fourni |
| 7 | CGV soumises au droit du Wyoming, rétractation exclue | Droit français, tribunaux du domicile du consommateur, médiateur de la consommation, rétractation de 14 jours | 📄 gabarits dans `src/lib/legal.ts` |
| 8 | Google Analytics chargé sans consentement, politique de confidentialité incomplète (transferts hors UE, CNIL) | **Aucun traceur tiers.** Mesure d'audience interne sans cookie (exemptée de consentement par la CNIL). Politique complète : sous-traitants, transferts, droits, droit de saisir la CNIL | ✅ mesure sans cookie, bannière cookies sur les boutiques |
| 9 | Aucun export prévu, verrouillage sur la plateforme | **Export en un clic** : JSON complet et CSV au format d'import Shopify. Garantie écrite dans les CGU | ✅ `/api/stores/[id]/export` |
| 10 | Boutique sur un sous-domaine Nealens (`*.nealens.shop`) | Domaine personnel branché dès la création. Le sous-domaine ne sert qu'à l'aperçu | ✅ routage par domaine (`src/proxy.ts`) |
| 11 | L'IA « inspecte » les sites du Labo et de Byredo, démo avec un clone de Cartier | **Garde-fou marques** : l'IA refuse de reprendre une marque protégée (nom, logo, slogan) et explique pourquoi. Elle crée une identité originale | ✅ `src/lib/guardrails/brands.ts` + consigne système |
| 12 | Revente de parfums de marques (Aventus, Baccarat Rouge…) sans contrôle | Un produit qui cite une marque tierce est bloqué tant que le marchand n'a pas déclaré être revendeur autorisé de produits authentiques | ✅ champ `authenticResellerDeclared` |
| 13 | Tout le contenu généré par l'IA est à la charge du marchand, sans aide | Contrôles automatiques avant publication : pages légales complètes, aucune marque bloquée, prix renseignés | ✅ liste de contrôle de publication |
| 14 | Suspension « sans préavis ni remboursement » | Préavis de 30 jours sauf fraude avérée, export toujours possible pendant le préavis, remboursement au prorata | 📄 CGU |
| 15 | SLA de 99 % sans compensation | Objectif de 99,9 %, avoir automatique en cas de dépassement, page de statut publique | 📄 CGU |
| 16 | Parcours confus (liste d'attente restée dans le code) | Un seul parcours : inscription, puis conversation, puis boutique | ✅ |
| 17 | Référencement faible : pas de robots.txt, pas de canonique, pas d'image Open Graph | robots.txt, sitemap, balise canonique, image Open Graph et données structurées `Product` sur chaque boutique | ✅ métadonnées des boutiques |
| 18 | Vidéos « Shopify est mort, commente IA » | Marketing honnête : démos non montées, chiffres réels, pas de dénigrement de concurrents | 📄 charte marketing (§ 8) |

Légende : ✅ codé dans le prototype · 🟡 prévu · 📄 contractuel ou organisationnel.

---

## 3. Périmètre du prototype (MVP)

1. **Conversation avec l'IA** (`/dashboard`) : on décrit la boutique et l'agent agit via des outils typés : identité, thème, sections de la page d'accueil, produits, codes promo, informations légales.
2. **Crédits transparents** : coût affiché par action, estimation avant l'envoi, journal, solde.
3. **Vitrine publique** (`/s/[slug]`) : accueil, fiches produits, panier, commande (paiement simulé en mode test), pages légales générées, bannière cookies.
4. **Export** : JSON complet et CSV au format Shopify.
5. **Mode démo hors-ligne** : sans `ANTHROPIC_API_KEY`, un agent à règles simule l'IA pour développer et tester gratuitement.

Hors périmètre du prototype (voir § 7) : vrais comptes utilisateurs, Stripe Connect, envoi d'e-mails, gestion fine des stocks et des transporteurs, multi-langue.

---

## 4. Architecture

```
Next.js 16 (App Router, TypeScript, Tailwind)
├── src/app/                  pages et routes API
│   ├── page.tsx              site vitrine de la plateforme
│   ├── dashboard/            espace marchand (conversation, produits, crédits, export)
│   ├── s/[slug]/             boutique publique d'un marchand
│   └── api/                  agent, export, commandes
├── src/lib/
│   ├── db.ts                 SQLite (node:sqlite), schéma et requêtes
│   ├── agent/                boucle IA (API Claude) + outils + agent démo
│   ├── credits.ts            grille de prix, débit, report mensuel
│   ├── guardrails/brands.ts  détection des marques protégées
│   ├── legal.ts              génération des mentions légales, CGV et confidentialité
│   └── export.ts             export JSON et CSV Shopify
└── src/proxy.ts              domaine personnel → boutique
```

**IA** : API Claude (modèle `claude-opus-5-5`), boucle d'outils gérée par l'application. Ce choix permet de débiter chaque action au crédit près et de bloquer une action *avant* de l'exécuter (garde-fou marques). Le prompt système est figé et mis en cache, ce qui coûte environ 10 fois moins cher en entrée. Le repli automatique en cas de refus (`fallbacks: "default"`) est activé.

**Base de données** : SQLite intégré à Node pour le prototype (aucune dépendance). En production, passer à PostgreSQL : le schéma est en SQL standard dans `db.ts`.

**Paiements (étape suivante)** : Stripe Connect en mode *Standard*. Le compte Stripe appartient au marchand et la plateforme ne touche pas aux fonds.

---

## 5. Grille de crédits (source de vérité : `src/lib/credits.ts`)

| Action | Crédits |
|---|---|
| Message envoyé à l'IA | 1 |
| Changer l'identité de la boutique (nom, slogan, description) | 1 |
| Changer le thème (couleurs, police) | 1 |
| Réécrire les sections de la page d'accueil | 3 |
| Ajouter un produit (fiche rédigée et optimisée pour le référencement) | 2 |
| Modifier un produit | 1 |
| Supprimer un produit | 0 |
| Créer un code promo | 1 |
| Renseigner les informations légales | 0 (la conformité n'est jamais payante) |
| Consulter la boutique ou la liste des produits | 0 |

Règles :
- l'estimation maximale d'un message est affichée avant l'envoi ;
- si le solde ne suffit pas, l'action est refusée **avant** d'être exécutée, rien n'est débité et le marchand est prévenu ;
- les crédits mensuels non utilisés sont reportés, dans la limite de 2 × l'allocation ;
- les recharges n'expirent pas.

**Économie à valider** : avec Claude Opus 5.5 (4 $ / 20 $ par million de jetons) et le cache du prompt système, une action coûte environ 0,01 à 0,05 € de jetons. Il faut mesurer le coût réel par action sur 100 conversations types avant de fixer le prix de vente d'un crédit.

---

## 6. Offres (proposition, en € TTC)

| Formule | Prix mensuel | Prix annuel | Crédits/mois | Inclus |
|---|---|---|---|---|
| Essai | 0 € pendant 14 jours | — | 50 | Tout, sans carte bancaire |
| Créateur | 19 € | 190 € (2 mois offerts) | 200 | 1 boutique, domaine perso, 0 % de commission |
| Pro | 49 € | 490 € | 800 | 3 boutiques, statistiques avancées, support prioritaire |

Recharge : 100 crédits pour 5 €, sans date d'expiration.

---

## 7. Feuille de route après le prototype

1. Authentification (Auth.js, e-mail sans mot de passe et Google), plusieurs boutiques par compte.
2. Stripe Connect Standard, avec webhooks de commande.
3. E-mails transactionnels (confirmation de commande, expédition, panier abandonné).
4. Stockage des images (S3 compatible, hébergé dans l'UE) et génération d'images produits.
5. PostgreSQL, sauvegardes, page de statut, journal d'audit des actions de l'IA.
6. Gestion de la TVA (OSS UE), des transporteurs (Colissimo, Mondial Relay) et des stocks.
7. Import depuis Shopify et WooCommerce (l'inverse de l'export, pour faciliter la migration).

---

## 8. Juridique et charte marketing

**Société** : SAS française, avec mentions légales complètes (raison sociale, capital, RCS, adresse réelle, directeur de la publication, hébergeur).

**CGV de la plateforme** :
- droit français ;
- rétractation de 14 jours pour les consommateurs ;
- médiateur de la consommation désigné ;
- remboursement au prorata en cas de résiliation par la plateforme.

**Données personnelles** :
- registre des traitements ;
- liste exhaustive des sous-traitants ;
- transferts hors UE encadrés par les clauses contractuelles types ou le Data Privacy Framework ;
- hébergement dans l'UE ;
- contact pour l'exercice des droits ;
- droit de saisir la CNIL.

**Pour les marchands** : génération automatique de leurs mentions légales, CGV et politique de confidentialité à partir de leurs informations. La publication est bloquée tant qu'elles manquent.

**Charte marketing** :
- pas de démo construite sur une marque tierce ;
- pas de chiffres inventés ;
- pas de dénigrement des concurrents ;
- toute vidéo montée est signalée comme telle.

Les gabarits juridiques fournis sont des **points de départ**. Ils doivent être relus par un avocat avant la mise en production.
