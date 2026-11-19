/**
 * Crée des boutiques de démonstration (une par modèle) en passant par l'agent démo,
 * donc par les mêmes outils, garde-fous et débits que l'IA.
 *
 *   DATABASE_PATH=./data/demo.db npx tsx scripts/seed-demo.ts [dossier-de-photos]
 *
 * Si un dossier de photos est fourni, les fichiers <slug>-*.{jpg,png,webp} y sont
 * envoyés à la médiathèque et joints au message de création.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createStore, setStoreStatus, updateStoreLegal, getStore, listProducts } from "../src/lib/db";
import { runAgentTurn } from "../src/lib/agent/run";
import { saveImage } from "../src/lib/media";
import { isReadyToPublish } from "../src/lib/publish";

process.env.AGENT_MODE = "demo";

const DEMOS = [
  { key: "parfum", prompt: "Crée une boutique de parfums de niche, ambiance luxe et sombre" },
  { key: "bougies", prompt: "Crée une boutique de bougies artisanales, ambiance chaleureuse" },
  { key: "bijoux", prompt: "Crée une boutique de bijoux minimalistes" },
];

const photoDir = process.argv[2];

async function main() {
  for (const demo of DEMOS) {
    const store = createStore(`Démo ${demo.key}`);
    const refs: string[] = [];
    if (photoDir && existsSync(photoDir)) {
      const files = readdirSync(photoDir).filter((f) => f.startsWith(`${demo.key}-`)).sort();
      for (const f of files) {
        const saved = await saveImage(store.id, new Uint8Array(readFileSync(path.join(photoDir, f))), f.replace(/^[a-z]+-\d+-|\.[a-z]+$/g, "").replace(/-/g, " "));
        if (saved.ok) refs.push(`media:${saved.media.id}`);
      }
    }
    const res = await runAgentTurn(store.id, demo.prompt, refs);
    const s = getStore(store.id)!;
    updateStoreLegal(
      store.id,
      {
        companyName: `${s.name} (démonstration)`,
        legalForm: "Micro-entreprise",
        siret: "12345678900012",
        address: "12 rue de l'Exemple, 75011 Paris",
        email: `bonjour@${s.slug}.example`,
        publisherName: "Prénom Nom",
        mediatorName: "Médiateur de la consommation (à désigner)",
        mediatorUrl: "https://www.economie.gouv.fr/mediation-conso",
        returnDays: 14,
        shippingInfo: "France métropolitaine en 48 à 72 h, offerte dès 60 € d'achat.",
      },
      false,
    );
    const ready = isReadyToPublish(getStore(store.id)!, listProducts(store.id));
    if (ready) setStoreStatus(store.id, "published");
    console.log(`${s.name} → /s/${s.slug} · ${res.creditsSpent} crédits · ${refs.length} photo(s) · ${ready ? "publiée" : "brouillon"}`);
  }
}

main();
