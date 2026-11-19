import { getOrCreateDemoStore } from "@/lib/db";
import { saveImage } from "@/lib/media";

/** Envoi de photos par le marchand (multipart, champ « files », plusieurs fichiers). */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const files = form?.getAll("files").filter((f): f is File => f instanceof File) ?? [];
  if (files.length === 0) return Response.json({ error: "Aucune image reçue." }, { status: 400 });
  if (files.length > 10) return Response.json({ error: "10 images maximum à la fois." }, { status: 400 });

  // Prototype mono-marchand : à remplacer par la boutique de l'utilisateur connecté.
  const store = getOrCreateDemoStore();
  const results = [];
  for (const file of files) {
    const saved = await saveImage(store.id, new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.[^.]+$/, ""));
    results.push(
      saved.ok
        ? { ok: true, name: file.name, ref: `media:${saved.media.id}`, url: `/media/${saved.media.id}` }
        : { ok: false, name: file.name, error: saved.error },
    );
  }
  return Response.json({ results });
}
