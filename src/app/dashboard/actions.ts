"use server";

import { revalidatePath } from "next/cache";
import {
  getOrCreateDemoStore,
  listProducts,
  setCustomDomain,
  setPerMessageCap,
  setStoreStatus,
  startNewConversation,
  updateStoreLegal,
} from "@/lib/db";
import { LEGAL_FIELD_LABELS, LegalInfoSchema, type LegalInfo } from "@/lib/legal";
import { isReadyToPublish } from "@/lib/publish";

export interface FormState {
  ok: boolean;
  message: string;
}

const done = (message: string): FormState => {
  revalidatePath("/dashboard");
  return { ok: true, message };
};

export async function saveLegalInfo(_prev: FormState, form: FormData): Promise<FormState> {
  const store = getOrCreateDemoStore();
  const raw = Object.fromEntries(
    (Object.keys(LEGAL_FIELD_LABELS) as (keyof LegalInfo)[]).map((k) => [
      k,
      String(form.get(k) ?? "").trim(),
    ]),
  );
  const reseller = form.get("authenticReseller") === "on";
  // On enregistre même un formulaire incomplet (brouillon), mais on signale les erreurs.
  updateStoreLegal(store.id, raw as Partial<LegalInfo>, reseller);
  const result = LegalInfoSchema.safeParse(raw);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((i) => LEGAL_FIELD_LABELS[i.path[0] as keyof LegalInfo]))];
    revalidatePath("/dashboard");
    return { ok: false, message: `Brouillon enregistré. À corriger ou compléter : ${fields.join(", ")}.` };
  }
  return done("Informations légales enregistrées. Vos pages légales sont à jour.");
}

/** La publication est refusée côté serveur tant que la liste de contrôle n'est pas verte. */
export async function publishStore(): Promise<void> {
  const store = getOrCreateDemoStore();
  if (isReadyToPublish(store, listProducts(store.id))) setStoreStatus(store.id, "published");
  revalidatePath("/dashboard");
}

export async function unpublishStore(): Promise<void> {
  setStoreStatus(getOrCreateDemoStore().id, "draft");
  revalidatePath("/dashboard");
}

export async function updateMessageCap(_prev: FormState, form: FormData): Promise<FormState> {
  const cap = Number(form.get("cap"));
  if (!Number.isInteger(cap) || cap < 1 || cap > 100) {
    return { ok: false, message: "Choisissez un plafond entre 1 et 100 crédits." };
  }
  setPerMessageCap(getOrCreateDemoStore().id, cap);
  return done(`Plafond fixé à ${cap} crédits par message.`);
}

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export async function updateDomain(_prev: FormState, form: FormData): Promise<FormState> {
  const domain = String(form.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (domain && !DOMAIN_RE.test(domain)) return { ok: false, message: "Nom de domaine invalide." };
  try {
    setCustomDomain(getOrCreateDemoStore().id, domain || null);
  } catch {
    return { ok: false, message: "Ce domaine est déjà utilisé par une autre boutique." };
  }
  return done(domain ? `Domaine ${domain} enregistré.` : "Domaine personnel retiré.");
}

export async function newConversation(): Promise<void> {
  startNewConversation(getOrCreateDemoStore().id);
  revalidatePath("/dashboard");
}
