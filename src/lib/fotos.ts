import { criarClienteNavegador } from "@/lib/supabase/client";

export const BUCKET = "os-fotos";

export function urlFoto(caminho: string | null | undefined) {
  if (!caminho) return "";
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${caminho}`;
}

// Reduz a foto (celular tira 4 MB) para ~1600 px e JPEG antes de enviar
async function reduzir(arquivo: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(arquivo);
    const max = 1600;
    const esc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc);
    c.height = Math.round(bmp.height * esc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.82));
  } catch {
    return arquivo;
  }
}

export async function enviarFoto(empresaId: string, arquivo: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) && !/\.(jpe?g|png|webp|heic)$/i.test(arquivo.name)) {
    throw new Error("Escolha uma foto (JPG, PNG ou WEBP).");
  }
  const corpo = await reduzir(arquivo);
  const caminho = `${empresaId}/${crypto.randomUUID()}.jpg`;
  const { error } = await criarClienteNavegador().storage.from(BUCKET).upload(caminho, corpo, { contentType: "image/jpeg" });
  if (error) throw new Error("Não foi possível enviar a foto.");
  return caminho;
}
