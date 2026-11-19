import type { NextRequest } from "next/server";
import { getStore, listCoupons, listOrders, listProducts } from "@/lib/db";
import { buildJsonExport, buildShopifyCsv } from "@/lib/export";

/**
 * Export gratuit et illimité. `?format=json` (tout) ou `?format=shopify-csv` (produits).
 * À protéger par l'authentification dès qu'elle existera.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/stores/[id]/export">) {
  const { id } = await ctx.params;
  const store = getStore(id);
  if (!store) return Response.json({ error: "Boutique introuvable" }, { status: 404 });

  const products = listProducts(id);
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const date = new Date().toISOString().slice(0, 10);

  if (format === "shopify-csv") {
    return new Response(buildShopifyCsv(store, products), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${store.slug}-produits-${date}.csv"`,
      },
    });
  }

  const data = buildJsonExport(store, products, listCoupons(id), listOrders(id));
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${store.slug}-export-${date}.json"`,
    },
  });
}
