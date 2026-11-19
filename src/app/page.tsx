import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { PLANS, TOP_UP, priceList } from "@/lib/credits";

const PROMISES = [
  {
    title: "Des crédits que l'on comprend",
    text: "Chaque action a un prix fixe, publié ci-dessous. Le coût maximum s'affiche avant chaque message et un journal détaille chaque débit.",
  },
  {
    title: "Votre boutique vous appartient",
    text: "Votre propre nom de domaine. Export complet en un clic (JSON + CSV compatible Shopify), à tout moment, même pendant un préavis.",
  },
  {
    title: "Conforme au droit européen",
    text: "Mentions légales, CGV avec droit de rétractation et politique de confidentialité générées pour vous. Pas de traceur publicitaire, mesure d'audience sans cookie.",
  },
  {
    title: "Une IA qui ne copie pas",
    text: "Elle crée une identité originale et refuse de reprendre une marque existante ou de vendre des « dupes » : votre boutique ne risque pas d'être fermée pour contrefaçon.",
  },
  {
    title: "Pas de faux avis, pas de faux labels",
    text: "L'IA n'invente ni témoignages, ni chiffres, ni certifications. Ce qui est écrit sur votre boutique est vrai.",
  },
  {
    title: "Des engagements écrits",
    text: "Droit français, préavis de 30 jours, remboursement au prorata, disponibilité de 99,9 % avec avoir automatique en cas de manquement.",
  },
];

const FAQ = [
  {
    q: "Que se passe-t-il si je n'ai plus de crédits ?",
    a: "L'IA s'arrête avant d'agir, rien n'est débité, et vous êtes prévenu. Votre boutique reste en ligne : les crédits ne servent qu'à la modifier avec l'IA, jamais à vendre.",
  },
  {
    q: "Les crédits non utilisés sont-ils perdus ?",
    a: "Non. Ils sont reportés au mois suivant (jusqu'à deux fois votre allocation mensuelle). Les recharges achetées n'expirent jamais.",
  },
  {
    q: "Prenez-vous une commission sur mes ventes ?",
    a: "Non, 0 %. Vous connectez votre propre compte de paiement : l'argent va directement chez vous. Seuls les frais de votre prestataire de paiement s'appliquent.",
  },
  {
    q: "Et si je veux partir ?",
    a: "Exportez tout (produits, commandes, contenus) en un clic. Le fichier CSV s'importe directement dans Shopify ou WooCommerce.",
  },
  {
    q: "Qui êtes-vous ?",
    a: "Les informations complètes sur la société éditrice (raison sociale, siège, immatriculation, dirigeant) figurent dans nos mentions légales.",
  },
];

export default function Home() {
  const prices = priceList();
  return (
    <div className="flex flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <span className="text-lg font-bold">{BRAND_NAME}</span>
          <div className="flex items-center gap-4 text-sm">
            <a href="#engagements" className="hidden sm:inline text-muted hover:text-foreground">Engagements</a>
            <a href="#tarifs" className="hidden sm:inline text-muted hover:text-foreground">Tarifs</a>
            <a href="#faq" className="hidden sm:inline text-muted hover:text-foreground">FAQ</a>
            <Link href="/dashboard" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-foreground">
              Ouvrir mon espace
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Décrivez votre boutique.
            <br />
            L&apos;IA la construit. <span className="text-accent">Elle reste à vous.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Créez une boutique en ligne en conversant, sans coder. Prix en euros, crédits expliqués,
            vos données exportables à tout moment, conformité européenne incluse.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/dashboard" className="rounded-md bg-accent px-6 py-3 text-base font-semibold text-accent-foreground">
              Essayer gratuitement pendant 14 jours
            </Link>
            <p className="text-sm text-muted">Sans carte bancaire · 50 crédits offerts · Résiliation en un clic</p>
          </div>
        </section>

        <section id="engagements" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-bold">Nos engagements</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {PROMISES.map((p) => (
                <div key={p.title} className="rounded-lg border border-border bg-background p-5">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="tarifs" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Tarifs</h2>
          <p className="mt-2 text-muted">Prix toutes taxes comprises. Formule annuelle : deux mois offerts.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-3 text-3xl font-bold">
                  {plan.monthlyPriceEur} €<span className="text-base font-normal text-muted"> / mois TTC</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {plan.yearlyPriceEur ? `ou ${plan.yearlyPriceEur} € / an TTC` : "pendant 14 jours"}
                </p>
                <p className="mt-4 font-medium">{plan.monthlyCredits} crédits par mois, reportables</p>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {plan.highlights.map((h) => (
                    <li key={h}>✓ {h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Recharge : {TOP_UP.credits} crédits pour {TOP_UP.priceEur} € TTC, sans date d&apos;expiration,
            remboursable 14 jours si elle n&apos;a pas été utilisée.
          </p>

          <h3 className="mt-12 text-xl font-semibold">Ce que coûte chaque action</h3>
          <p className="mt-1 text-sm text-muted">
            La grille complète, sans astérisque. Les actions à 0 crédit sont gratuites et le resteront.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 text-right font-medium">Crédits</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.action} className="border-t border-border">
                    <td className="px-4 py-2">{p.action}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted">
            Exemple : créer une boutique complète (identité, thème, page d&apos;accueil, 3 produits) coûte environ 12 crédits.
          </p>
        </section>

        <section id="faq" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-2xl font-bold">Questions fréquentes</h2>
            <div className="mt-6 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="rounded-lg border border-border bg-background p-4">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted">
          <span>© {BRAND_NAME}. Prototype : informations légales de la société à compléter avant lancement.</span>
          <span>Aucun traceur publicitaire sur ce site.</span>
        </div>
      </footer>
    </div>
  );
}
