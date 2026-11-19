import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND_NAME } from "@/lib/brand";
import {
  getOrCreateConversation,
  getOrCreateDemoStore,
  listChatLog,
  listCoupons,
  listLedger,
  listOrders,
  listProducts,
  pageviewsLastDays,
  type Store,
} from "@/lib/db";
import { priceList } from "@/lib/credits";
import { LEGAL_FIELD_LABELS, PLATFORM_HOST_DEFAULTS, type LegalInfo } from "@/lib/legal";
import { publishReadiness } from "@/lib/publish";
import { formatEuros } from "@/lib/store-types";
import { agentMode } from "@/lib/agent/run";
import {
  newConversation,
  publishStore,
  saveLegalInfo,
  unpublishStore,
  updateDomain,
  updateMessageCap,
} from "./actions";
import { ChatPanel, StatefulForm } from "./components";

export const metadata: Metadata = { title: "Mon espace", robots: { index: false } };

const TABS = [
  { id: "apercu", label: "Aperçu" },
  { id: "produits", label: "Produits" },
  { id: "commandes", label: "Commandes" },
  { id: "credits", label: "Crédits" },
  { id: "legal", label: "Légal" },
  { id: "domaine", label: "Domaine & export" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Chargement de votre espace…</p>}>
      <Dashboard searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const sp = await searchParams;
  await connection(); // lectures SQLite synchrones : toujours à la requête
  const tab: TabId = TABS.some((t) => t.id === sp.onglet) ? (sp.onglet as TabId) : "apercu";

  const store = getOrCreateDemoStore();
  const products = listProducts(store.id);
  const conversation = getOrCreateConversation(store.id);
  const readiness = publishReadiness(store, products);
  const ready = readiness.every((r) => r.ok);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-bold">{BRAND_NAME}</Link>
            <span className="text-muted">/</span>
            <span className="font-medium">{store.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                store.status === "published"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              }`}
            >
              {store.status === "published" ? "En ligne" : "Brouillon"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/s/${store.slug}`}
              target="_blank"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            >
              {store.status === "published" ? "Voir la boutique" : "Aperçu"}
            </Link>
            {store.status === "published" ? (
              <form action={unpublishStore}>
                <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">Dépublier</button>
              </form>
            ) : (
              <form action={publishStore}>
                <button
                  disabled={!ready}
                  title={ready ? undefined : "Complétez la liste de contrôle (onglet Aperçu)"}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-40"
                >
                  Publier la boutique
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section aria-label="Conversation" className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <ChatPanel
            key={conversation.id}
            initialLog={listChatLog(conversation.id)}
            balance={store.creditsBalance}
            cap={store.perMessageCap}
            mode={agentMode()}
          />
          <form action={newConversation} className="mt-2 text-right">
            <button className="text-xs text-muted underline">Nouvelle conversation</button>
          </form>
        </section>

        <section aria-label="Gestion de la boutique" className="min-w-0">
          <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Onglets">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard?onglet=${t.id}`}
                aria-current={t.id === tab ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  t.id === tab ? "border-accent font-medium" : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="py-6">
            {tab === "apercu" && <Overview store={store} readiness={readiness} />}
            {tab === "produits" && <Products store={store} />}
            {tab === "commandes" && <Orders store={store} />}
            {tab === "credits" && <Credits store={store} />}
            {tab === "legal" && <Legal store={store} />}
            {tab === "domaine" && <DomainAndExport store={store} />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Overview({ store, readiness }: { store: Store; readiness: ReturnType<typeof publishReadiness> }) {
  const orders = listOrders(store.id);
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Visites (7 jours)" value={String(pageviewsLastDays(store.id))} hint="Mesurées sans cookie" />
        <Stat label="Commandes" value={String(orders.length)} hint="Paiement en mode test" />
        <Stat label="Chiffre d'affaires" value={formatEuros(revenue)} />
      </div>
      <div>
        <h2 className="text-lg font-semibold">Avant de publier</h2>
        <p className="text-sm text-muted">La boutique ne peut être mise en ligne que lorsque tous les points sont validés.</p>
        <ul className="mt-4 space-y-2">
          {readiness.map((r) => (
            <li key={r.label} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className={r.ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
                {r.ok ? "✓" : "•"}
              </span>{" "}
              {r.label}
              {!r.ok && r.fix && <p className="mt-1 text-xs text-muted">{r.fix}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Products({ store }: { store: Store }) {
  const products = listProducts(store.id);
  const coupons = listCoupons(store.id);
  if (products.length === 0) {
    return <p className="text-sm text-muted">Aucun produit. Demandez à l&apos;assistant d&apos;en ajouter.</p>;
  }
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface">
            <tr>
              <th className="px-3 py-2 font-medium">Produit</th>
              <th className="px-3 py-2 font-medium">Prix TTC</th>
              <th className="px-3 py-2 font-medium">Mots-clés</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <Link href={`/s/${store.slug}/produits/${p.handle}`} target="_blank" className="font-medium underline">
                    {p.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatEuros(p.priceCents)}</td>
                <td className="px-3 py-2 text-xs text-muted">{p.tags.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {coupons.length > 0 && (
        <p className="text-sm">
          Codes promo : {coupons.map((c) => `${c.code} (−${c.percentOff} %)`).join(", ")}
        </p>
      )}
    </div>
  );
}

function Orders({ store }: { store: Store }) {
  const orders = listOrders(store.id);
  if (orders.length === 0) return <p className="text-sm text-muted">Aucune commande pour l&apos;instant.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface">
          <tr>
            <th className="px-3 py-2 font-medium">N°</th>
            <th className="px-3 py-2 font-medium">Client</th>
            <th className="px-3 py-2 font-medium">Articles</th>
            <th className="px-3 py-2 font-medium">Total</th>
            <th className="px-3 py-2 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border align-top">
              <td className="px-3 py-2">#{o.number}</td>
              <td className="px-3 py-2">{o.email}</td>
              <td className="px-3 py-2 text-xs">{o.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatEuros(o.totalCents)}
                {o.couponCode && <span className="block text-xs text-muted">{o.couponCode}</span>}
              </td>
              <td className="px-3 py-2 text-xs">{o.status === "test_paid" ? "Payée (test)" : o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Credits({ store }: { store: Store }) {
  const ledger = listLedger(store.id);
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Solde" value={`${store.creditsBalance} crédits`} />
        <Stat label="Allocation mensuelle" value={`${store.monthlyAllowance}`} hint="Non utilisés : reportés (jusqu'à 2×)" />
        <Stat label="Plafond par message" value={`${store.perMessageCap}`} hint="L'IA ne peut pas le dépasser" />
      </div>

      <StatefulForm action={updateMessageCap} submitLabel="Modifier le plafond">
        <label className="block text-sm">
          <span className="font-medium">Plafond de crédits par message</span>
          <input
            name="cap"
            type="number"
            min={1}
            max={100}
            defaultValue={store.perMessageCap}
            className="mt-1 block w-32 rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
      </StatefulForm>

      <div>
        <h2 className="text-lg font-semibold">Journal des crédits</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Opération</th>
                <th className="px-3 py-2 text-right font-medium">Crédits</th>
                <th className="px-3 py-2 text-right font-medium">Solde</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{l.createdAt.replace("T", " ").slice(0, 16)}</td>
                  <td className="px-3 py-2">{l.reason}</td>
                  <td className="px-3 py-2 text-right font-mono">{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                  <td className="px-3 py-2 text-right font-mono">{l.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-medium">Grille de prix complète</summary>
        <ul className="mt-3 space-y-1 text-sm">
          {priceList().map((p) => (
            <li key={p.action} className="flex justify-between gap-4">
              <span>{p.action}</span>
              <span className="font-mono">{p.cost}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const LEGAL_FIELD_TYPES: Partial<Record<keyof LegalInfo, string>> = {
  email: "email",
  mediatorUrl: "url",
  returnDays: "number",
};
const LONG_FIELDS: (keyof LegalInfo)[] = ["address", "hostAddress", "shippingInfo"];

function Legal({ store }: { store: Store }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Ces informations alimentent vos mentions légales, CGV et politique de confidentialité. L&apos;IA n&apos;y a
        pas accès et ne les invente jamais. Saisir ces informations est gratuit.
      </p>
      <StatefulForm action={saveLegalInfo} submitLabel="Enregistrer">
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(LEGAL_FIELD_LABELS) as (keyof LegalInfo)[]).map((field) => {
            const common = {
              name: field,
              defaultValue: String(store.legal[field] ?? (field === "returnDays" ? 14 : "")),
              placeholder:
                field === "hostName"
                  ? PLATFORM_HOST_DEFAULTS.hostName
                  : field === "hostAddress"
                    ? PLATFORM_HOST_DEFAULTS.hostAddress
                    : undefined,
              className: "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2",
            };
            return (
              <label key={field} className={`block text-sm ${LONG_FIELDS.includes(field) ? "sm:col-span-2" : ""}`}>
                <span className="font-medium">{LEGAL_FIELD_LABELS[field]}</span>
                {LONG_FIELDS.includes(field) ? (
                  <textarea rows={2} {...common} />
                ) : (
                  <input type={LEGAL_FIELD_TYPES[field] ?? "text"} {...common} />
                )}
              </label>
            );
          })}
        </div>
        <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
          <input type="checkbox" name="authenticReseller" defaultChecked={store.authenticResellerDeclared} className="mt-1" />
          <span>
            Je revends des produits de marques tierces <strong>authentiques</strong>, en tant que revendeur autorisé, et je
            peux en justifier la provenance. (Sans cette déclaration, l&apos;IA refuse les fiches qui citent une marque.)
          </span>
        </label>
      </StatefulForm>
      <p className="text-sm">
        Pages générées :{" "}
        {["mentions-legales", "cgv", "confidentialite", "cookies"].map((p, i) => (
          <span key={p}>
            {i > 0 && " · "}
            <Link href={`/s/${store.slug}/legal/${p}`} target="_blank" className="underline">{p}</Link>
          </span>
        ))}
      </p>
    </div>
  );
}

function DomainAndExport({ store }: { store: Store }) {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Votre nom de domaine</h2>
        <p className="text-sm text-muted">
          Votre boutique doit vivre sur votre domaine, pas sur le nôtre : c&apos;est vous qui accumulez le référencement.
          Adresse d&apos;aperçu actuelle : <code>/s/{store.slug}</code>
        </p>
        <StatefulForm action={updateDomain} submitLabel="Enregistrer le domaine">
          <label className="block text-sm">
            <span className="font-medium">Domaine (ex. maboutique.fr)</span>
            <input
              name="domain"
              defaultValue={store.customDomain ?? ""}
              placeholder="maboutique.fr"
              className="mt-1 block w-full max-w-sm rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
        </StatefulForm>
        <p className="text-xs text-muted">
          Puis, chez votre registraire, faites pointer le domaine vers la plateforme (enregistrement CNAME ou A, indiqué
          lors du déploiement). Le certificat HTTPS est émis automatiquement.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Exporter vos données</h2>
        <p className="text-sm text-muted">Gratuit, illimité, sans demande à faire. Vos données vous appartiennent.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`/api/stores/${store.id}/export?format=json`} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">
            Tout exporter (JSON)
          </a>
          <a href={`/api/stores/${store.id}/export?format=shopify-csv`} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">
            Produits au format Shopify (CSV)
          </a>
        </div>
      </div>
    </div>
  );
}
