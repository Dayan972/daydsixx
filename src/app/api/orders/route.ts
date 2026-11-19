import { z } from "zod";
import { getStoreBySlugOrDomain } from "@/lib/db";
import { CheckoutSchema, placeOrder } from "@/lib/checkout";

const Body = CheckoutSchema.extend({ store: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const store = getStoreBySlugOrDomain(parsed.data.store);
  if (!store) return Response.json({ error: "Boutique introuvable" }, { status: 404 });

  const result = placeOrder(store, parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  return Response.json({ number: result.order.number, totalCents: result.order.totalCents });
}
