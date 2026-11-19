import type Anthropic from "@anthropic-ai/sdk";
import {
  addChatLog,
  addLedgerEntry,
  getMedia,
  getOrCreateConversation,
  getStore,
  saveConversationMessages,
  type ChatAction,
} from "../db";
import { readMediaFile } from "../media";
import { MESSAGE_COST } from "../credits";
import { describeApiError, runClaudeTurn } from "./claude";
import { runDemoTurn } from "./demo";
import { storeOverview, TurnBudget } from "./tools";

export type AgentMode = "claude" | "demo";

export function agentMode(): AgentMode {
  if (process.env.AGENT_MODE === "demo") return "demo";
  if (process.env.AGENT_MODE === "claude") return "claude";
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "claude" : "demo";
}

export interface AgentReply {
  ok: boolean;
  reply: string;
  actions: ChatAction[];
  creditsSpent: number;
  balance: number;
  mode: AgentMode;
}

/**
 * Un message du marchand : débit du message, exécution de l'agent (Claude ou démo),
 * journalisation. En cas de panne du service d'IA, le message est remboursé.
 */
export async function runAgentTurn(
  storeId: string,
  text: string,
  attachments: string[] = [],
): Promise<AgentReply> {
  const mode = agentMode();
  const store = getStore(storeId);
  if (!store) throw new Error("Boutique introuvable");

  if (store.creditsBalance < MESSAGE_COST) {
    return {
      ok: false,
      reply: "Votre solde de crédits est épuisé. Rechargez ou attendez le renouvellement mensuel : rien n'a été débité.",
      actions: [],
      creditsSpent: 0,
      balance: store.creditsBalance,
      mode,
    };
  }

  // Seules les photos de cette boutique peuvent être jointes.
  const photos = attachments.filter((ref) => getMedia(ref.replace(/^media:/, ""))?.storeId === storeId);

  const budget = new TurnBudget(storeId, store.perMessageCap);
  addLedgerEntry(storeId, -MESSAGE_COST, "Message envoyé à l'IA");
  budget.spent += MESSAGE_COST;

  const conversation = getOrCreateConversation(storeId);
  addChatLog(conversation.id, { role: "user", text, actions: [], attachments: photos, creditsSpent: 0 });

  let reply: string;
  let actions: ChatAction[];
  let ok = true;

  if (mode === "demo") {
    ({ reply, actions } = runDemoTurn(storeId, text, budget, photos));
  } else {
    try {
      const userContent = await buildUserContent(store, text, photos, budget.remaining());
      const result = await runClaudeTurn({
        storeId,
        history: conversation.apiMessages as Anthropic.Beta.BetaMessageParam[],
        userContent,
        budget,
      });
      saveConversationMessages(conversation.id, result.messages);
      ({ reply, actions } = result);
    } catch (err) {
      ok = false;
      actions = [];
      reply = describeApiError(err);
      // Les actions déjà exécutées restent débitées (elles ont eu lieu) ; le message, lui, est remboursé.
      addLedgerEntry(storeId, MESSAGE_COST, "Remboursement : le service d'IA n'a pas répondu");
      budget.spent -= MESSAGE_COST;
    }
  }

  addChatLog(conversation.id, { role: "assistant", text: reply, actions, creditsSpent: budget.spent });

  return {
    ok,
    reply,
    actions,
    creditsSpent: budget.spent,
    balance: getStore(storeId)!.creditsBalance,
    mode,
  };
}

/**
 * Message envoyé à Claude : état de la boutique, puis les photos jointes (vision),
 * chacune précédée de sa référence pour que l'IA puisse la placer dans la boutique.
 */
async function buildUserContent(
  store: NonNullable<ReturnType<typeof getStore>>,
  text: string,
  photos: string[],
  creditsLeft: number,
): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text:
        `<etat_boutique>\n${JSON.stringify(storeOverview(store))}\n</etat_boutique>\n` +
        `<credits_disponibles_pour_ce_message>${creditsLeft}</credits_disponibles_pour_ce_message>`,
    },
  ];
  for (const ref of photos) {
    const file = await readMediaFile(ref.replace(/^media:/, ""));
    if (!file) continue;
    blocks.push({ type: "text", text: `Photo jointe par le marchand : ${ref}` });
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: file.media.mime as "image/jpeg" | "image/png" | "image/webp",
        data: file.bytes.toString("base64"),
      },
    });
  }
  blocks.push({ type: "text", text });
  return blocks;
}
