import Anthropic from "@anthropic-ai/sdk";
import type { ChatAction } from "../db";
import { SYSTEM_PROMPT } from "./prompt";
import { executeTool, toolDefinitions, type TurnBudget } from "./tools";

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const MAX_ITERATIONS = 12;

type MessageParam = Anthropic.Beta.BetaMessageParam;

export interface AgentTurnResult {
  reply: string;
  actions: ChatAction[];
  /** Historique complet à conserver pour le tour suivant. */
  messages: MessageParam[];
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * Boucle d'outils gérée par l'application (et non par le SDK) : chaque appel
 * d'outil passe par `executeTool`, qui applique le garde-fou marques et débite
 * les crédits au cas par cas, avant d'exécuter quoi que ce soit.
 */
export async function runClaudeTurn(params: {
  storeId: string;
  history: MessageParam[];
  userContent: string | Anthropic.Beta.BetaContentBlockParam[];
  budget: TurnBudget;
}): Promise<AgentTurnResult> {
  const messages: MessageParam[] = [
    ...params.history,
    { role: "user", content: params.userContent },
  ];
  const actions: ChatAction[] = [];
  const replyParts: string[] = [];
  const tools = toolDefinitions();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Préfixe figé (outils + système) mis en cache, puis cache automatique de l'historique.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      cache_control: { type: "ephemeral" },
      tools,
      messages,
      // Opus 5.5 : la réflexion adaptative est toujours active ; l'effort règle sa profondeur.
      output_config: { effort: "medium" },
      // Si le modèle décline une requête légitime, l'API la rejoue sur un modèle de repli.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      // Un refus peut couper un appel d'outil en plein milieu : on n'exécute rien
      // et on ne garde pas cette réponse dans l'historique.
      replyParts.push(
        "Je ne peux pas réaliser cette demande. Reformulez-la ou décrivez autrement ce que vous souhaitez vendre.",
      );
      break;
    }
    if (response.stop_reason === "max_tokens") {
      replyParts.push("La réponse était trop longue et a été interrompue. Essayez une demande plus ciblée.");
      break;
    }

    messages.push({ role: "assistant", content: response.content });
    const texts = response.content.filter((b) => b.type === "text").map((b) => b.text.trim());
    if (texts.some(Boolean)) replyParts.splice(0, replyParts.length, ...texts.filter(Boolean));

    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );
    if (toolUses.length === 0) break;

    // Tous les résultats dans un seul message utilisateur (appels parallèles).
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
      const outcome = executeTool(params.storeId, use.name, use.input, params.budget);
      actions.push(outcome.action);
      return {
        type: "tool_result",
        tool_use_id: use.id,
        content: outcome.content,
        ...(outcome.ok ? {} : { is_error: true }),
      };
    });
    messages.push({ role: "user", content: results });
  }

  return {
    reply: replyParts.join("\n\n") || "C'est fait.",
    actions,
    messages,
  };
}

/** Message d'erreur lisible pour le marchand, à partir des erreurs typées du SDK. */
export function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "La clé d'API de l'IA est invalide. Vérifiez ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "L'IA est très sollicitée en ce moment. Réessayez dans une minute.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Requête refusée par l'IA : ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `Le service d'IA a rencontré une erreur (${err.status ?? "réseau"}). Réessayez.`;
  }
  return err instanceof Error ? err.message : "Erreur inconnue.";
}
