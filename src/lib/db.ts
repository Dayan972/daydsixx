import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { LegalInfo } from "./legal";
import type { Section, Theme } from "./store-types";
import { DEFAULT_THEME } from "./store-types";

/**
 * Couche de données du prototype : SQLite intégré à Node (aucune dépendance).
 * Toutes les fonctions sont synchrones et testables hors de Next.js.
 * Dans les composants serveur, passez par `src/lib/data.ts` qui appelle
 * `connection()` pour que les lectures aient lieu à la requête et non au build.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  custom_domain TEXT UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  theme_json TEXT NOT NULL,
  sections_json TEXT NOT NULL DEFAULT '[]',
  legal_json TEXT NOT NULL DEFAULT '{}',
  authentic_reseller_declared INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  plan TEXT NOT NULL DEFAULT 'trial',
  monthly_allowance INTEGER NOT NULL DEFAULT 50,
  credits_balance INTEGER NOT NULL DEFAULT 50,
  per_message_cap INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_cents INTEGER,
  image_url TEXT,
  tags TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, handle)
);
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 90),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, code)
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  email TEXT NOT NULL,
  items_json TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_code TEXT,
  status TEXT NOT NULL DEFAULT 'test_paid',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (store_id, number)
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  api_messages_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS chat_log (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  text TEXT NOT NULL,
  actions_json TEXT NOT NULL DEFAULT '[]',
  credits_spent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Mesure d'audience sans cookie ni adresse IP : un compteur par page et par jour.
CREATE TABLE IF NOT EXISTS pageviews (
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, day, path)
);
`;

const globalForDb = globalThis as unknown as { __vitrineDb?: DatabaseSync };

function openDb(file: string): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__vitrineDb) {
    globalForDb.__vitrineDb = openDb(
      process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "vitrine.db"),
    );
  }
  return globalForDb.__vitrineDb;
}

/** Pour les tests : repart d'une base vide en mémoire. */
export function resetDbForTests(): DatabaseSync {
  globalForDb.__vitrineDb = openDb(":memory:");
  return globalForDb.__vitrineDb;
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------------------------------------------------------------- Types

export type StoreStatus = "draft" | "published";

export interface Store {
  id: string;
  slug: string;
  customDomain: string | null;
  name: string;
  tagline: string;
  description: string;
  theme: Theme;
  sections: Section[];
  legal: Partial<LegalInfo>;
  authenticResellerDeclared: boolean;
  status: StoreStatus;
  plan: string;
  monthlyAllowance: number;
  creditsBalance: number;
  perMessageCap: number;
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  handle: string;
  title: string;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  active: boolean;
}

export interface OrderItem {
  handle: string;
  title: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  number: number;
  email: string;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode: string | null;
  status: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
}

export interface ChatLogEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions: ChatAction[];
  creditsSpent: number;
  createdAt: string;
}

export interface ChatAction {
  tool: string;
  label: string;
  ok: boolean;
  cost: number;
  detail?: string;
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------- Mappers

function toStore(r: Row): Store {
  return {
    id: r.id as string,
    slug: r.slug as string,
    customDomain: (r.custom_domain as string | null) ?? null,
    name: r.name as string,
    tagline: r.tagline as string,
    description: r.description as string,
    theme: { ...DEFAULT_THEME, ...JSON.parse(r.theme_json as string) },
    sections: JSON.parse(r.sections_json as string),
    legal: JSON.parse(r.legal_json as string),
    authenticResellerDeclared: r.authentic_reseller_declared === 1,
    status: r.status as StoreStatus,
    plan: r.plan as string,
    monthlyAllowance: Number(r.monthly_allowance),
    creditsBalance: Number(r.credits_balance),
    perMessageCap: Number(r.per_message_cap),
    createdAt: r.created_at as string,
  };
}

function toProduct(r: Row): Product {
  return {
    id: r.id as string,
    storeId: r.store_id as string,
    handle: r.handle as string,
    title: r.title as string,
    description: r.description as string,
    priceCents: Number(r.price_cents),
    compareAtCents: r.compare_at_cents == null ? null : Number(r.compare_at_cents),
    imageUrl: (r.image_url as string | null) ?? null,
    tags: (r.tags as string).split(",").map((t) => t.trim()).filter(Boolean),
    seoTitle: r.seo_title as string,
    seoDescription: r.seo_description as string,
    createdAt: r.created_at as string,
  };
}

// ---------------------------------------------------------------- Stores

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "boutique"
  );
}

function uniqueStoreSlug(base: string, exceptId?: string): string {
  const db = getDb();
  let slug = slugify(base);
  for (let i = 2; ; i++) {
    const row = db.prepare("SELECT id FROM stores WHERE slug = ?").get(slug) as Row | undefined;
    if (!row || row.id === exceptId) return slug;
    slug = `${slugify(base)}-${i}`;
  }
}

export function createStore(name = "Ma boutique"): Store {
  const id = randomUUID();
  getDb()
    .prepare(
      "INSERT INTO stores (id, slug, name, theme_json) VALUES (?, ?, ?, ?)",
    )
    .run(id, uniqueStoreSlug(name), name, JSON.stringify(DEFAULT_THEME));
  addLedgerEntry(id, 0, "Ouverture de l'essai : 50 crédits offerts", true);
  return getStore(id)!;
}

export function getStore(id: string): Store | null {
  const r = getDb().prepare("SELECT * FROM stores WHERE id = ?").get(id) as Row | undefined;
  return r ? toStore(r) : null;
}

/** Une clé contenant un point est un domaine personnel, sinon c'est un slug. */
export function getStoreBySlugOrDomain(key: string): Store | null {
  const sql = key.includes(".")
    ? "SELECT * FROM stores WHERE custom_domain = ?"
    : "SELECT * FROM stores WHERE slug = ?";
  const r = getDb().prepare(sql).get(key.toLowerCase()) as Row | undefined;
  return r ? toStore(r) : null;
}

/** Prototype mono-marchand : la première boutique, créée au besoin. */
export function getOrCreateDemoStore(): Store {
  const r = getDb().prepare("SELECT * FROM stores ORDER BY created_at LIMIT 1").get() as
    | Row
    | undefined;
  return r ? toStore(r) : createStore();
}

export function updateStoreIdentity(
  id: string,
  patch: { name?: string; tagline?: string; description?: string },
): Store {
  const s = getStore(id);
  if (!s) throw new Error("Boutique introuvable");
  const name = patch.name ?? s.name;
  // Le slug suit le nom tant que la boutique n'est pas publiée (pas de lien cassé ensuite).
  const slug = s.status === "draft" && patch.name ? uniqueStoreSlug(patch.name, id) : s.slug;
  getDb()
    .prepare("UPDATE stores SET name = ?, slug = ?, tagline = ?, description = ? WHERE id = ?")
    .run(name, slug, patch.tagline ?? s.tagline, patch.description ?? s.description, id);
  return getStore(id)!;
}

export function updateStoreTheme(id: string, theme: Theme): void {
  getDb().prepare("UPDATE stores SET theme_json = ? WHERE id = ?").run(JSON.stringify(theme), id);
}

export function updateStoreSections(id: string, sections: Section[]): void {
  getDb()
    .prepare("UPDATE stores SET sections_json = ? WHERE id = ?")
    .run(JSON.stringify(sections), id);
}

export function updateStoreLegal(
  id: string,
  legal: Partial<LegalInfo>,
  authenticResellerDeclared: boolean,
): void {
  getDb()
    .prepare("UPDATE stores SET legal_json = ?, authentic_reseller_declared = ? WHERE id = ?")
    .run(JSON.stringify(legal), authenticResellerDeclared ? 1 : 0, id);
}

export function setStoreStatus(id: string, status: StoreStatus): void {
  getDb().prepare("UPDATE stores SET status = ? WHERE id = ?").run(status, id);
}

export function setCustomDomain(id: string, domain: string | null): void {
  getDb()
    .prepare("UPDATE stores SET custom_domain = ? WHERE id = ?")
    .run(domain ? domain.toLowerCase() : null, id);
}

export function setPerMessageCap(id: string, cap: number): void {
  getDb().prepare("UPDATE stores SET per_message_cap = ? WHERE id = ?").run(cap, id);
}

// ---------------------------------------------------------------- Products

export function listProducts(storeId: string): Product[] {
  return (
    getDb()
      .prepare("SELECT * FROM products WHERE store_id = ? ORDER BY created_at, rowid")
      .all(storeId) as Row[]
  ).map(toProduct);
}

export function getProduct(storeId: string, handle: string): Product | null {
  const r = getDb()
    .prepare("SELECT * FROM products WHERE store_id = ? AND handle = ?")
    .get(storeId, handle) as Row | undefined;
  return r ? toProduct(r) : null;
}

export interface ProductInput {
  title: string;
  description: string;
  priceCents: number;
  compareAtCents?: number | null;
  imageUrl?: string | null;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export function createProduct(storeId: string, input: ProductInput): Product {
  let handle = slugify(input.title);
  for (let i = 2; getProduct(storeId, handle); i++) handle = `${slugify(input.title)}-${i}`;
  getDb()
    .prepare(
      `INSERT INTO products (id, store_id, handle, title, description, price_cents, compare_at_cents,
         image_url, tags, seo_title, seo_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      storeId,
      handle,
      input.title,
      input.description,
      input.priceCents,
      input.compareAtCents ?? null,
      input.imageUrl ?? null,
      (input.tags ?? []).join(","),
      input.seoTitle ?? input.title,
      input.seoDescription ?? input.description.slice(0, 155),
    );
  return getProduct(storeId, handle)!;
}

export function updateProduct(
  storeId: string,
  handle: string,
  patch: Partial<ProductInput>,
): Product {
  const p = getProduct(storeId, handle);
  if (!p) throw new Error(`Produit « ${handle} » introuvable`);
  getDb()
    .prepare(
      `UPDATE products SET title = ?, description = ?, price_cents = ?, compare_at_cents = ?,
         image_url = ?, tags = ?, seo_title = ?, seo_description = ? WHERE id = ?`,
    )
    .run(
      patch.title ?? p.title,
      patch.description ?? p.description,
      patch.priceCents ?? p.priceCents,
      patch.compareAtCents === undefined ? p.compareAtCents : patch.compareAtCents,
      patch.imageUrl === undefined ? p.imageUrl : patch.imageUrl,
      (patch.tags ?? p.tags).join(","),
      patch.seoTitle ?? p.seoTitle,
      patch.seoDescription ?? p.seoDescription,
      p.id,
    );
  return getProduct(storeId, handle)!;
}

export function deleteProduct(storeId: string, handle: string): boolean {
  const res = getDb()
    .prepare("DELETE FROM products WHERE store_id = ? AND handle = ?")
    .run(storeId, handle);
  return Number(res.changes) > 0;
}

// ---------------------------------------------------------------- Coupons

export function listCoupons(storeId: string): Coupon[] {
  return (
    getDb().prepare("SELECT * FROM coupons WHERE store_id = ? ORDER BY created_at").all(storeId) as Row[]
  ).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    percentOff: Number(r.percent_off),
    active: r.active === 1,
  }));
}

export function upsertCoupon(storeId: string, code: string, percentOff: number): Coupon {
  const normalized = code.toUpperCase();
  getDb()
    .prepare(
      `INSERT INTO coupons (id, store_id, code, percent_off) VALUES (?, ?, ?, ?)
       ON CONFLICT (store_id, code) DO UPDATE SET percent_off = excluded.percent_off, active = 1`,
    )
    .run(randomUUID(), storeId, normalized, percentOff);
  return listCoupons(storeId).find((c) => c.code === normalized)!;
}

export function findActiveCoupon(storeId: string, code: string): Coupon | null {
  return listCoupons(storeId).find((c) => c.active && c.code === code.toUpperCase()) ?? null;
}

// ---------------------------------------------------------------- Orders

export function createOrder(
  storeId: string,
  o: Omit<Order, "id" | "number" | "status" | "createdAt">,
): Order {
  return transaction(() => {
    const db = getDb();
    const next = db
      .prepare("SELECT COALESCE(MAX(number), 1000) + 1 AS n FROM orders WHERE store_id = ?")
      .get(storeId) as Row;
    const id = randomUUID();
    db.prepare(
      `INSERT INTO orders (id, store_id, number, email, items_json, subtotal_cents, discount_cents,
         total_cents, coupon_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      storeId,
      Number(next.n),
      o.email,
      JSON.stringify(o.items),
      o.subtotalCents,
      o.discountCents,
      o.totalCents,
      o.couponCode,
    );
    return listOrders(storeId).find((x) => x.id === id)!;
  });
}

export function listOrders(storeId: string): Order[] {
  return (
    getDb()
      .prepare("SELECT * FROM orders WHERE store_id = ? ORDER BY number DESC")
      .all(storeId) as Row[]
  ).map((r) => ({
    id: r.id as string,
    number: Number(r.number),
    email: r.email as string,
    items: JSON.parse(r.items_json as string),
    subtotalCents: Number(r.subtotal_cents),
    discountCents: Number(r.discount_cents),
    totalCents: Number(r.total_cents),
    couponCode: (r.coupon_code as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

// ---------------------------------------------------------------- Credits

/**
 * Écrit une ligne dans le journal et met à jour le solde. Refuse de passer
 * sous zéro : l'appelant doit vérifier le solde *avant* d'exécuter l'action.
 */
export function addLedgerEntry(
  storeId: string,
  delta: number,
  reason: string,
  allowZero = false,
): LedgerEntry | null {
  if (delta === 0 && !allowZero) return null;
  const db = getDb();
  const row = db.prepare("SELECT credits_balance FROM stores WHERE id = ?").get(storeId) as
    | Row
    | undefined;
  if (!row) throw new Error("Boutique introuvable");
  const balanceAfter = Number(row.credits_balance) + delta;
  if (balanceAfter < 0) throw new Error("Solde de crédits insuffisant");
  const id = randomUUID();
  db.prepare("UPDATE stores SET credits_balance = ? WHERE id = ?").run(balanceAfter, storeId);
  db.prepare(
    "INSERT INTO credit_ledger (id, store_id, delta, reason, balance_after) VALUES (?, ?, ?, ?, ?)",
  ).run(id, storeId, delta, reason, balanceAfter);
  return { id, delta, reason, balanceAfter, createdAt: new Date().toISOString() };
}

export function listLedger(storeId: string, limit = 100): LedgerEntry[] {
  return (
    getDb()
      .prepare(
        "SELECT * FROM credit_ledger WHERE store_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
      )
      .all(storeId, limit) as Row[]
  ).map((r) => ({
    id: r.id as string,
    delta: Number(r.delta),
    reason: r.reason as string,
    balanceAfter: Number(r.balance_after),
    createdAt: r.created_at as string,
  }));
}

// ---------------------------------------------------------------- Conversations

export function getOrCreateConversation(storeId: string): { id: string; apiMessages: unknown[] } {
  const db = getDb();
  const r = db
    .prepare("SELECT * FROM conversations WHERE store_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1")
    .get(storeId) as Row | undefined;
  if (r) return { id: r.id as string, apiMessages: JSON.parse(r.api_messages_json as string) };
  return startNewConversation(storeId);
}

export function startNewConversation(storeId: string): { id: string; apiMessages: unknown[] } {
  const id = randomUUID();
  getDb().prepare("INSERT INTO conversations (id, store_id) VALUES (?, ?)").run(id, storeId);
  return { id, apiMessages: [] };
}

export function saveConversationMessages(conversationId: string, apiMessages: unknown[]): void {
  getDb()
    .prepare("UPDATE conversations SET api_messages_json = ? WHERE id = ?")
    .run(JSON.stringify(apiMessages), conversationId);
}

export function addChatLog(
  conversationId: string,
  entry: Omit<ChatLogEntry, "id" | "createdAt">,
): void {
  getDb()
    .prepare(
      "INSERT INTO chat_log (id, conversation_id, role, text, actions_json, credits_spent) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      randomUUID(),
      conversationId,
      entry.role,
      entry.text,
      JSON.stringify(entry.actions),
      entry.creditsSpent,
    );
}

export function listChatLog(conversationId: string): ChatLogEntry[] {
  return (
    getDb()
      .prepare("SELECT * FROM chat_log WHERE conversation_id = ? ORDER BY created_at, rowid")
      .all(conversationId) as Row[]
  ).map((r) => ({
    id: r.id as string,
    role: r.role as "user" | "assistant",
    text: r.text as string,
    actions: JSON.parse(r.actions_json as string),
    creditsSpent: Number(r.credits_spent),
    createdAt: r.created_at as string,
  }));
}

// ---------------------------------------------------------------- Audience (sans cookie)

export function recordPageview(storeId: string, pagePath: string): void {
  const day = new Date().toISOString().slice(0, 10);
  getDb()
    .prepare(
      `INSERT INTO pageviews (store_id, day, path, count) VALUES (?, ?, ?, 1)
       ON CONFLICT (store_id, day, path) DO UPDATE SET count = count + 1`,
    )
    .run(storeId, day, pagePath);
}

export function pageviewsLastDays(storeId: string, days = 7): number {
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const r = getDb()
    .prepare("SELECT COALESCE(SUM(count), 0) AS n FROM pageviews WHERE store_id = ? AND day >= ?")
    .get(storeId, since) as Row;
  return Number(r.n);
}
