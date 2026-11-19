import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMedia, getMedia, mediaDir, setMediaFileName, type Media } from "./db";

/**
 * Médiathèque : photos envoyées par le marchand (et, plus tard, images générées).
 * Prototype : fichiers sur disque. Production : stockage objet hébergé dans l'UE.
 */

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];
const EXT: Record<AcceptedMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** L'API Claude accepte des images jusqu'à 5 Mo : on aligne la limite d'envoi dessus. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isMediaRef(ref: string): boolean {
  return ref.startsWith("media:");
}

/** URL publique d'une référence d'image (media:<id> ou https). */
export function mediaUrl(ref: string | undefined | null): string | null {
  if (!ref) return null;
  if (isMediaRef(ref)) return `/media/${ref.slice("media:".length)}`;
  return ref.startsWith("https://") ? ref : null;
}

/** Détecte le vrai type d'image à partir des premiers octets (on ne croit pas l'extension). */
export function sniffImageMime(bytes: Uint8Array): AcceptedMime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Dimensions pour PNG, JPEG et WebP (VP8/VP8L/VP8X), sans dépendance. */
export function imageSize(bytes: Uint8Array, mime: AcceptedMime): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < bytes.length) {
        if (bytes[i] !== 0xff) return null;
        const marker = bytes[i + 1];
        const len = view.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
        }
        i += 2 + len;
      }
      return null;
    }
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width: w, height: h };
    }
    if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  } catch {
    return null;
  }
  return null;
}

export type SaveResult = { ok: true; media: Media } | { ok: false; error: string };

export async function saveImage(
  storeId: string,
  bytes: Uint8Array,
  alt: string,
  kind: Media["kind"] = "upload",
): Promise<SaveResult> {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image trop lourde (5 Mo maximum)." };
  }
  const mime = sniffImageMime(bytes);
  if (!mime) return { ok: false, error: "Format non pris en charge : envoyez un JPEG, PNG ou WebP." };
  const size = imageSize(bytes, mime);
  const media = createMedia({
    storeId,
    kind,
    mime,
    fileName: "",
    alt: alt.slice(0, 200),
    width: size?.width ?? null,
    height: size?.height ?? null,
    bytes: bytes.byteLength,
  });
  const fileName = `${media.id}.${EXT[mime]}`;
  await writeFile(path.join(mediaDir(), fileName), bytes);
  setMediaFileName(media.id, fileName);
  return { ok: true, media: { ...media, fileName } };
}

export async function readMediaFile(id: string): Promise<{ media: Media; bytes: Buffer } | null> {
  const media = getMedia(id);
  if (!media || !media.fileName) return null;
  // Le nom de fichier est généré par nous (uuid.ext) : pas de traversée de répertoire possible.
  const bytes = await readFile(path.join(mediaDir(), path.basename(media.fileName)));
  return { media, bytes };
}

// ---------------------------------------------------------------- Génération d'images

/**
 * Point de branchement d'un fournisseur de génération d'images (visuels d'ambiance,
 * amélioration des photos produit). Aucun fournisseur n'est branché dans le prototype :
 * le choix (qualité, prix, hébergement des données) reste à faire.
 */
export interface ImageGenerator {
  generate(prompt: string, aspect: "1:1" | "4:5" | "16:9" | "3:4"): Promise<Uint8Array>;
}

export function getImageGenerator(): ImageGenerator | null {
  return null;
}
