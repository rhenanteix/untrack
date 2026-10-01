import sharp from "sharp";
import { ApiError } from "@/lib/api-response";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export async function readImageBody(request: Request) {
  if (!request.body)
    throw new ApiError(400, "IMAGE_REQUIRED", "Selecione uma imagem.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "IMAGE_TOO_LARGE", "A imagem deve ter até 2 MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function optimizeImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new ApiError(413, "IMAGE_TOO_LARGE", "Envie uma imagem de até 2 MB.");
  try {
    const input = sharp(bytes, {
      limitInputPixels: 16_000_000,
      animated: false,
    });
    const metadata = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("unsupported");
    const data = await input
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    if (data.length > MAX_IMAGE_BYTES) throw new Error("output too large");
    return data;
  } catch {
    throw new ApiError(
      400,
      "INVALID_IMAGE",
      "Não foi possível ler esta imagem. Use JPG, PNG ou WebP estático com até 16 megapixels.",
    );
  }
}
