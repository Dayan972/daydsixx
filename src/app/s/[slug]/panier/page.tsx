import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CartView } from "../client";
import { loadStore, storeBase } from "../shared";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default function CartPage({ params }: PageProps<"/s/[slug]/panier">) {
  return (
    <main className="sf-container py-16">
      <h1 className="sf-display sf-h2">Votre panier</h1>
      <div className="mt-12">
        <Suspense>
          <Cart params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Cart({ params }: Pick<PageProps<"/s/[slug]/panier">, "params">) {
  const { slug } = await params;
  await connection();
  const store = loadStore(slug);
  return <CartView store={store.slug} base={storeBase(slug)} ordersOpen={store.status === "published"} />;
}
