import { connection } from "next/server";
import { getStoreBySlugOrDomain, listProducts } from "@/lib/db";
import { LEGAL_PAGES } from "@/lib/legal";

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(request: Request, ctx: RouteContext<"/s/[slug]/sitemap.xml">) {
  await connection(); // contenu de la base : toujours calculé à la requête
  const { slug } = await ctx.params;
  const store = getStoreBySlugOrDomain(decodeURIComponent(slug));
  if (!store || store.status !== "published") return new Response("Not found", { status: 404 });

  const origin = store.customDomain ? `https://${store.customDomain}` : `${new URL(request.url).origin}/s/${store.slug}`;
  const paths = [
    "/",
    ...listProducts(store.id).map((p) => `/produits/${p.handle}`),
    ...LEGAL_PAGES.map((p) => `/legal/${p.slug}`),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    paths.map((p) => `  <url><loc>${xmlEscape(origin + (p === "/" ? "/" : p))}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
