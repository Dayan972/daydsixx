import { z } from "zod";
import { getStoreBySlugOrDomain, subscribeNewsletter } from "@/lib/db";

const Body = z.object({ store: z.string().min(1), email: z.email() });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const store = getStoreBySlugOrDomain(parsed.data.store);
  if (!store || store.status !== "published") return Response.json({ error: "Boutique introuvable." }, { status: 404 });
  subscribeNewsletter(store.id, parsed.data.email);
  return Response.json({ ok: true });
}
