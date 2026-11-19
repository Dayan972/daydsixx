import { z } from "zod";
import { getOrCreateDemoStore } from "@/lib/db";
import { runAgentTurn } from "@/lib/agent/run";

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string().regex(/^media:[0-9a-f-]{36}$/)).max(10).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Message vide ou trop long (4000 caractères max)." }, { status: 400 });
  }
  // Prototype mono-marchand : à remplacer par la boutique de l'utilisateur connecté.
  const store = getOrCreateDemoStore();
  const result = await runAgentTurn(store.id, parsed.data.message, parsed.data.attachments ?? []);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
