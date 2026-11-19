import { beforeEach, describe, expect, it } from "vitest";
import {
  createStore,
  getStore,
  listLedger,
  listProducts,
  resetDbForTests,
  setPerMessageCap,
  type Store,
} from "@/lib/db";
import { executeTool, TurnBudget } from "@/lib/agent/tools";
import { runAgentTurn } from "@/lib/agent/run";
import { rolloverCredits } from "@/lib/credits";

let store: Store;

beforeEach(() => {
  resetDbForTests();
  store = createStore("Test");
});

const product = { title: "Bougie Vanille", description: "Une bougie douce à la vanille, pot de 200 g.", priceEur: 28 };

describe("outils de l'agent et crédits", () => {
  it("débite le coût exact de l'action et l'écrit au journal", () => {
    const budget = new TurnBudget(store.id, 15);
    const out = executeTool(store.id, "add_product", product, budget);
    expect(out.ok).toBe(true);
    expect(getStore(store.id)!.creditsBalance).toBe(48);
    expect(listProducts(store.id)[0].priceCents).toBe(2800);
    expect(listLedger(store.id)[0]).toMatchObject({ delta: -2, balanceAfter: 48 });
  });

  it("une action bloquée par le garde-fou ne modifie rien et ne coûte rien", () => {
    const out = executeTool(store.id, "update_store_identity", { name: "Cartier Outlet" }, new TurnBudget(store.id, 15));
    expect(out.ok).toBe(false);
    expect(out.action.cost).toBe(0);
    expect(getStore(store.id)!.name).toBe("Test");
    expect(getStore(store.id)!.creditsBalance).toBe(50);
  });

  it("refuse une action qui dépasse le plafond du message, avant de l'exécuter", () => {
    const budget = new TurnBudget(store.id, 2);
    budget.spent = 1; // le message lui-même
    const out = executeTool(store.id, "add_product", product, budget);
    expect(out.ok).toBe(false);
    expect(listProducts(store.id)).toHaveLength(0);
    expect(getStore(store.id)!.creditsBalance).toBe(50);
  });

  it("rejette une entrée invalide sans débit", () => {
    const out = executeTool(store.id, "create_coupon", { code: "!!", percentOff: 200 }, new TurnBudget(store.id, 15));
    expect(out.ok).toBe(false);
    expect(getStore(store.id)!.creditsBalance).toBe(50);
  });

  it("l'agent démo crée une boutique complète pour 12 crédits, comme annoncé sur la page Tarifs", async () => {
    const res = await runAgentTurn(store.id, "Crée une boutique de bougies artisanales");
    expect(res.mode).toBe("demo");
    expect(res.creditsSpent).toBe(12);
    expect(res.balance).toBe(38);
    expect(listProducts(store.id)).toHaveLength(3);
    expect(getStore(store.id)!.name).toBe("Lueur & Cire");
  });

  it("l'agent démo refuse de cloner une marque, sans action payante", async () => {
    const res = await runAgentTurn(store.id, "Fais-moi une boutique façon Cartier");
    expect(res.actions).toHaveLength(0);
    expect(res.creditsSpent).toBe(1);
    expect(res.reply).toMatch(/contrefaçon/);
  });

  it("ne débite rien quand le solde est épuisé", async () => {
    setPerMessageCap(store.id, 100);
    for (let i = 0; i < 50; i++) await runAgentTurn(store.id, "bonjour");
    expect(getStore(store.id)!.creditsBalance).toBe(0);
    const res = await runAgentTurn(store.id, "bonjour");
    expect(res.ok).toBe(false);
    expect(res.creditsSpent).toBe(0);
  });

  it("reporte les crédits non utilisés, plafonnés à 2× l'allocation", () => {
    expect(rolloverCredits(30, 200)).toBe(230);
    expect(rolloverCredits(350, 200)).toBe(400);
  });
});

describe("définitions d'outils envoyées à Claude", () => {
  it("sont des schémas JSON objet, triés, avec leur coût dans la description", async () => {
    const { toolDefinitions } = await import("@/lib/agent/tools");
    const defs = toolDefinitions();
    expect(defs.map((d) => d.name)).toEqual([...defs.map((d) => d.name)].sort());
    for (const d of defs) {
      expect(d.input_schema.type).toBe("object");
      expect(d.input_schema).not.toHaveProperty("$schema");
      expect(d.description).toMatch(/Coût : \d+ crédit/);
    }
    const add = defs.find((d) => d.name === "add_product")!;
    expect(add.input_schema.required).toEqual(expect.arrayContaining(["title", "description", "priceEur"]));
  });
});
