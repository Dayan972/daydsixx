import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND_NAME } from "@/lib/brand";
import { LEGAL_PAGES } from "@/lib/legal";
import { CartLink, CookieNotice } from "./client";
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

  return (
    <div className="storefront flex min-h-screen flex-col" data-style={store.theme.style} style={themeStyle(store)}>
      {store.status === "draft" && (
        <div className="bg-amber-200 px-4 py-2 text-center text-sm text-amber-950">
          Aperçu : cette boutique n&apos;est pas encore publiée. Les commandes sont désactivées.
        </div>
      )}
      <header className="store-border border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href={base || "/"} className="text-xl font-semibold">{store.name}</Link>
          <CartLink store={key} base={base} />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="store-border border-t">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Informations légales">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.slug} href={`${base}/legal/${p.slug}`} className="store-muted hover:underline">
                {p.title}
              </Link>
            ))}
          </nav>
          <span className="store-muted text-xs">Boutique propulsée par {BRAND_NAME}</span>
        </div>
      </footer>
      <CookieNotice store={key} base={base} />
    </div>
  );
}
