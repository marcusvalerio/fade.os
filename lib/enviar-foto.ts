"use client";

/**
 * Envio de foto direto do aparelho para o Storage — um caminho só para logo,
 * foto do profissional, capa e fotos da página pública. Nenhuma foto entra
 * por link (decisão do produto, nov/2026).
 *
 * Foto de celular costuma ter vários MB: antes de subir, ela é reduzida no
 * próprio navegador para no máximo LADO_MAXIMO px no lado maior, em JPEG.
 * GIF e SVG sobem como vieram (redimensionar quebraria a animação / o vetor).
 */

const LADO_MAXIMO = 2000;
const QUALIDADE = 0.85;

async function reduzir(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
    return blob ?? file;
  } catch {
    // Formato que o navegador não decodifica (ex.: HEIC em alguns aparelhos): sobe o original.
    return file;
  }
}

/** Sobe a foto da empresa e devolve a URL pública. Lança Error com mensagem para a pessoa. */
export async function enviarFoto(companyId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem (JPG, PNG ou WEBP).");
  const corpo = await reduzir(file);
  const ext = corpo.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;

  // O SDK só é necessário no envio — baixar junto com a tela pesaria ~70 kB.
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { error } = await supabase.storage.from("avatars").upload(path, corpo, {
    upsert: false,
    cacheControl: "3600",
    contentType: corpo.type || file.type,
  });
  if (error) throw new Error("Não foi possível enviar a imagem. Tente novamente.");
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
