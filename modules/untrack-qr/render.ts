import { z } from "zod";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ApiError } from "@/lib/api-response";
export const visualSchema = z.object({ width: z.number().int().min(256).max(2048).default(512), margin: z.number().int().min(4).max(12).default(4), dark: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#000000"), light: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ffffff"), logo: z.string().max(140000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional(), printLabel: z.string().max(160).default("") }).strict();
export type QrVisual = z.infer<typeof visualSchema>;
export function contrastRatio(dark: string, light: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(dark), b = luminance(light);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export async function renderVerifiedQr(url: string, raw: unknown) {
  const visual = visualSchema.parse(raw);
  let png: Buffer;
  try {
    png = await QRCode.toBuffer(url, { type: "png", width: visual.width, margin: visual.margin, errorCorrectionLevel: "H", color: { dark: visual.dark, light: visual.light } });
    if (visual.logo) {
      const size = Math.floor(visual.width * 0.18);
      const image = await sharp(Buffer.from(visual.logo.split(",")[1], "base64"), { limitInputPixels: 1_000_000 }).resize(size - 8, size - 8, { fit: "contain", background: visual.light }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: visual.light }).png().toBuffer();
      png = await sharp(png).composite([{ input: image, gravity: "center" }]).png().toBuffer();
    }
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height, { inversionAttempts: "attemptBoth" });
    if (decoded?.data !== url) throw new Error("decode");
  } catch {
    throw new ApiError(422, "QR_NOT_DECODABLE", "Não foi possível decodificar o QR exportado. Aumente o tamanho, melhore o contraste ou remova o logo.");
  }
  const warnings = contrastRatio(visual.dark, visual.light) < 4.5 ? ["Contraste abaixo de 4,5:1. Mesmo decodificado neste teste, o QR pode falhar na impressão ou em câmeras; prefira cores de alto contraste."] : [];
  return { png, visual, warnings, dataUrl: `data:image/png;base64,${png.toString("base64")}` };
}
export async function exportQr(url: string, raw: unknown, format: "png" | "svg" | "pdf") {
  const rendered = await renderVerifiedQr(url, raw);
  if (format === "png") return { bytes: rendered.png, contentType: "image/png" };
  if (format === "svg") return { bytes: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${rendered.visual.width}" height="${rendered.visual.width}" viewBox="0 0 ${rendered.visual.width} ${rendered.visual.width}"><image width="100%" height="100%" href="${rendered.dataUrl}"/></svg>`), contentType: "image/svg+xml" };
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const image = await pdf.embedPng(rendered.png);
  page.drawImage(image, { x: 97.5, y: 280, width: 400, height: 400 });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  if (rendered.visual.printLabel) page.drawText(rendered.visual.printLabel.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").slice(0, 80), { x: 48, y: 235, size: 12, font });
  page.drawText("Preserve a margem. Teste uma impressao antes de distribuir.", { x: 48, y: 205, size: 10, font });
  return { bytes: Buffer.from(await pdf.save()), contentType: "application/pdf" };
}
