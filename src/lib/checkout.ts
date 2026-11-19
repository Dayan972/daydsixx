import { z } from "zod";
import { createOrder, findActiveCoupon, getProduct, type Order, type Store } from "./db";

export const CheckoutSchema = z.object({
  email: z.email("Adresse e-mail invalide"),
  items: z
    .array(z.object({ handle: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
    .min(1, "Le panier est vide")
    .max(50),
  couponCode: z.string().trim().max(20).optional(),
  acceptTerms: z.literal(true, "Vous devez accepter les conditions générales de vente"),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export type CheckoutResult = { ok: true; order: Order } | { ok: false; error: string };

/**
 * Les prix sont toujours recalculés côté serveur à partir du catalogue : on ne
 * fait jamais confiance au prix envoyé par le navigateur.
 * Paiement simulé (mode test) en attendant Stripe Connect.
 */
export function placeOrder(store: Store, input: CheckoutInput): CheckoutResult {
  if (store.status !== "published") {
    return { ok: false, error: "Cette boutique n'est pas encore publiée : les commandes sont désactivées." };
  }

  const items = [];
  for (const line of input.items) {
    const product = getProduct(store.id, line.handle);
    if (!product) return { ok: false, error: `Produit introuvable : ${line.handle}` };
    items.push({
      handle: product.handle,
      title: product.title,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
    });
  }
  const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

  let discountCents = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const coupon = findActiveCoupon(store.id, input.couponCode);
    if (!coupon) return { ok: false, error: "Code promo invalide." };
    discountCents = Math.round((subtotalCents * coupon.percentOff) / 100);
    couponCode = coupon.code;
  }

  const order = createOrder(store.id, {
    email: input.email,
    items,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    couponCode,
  });
  return { ok: true, order };
}
