"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ChatAction, ChatLogEntry } from "@/lib/db";
import type { FormState } from "./actions";

// ---------------------------------------------------------------- Formulaire avec retour

export function StatefulForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true, message: "" });
  return (
    <form action={formAction} className="space-y-4">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : submitLabel}
        </button>
        {state.message && (
          <p role="status" className={`text-sm ${state.ok ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Conversation avec l'IA

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  actions: ChatAction[];
  creditsSpent: number;
}

const SUGGESTIONS = [
  "Crée une boutique de bougies artisanales, ambiance chaleureuse",
  "Ajoute Bougie Vanille à 28 €",
  "Code promo BIENVENUE10 de 10 %",
  "Je veux publier",
];

export function ChatPanel({
  initialLog,
  balance,
  cap,
  mode,
}: {
  initialLog: ChatLogEntry[];
  balance: number;
  cap: number;
  mode: "claude" | "demo";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialLog);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [credits, setCredits] = useState(balance);
  const endRef = useRef<HTMLDivElement>(null);

  // L'état local fait foi après le montage ; le parent change la `key` pour repartir à zéro.
  useEffect(() => {
    // Accolades obligatoires : scrollIntoView renvoie une promesse dans les navigateurs récents,
    // et React prendrait toute valeur renvoyée pour une fonction de nettoyage.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  const maxCost = Math.min(cap, credits);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setPending(true);
    setMessages((m) => [...m, { role: "user", text: message, actions: [], creditsSpent: 0 }]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply ?? data.error ?? "Erreur inconnue.",
          actions: data.actions ?? [],
          creditsSpent: data.creditsSpent ?? 0,
        },
      ]);
      if (typeof data.balance === "number") setCredits(data.balance);
      router.refresh();
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Connexion impossible. Réessayez.", actions: [], creditsSpent: 0 },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold">Assistant</p>
          <p className="text-xs text-muted">
            {mode === "claude" ? "IA Claude" : "Mode démo sans IA (ajoutez ANTHROPIC_API_KEY)"}
          </p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium" aria-label="Solde de crédits">
          {credits} crédits
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3 text-sm text-muted">
            <p>Décrivez la boutique que vous voulez créer : ce que vous vendez, l&apos;ambiance, votre public.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border px-3 py-1 text-left text-xs hover:bg-surface"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground"
                  : "max-w-[95%] space-y-2 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.actions.length > 0 && (
                <ul className="space-y-1">
                  {m.actions.map((a, j) => (
                    <li
                      key={j}
                      className={`flex items-start justify-between gap-3 rounded border px-2 py-1 text-xs ${
                        a.ok ? "border-border" : "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      <span>
                        {a.ok ? "✓" : "✗"} {a.label}
                        {a.detail ? <span className="block opacity-75">{a.detail}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono">{a.ok ? `−${a.cost}` : "0"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {m.role === "assistant" && m.creditsSpent > 0 && (
                <p className="text-xs text-muted">Total de ce message : {m.creditsSpent} crédit(s)</p>
              )}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-muted">L&apos;assistant travaille…</p>}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Votre message</label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Ex. : crée une boutique de céramiques faites main…"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {credits < 1
              ? "Solde épuisé : rien ne sera débité."
              : `Coût maximum de ce message : ${maxCost} crédit(s), selon les actions réalisées.`}
          </p>
          <button
            type="submit"
            disabled={pending || !input.trim() || credits < 1}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
