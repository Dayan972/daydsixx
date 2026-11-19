import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import "@fontsource-variable/cormorant-garamond";
import "@fontsource-variable/cormorant-garamond/wght-italic.css";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/dm-sans";
import "./storefront.css";
import { BRAND_NAME } from "@/lib/brand";
import { LEGAL_PAGES } from "@/lib/legal";
import { CartLink, CookieNotice, RevealObserver, StoreHeader } from "./client";
import { loadStore, storeBase, themeStyle } from "./shared";

export default function StoreLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <StoreShell params={params}>{children}</StoreShell>
    </Suspense>
  );
}

async function StoreShell({ children, params }: Pick<LayoutProps<"/s/[slug]">, "children" | "params">) {
  const { slug } = await params;
  await connection();
  const store = loadStore(slug);
  const base = storeBase(slug);
  const key = store.slug;
  const hasStory = store.sections.some((s) => s.type === "split" || s.type === "text" || s.type === "manifesto");

  return (
    <div className="sf flex min-h-screen flex-col" data-template={store.theme.template} style={themeStyle(store)}>
      {store.status === "draft" && (
        <div className="bg-amber-200 px-4 py-2 text-center text-xs font-medium text-amber-950">
          Aperçu : cette boutique n&apos;est pas encore publiée. Les commandes sont désactivées.
        </div>
      )}
      <StoreHeader>
        <div className="sf-container grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-4">
          <nav className="sf-nav hidden items-center gap-8 md:flex" aria-label="Navigation principale">
            <Link href={`${base}/#collection`}>Collection</Link>
            {hasStory && <Link href={`${base}/#histoire`}>La maison</Link>}
          </nav>
          <Link href={base || "/"} className="sf-logo col-start-1 md:col-start-2 md:text-center">
            {store.name}
          </Link>
          <div className="sf-nav flex justify-end">
            <CartLink store={key} base={base} />
          </div>
        </div>
      </StoreHeader>

      <div className="flex-1">{children}</div>

      <footer className="sf-surface mt-auto">
        <div className="sf-container grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="sf-logo">{store.name}</p>
            {store.tagline && <p className="sf-muted max-w-xs text-sm">{store.tagline}</p>}
          </div>
          <div className="space-y-3 text-sm">
            <p className="sf-eyebrow">Boutique</p>
            <ul className="space-y-2">
              <li><Link href={`${base}/#collection`} className="hover:underline">Collection</Link></li>
              <li><Link href={`${base}/panier`} className="hover:underline">Panier</Link></li>
            </ul>
          </div>
          <div className="space-y-3 text-sm">
            <p className="sf-eyebrow">Informations</p>
            <ul className="space-y-2">
              {LEGAL_PAGES.map((p) => (
                <li key={p.slug}>
                  <Link href={`${base}/legal/${p.slug}`} className="hover:underline">{p.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 text-sm">
            <p className="sf-eyebrow">Contact</p>
            {store.legal.email ? (
              <a href={`mailto:${store.legal.email}`} className="hover:underline">{store.legal.email}</a>
            ) : (
              <p className="sf-muted">Coordonnées à venir</p>
            )}
            <p className="sf-muted">Retours sous {store.legal.returnDays ?? 14} jours</p>
          </div>
        </div>
        <div className="sf-container sf-muted flex flex-wrap justify-between gap-2 border-t sf-border py-6 text-xs">
          <span>© {new Date().getFullYear()} {store.legal.companyName || store.name}</span>
          <span>Propulsé par {BRAND_NAME} · sans traceur publicitaire</span>
        </div>
      </footer>
      <CookieNotice store={key} base={base} />
      <RevealObserver />
    </div>
  );
}
