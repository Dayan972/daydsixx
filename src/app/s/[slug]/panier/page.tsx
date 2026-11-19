import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CartView } from "../client";
import { loadStore, storeBase } from "../shared";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default function CartPage({ params }: PageProps<"/s/[slug]/panier">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl">Votre panier</h1>
      <div className="mt-8">
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
