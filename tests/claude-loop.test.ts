import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste la boucle d'outils avec une API simulée (aucun appel réseau) :
 * exécution des outils, débit, refus, et forme de l'historique renvoyé.
 */
const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static BadRequestError = class extends APIError {};
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

const { resetDbForTests, createStore, getStore, listProducts } = await import("@/lib/db");
const { runClaudeTurn } = await import("@/lib/agent/claude");
const { TurnBudget } = await import("@/lib/agent/tools");

const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const text = (t: string) => ({ type: "text", text: t });

beforeEach(() => {
  resetDbForTests();
  create.mockReset();
});

describe("boucle Claude (API simulée)", () => {
  it("exécute les appels d'outils parallèles, renvoie tous les résultats dans un seul message, puis s'arrête", async () => {
    const store = createStore("Test");
    create
      .mockResolvedValueOnce({
        stop_reason: "tool_use",
        content: [
          text("Je crée vos produits."),
          toolUse("t1", "add_product", { title: "Bougie Figue", description: "Une bougie verte et fruitée, 200 g.", priceEur: 30 }),
          toolUse("t2", "update_store_identity", { name: "Rolex Bougies" }),
        ],
      })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [text("Produit ajouté. Le nom proposé a été refusé.")] });

    const result = await runClaudeTurn({
      storeId: store.id,
      history: [],
      userContent: "Ajoute une bougie et appelle la boutique Rolex Bougies",
      budget: new TurnBudget(store.id, 15),
    });

    expect(listProducts(store.id)).toHaveLength(1);
    expect(getStore(store.id)!.name).toBe("Test"); // garde-fou
    expect(getStore(store.id)!.creditsBalance).toBe(48);
    expect(result.actions.map((a) => a.ok)).toEqual([true, false]);
    expect(result.reply).toMatch(/Produit ajouté/);

    // user, assistant(tool_use), user(2 tool_result), assistant(final)
    expect(result.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    const results = result.messages[2].content as { tool_use_id: string; is_error?: boolean }[];
    expect(results.map((r) => r.tool_use_id)).toEqual(["t1", "t2"]);
    expect(results[1].is_error).toBe(true);

    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("n'exécute rien et ne garde pas la réponse en cas de refus", async () => {
    const store = createStore("Test");
    create.mockResolvedValueOnce({
      stop_reason: "refusal",
      content: [toolUse("t1", "add_product", { title: "Bougie" })],
    });
    const result = await runClaudeTurn({
      storeId: store.id,
      history: [],
      userContent: "…",
      budget: new TurnBudget(store.id, 15),
    });
    expect(listProducts(store.id)).toHaveLength(0);
    expect(result.messages.map((m) => m.role)).toEqual(["user"]);
    expect(result.reply).toMatch(/ne peux pas/);
  });
});
