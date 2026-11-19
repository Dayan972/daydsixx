"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";

/**
 * Panier stocké dans le navigateur (localStorage) : strictement nécessaire au
 * service demandé, donc exempté de consentement. Aucun cookie n'est déposé.
 */

interface CartLine {
  handle: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
}

const cartKey = (store: string) => `vitrine:cart:${store}`;
const EVENT = "vitrine-cart";

function readCart(store: string): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(cartKey(store)) ?? "[]");
  } catch {
    return [];
  }
}

function writeCart(store: string, lines: CartLine[]) {
  try {
    localStorage.setItem(cartKey(store), JSON.stringify(lines));
  } catch {
    /* navigation privée : le panier reste en mémoire pour cette page */
  }
  window.dispatchEvent(new Event(EVENT));
}

function useCart(store: string): CartLine[] {
  const raw = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(cartKey(store)) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function CartLink({ store, base }: { store: string; base: string }) {
  const count = useCart(store).reduce((n, l) => n + l.quantity, 0);
  return (
    <Link href={`${base}/panier`} className="sf-link text-sm font-medium">
      Panier{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}

export function AddToCart({
  store,
  product,
  disabled,
}: {
  store: string;
  product: Omit<CartLine, "quantity">;
  disabled?: boolean;
}) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const lines = readCart(store);
        const line = lines.find((l) => l.handle === product.handle);
        if (line) line.quantity = Math.min(99, line.quantity + 1);
        else lines.push({ ...product, quantity: 1 });
        writeCart(store, lines);
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className="sf-btn px-6 py-3 text-sm font-semibold disabled:opacity-40"
    >
      {disabled ? "Commandes bientôt ouvertes" : added ? "Ajouté ✓" : "Ajouter au panier"}
    </button>
  );
}

export function CartView({ store, base, ordersOpen }: { store: string; base: string; ordersOpen: boolean }) {
  const lines = useCart(store);
  const [email, setEmail] = useState("");
  const [coupon, setCoupon] = useState("");
  const [accept, setAccept] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);

  const setQty = (handle: string, quantity: number) =>
    writeCart(
      store,
      lines
        .map((l) => (l.handle === handle ? { ...l, quantity: Math.max(0, Math.min(99, quantity)) } : l))
        .filter((l) => l.quantity > 0),
    );

  if (status?.ok) {
    return (
      <div className="sf-surface sf-card space-y-2 p-6">
        <p className="text-lg font-semibold">Merci pour votre commande !</p>
        <p>{status.message}</p>
        <Link href={base} className="sf-link underline">Retour à la boutique</Link>
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <p>
        Votre panier est vide. <Link href={base} className="sf-link underline">Voir les produits</Link>
      </p>
    );
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          email,
          couponCode: coupon || undefined,
          acceptTerms: accept,
          items: lines.map((l) => ({ handle: l.handle, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, message: data.error ?? "Commande impossible." });
      } else {
        writeCart(store, []);
        setStatus({
          ok: true,
          message: `Commande n° ${data.number} enregistrée pour ${euros(data.totalCents)} (paiement simulé : boutique en mode test).`,
        });
      }
    } catch {
      setStatus({ ok: false, message: "Connexion impossible. Réessayez." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.handle} className="sf-border flex items-center justify-between gap-4 border-b pb-3">
            <div>
              <p className="font-medium">{l.title}</p>
              <p className="sf-muted text-sm">{euros(l.unitPriceCents)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Retirer un ${l.title}`} onClick={() => setQty(l.handle, l.quantity - 1)} className="sf-border h-8 w-8 border">−</button>
              <span className="w-6 text-center">{l.quantity}</span>
              <button type="button" aria-label={`Ajouter un ${l.title}`} onClick={() => setQty(l.handle, l.quantity + 1)} className="sf-border h-8 w-8 border">+</button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={checkout} className="sf-surface sf-card space-y-4 p-5">
        <p className="flex justify-between font-semibold">
          <span>Sous-total</span>
          <span>{euros(subtotal)}</span>
        </p>
        <p className="sf-muted text-xs">Prix TTC. Code promo et frais de livraison calculés à la validation.</p>
        <label className="block text-sm">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="sf-input mt-1" />
        </label>
        <label className="block text-sm">
          Code promo
          <input value={coupon} onChange={(e) => setCoupon(e.target.value)} className="sf-input mt-1" />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" required />
          <span>
            J&apos;accepte les <Link href={`${base}/legal/cgv`} className="sf-link underline">conditions générales de vente</Link>.
          </span>
        </label>
        {status && !status.ok && <p role="alert" className="text-sm text-red-600">{status.message}</p>}
        <button type="submit" disabled={pending || !ordersOpen} className="sf-btn w-full px-4 py-3 text-sm font-semibold disabled:opacity-40">
          {ordersOpen ? (pending ? "Validation…" : "Commander avec obligation de paiement") : "Commandes bientôt ouvertes"}
        </button>
      </form>
    </div>
  );
}

/** Bandeau d'information : rien à accepter, puisqu'aucun traceur n'est déposé. */
export function CookieNotice({ store, base }: { store: string; base: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage local après le montage
      setVisible(localStorage.getItem(`vitrine:cookies:${store}`) !== "vu");
    } catch {
      setVisible(true);
    }
  }, [store]);
  if (!visible) return null;
  return (
    <div role="region" aria-label="Cookies" className="sf-surface sf-border fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          Ce site ne dépose aucun cookie publicitaire ni traceur. Seul votre panier est conservé dans votre navigateur.{" "}
          <Link href={`${base}/legal/cookies`} className="sf-link underline">En savoir plus</Link>
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(`vitrine:cookies:${store}`, "vu");
            } catch {}
            setVisible(false);
          }}
          className="sf-btn px-4 py-2 text-sm"
        >
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}

/**
 * Apparitions au défilement : observe les éléments [data-reveal] de la boutique.
 * Sans JavaScript (ou avec « réduire les animations »), tout reste visible.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sf");
    if (!root) return;
    root.dataset.js = "true";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const observe = () => root.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => io.observe(el));
    observe();
    // Les sections chargées en flux arrivent après le montage.
    const mo = new MutationObserver(observe);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}

/**
 * En-tête : transparent par-dessus une grande image d'ouverture, puis opaque
 * dès qu'on fait défiler la page.
 */
export function StoreHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const update = () => {
      const hero = document.querySelector("[data-hero-image]");
      const overlay = !!hero && window.scrollY < hero.getBoundingClientRect().height - header.offsetHeight;
      header.dataset.overlay = String(overlay);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    const mo = new MutationObserver(update);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", update);
      mo.disconnect();
    };
  }, []);
  return (
    <header ref={ref} className="sf-header">
      {children}
    </header>
  );
}

export function NewsletterForm({ store, disabled }: { store: string; disabled?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  if (state === "done") return <p className="mt-8">Merci, votre inscription est enregistrée.</p>;
  return (
    <>
    <form
      className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("pending");
        const res = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store, email }),
        }).catch(() => null);
        setState(res?.ok ? "done" : "error");
      }}
    >
      <label htmlFor="nl-email" className="sr-only">Adresse e-mail</label>
      <input
        id="nl-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Votre adresse e-mail"
        className="sf-input"
        disabled={disabled}
      />
      <button type="submit" className="sf-btn shrink-0" disabled={disabled || state === "pending"}>
        S&apos;inscrire
      </button>
    </form>
    <p className="sf-muted mt-3 text-xs">Un e-mail par mois au plus. Désinscription en un clic dans chaque envoi.</p>
    {state === "error" && <p role="alert" className="mt-2 text-sm">Inscription impossible, réessayez.</p>}
    </>
  );
}
