import { connection } from "next/server";
import { readMediaFile } from "@/lib/media";

export async function GET(_request: Request, ctx: RouteContext<"/media/[id]">) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const file = await readMediaFile(id).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.media.mime,
      // Un média ne change jamais : son identifiant suffit à invalider le cache.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
