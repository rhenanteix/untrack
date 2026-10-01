import QRCode from "qrcode";
import sharp from "sharp";
import type { QrInput } from "./qr.schemas";

export interface QrRenderOptions {
  width: number;
  margin: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
  color: { dark: string; light: string };
}

export function qrRenderOptions(input: QrInput): QrRenderOptions {
  return {
    width: input.width,
    margin: input.margin,
    errorCorrectionLevel: input.errorCorrectionLevel,
    color: { dark: input.foreground, light: input.background },
  };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

async function renderQrBuffer(input: QrInput) {
  const qr = await QRCode.toBuffer(input.url, {
    ...qrRenderOptions(input),
    type: "png",
  });
  if (input.frame === "none") return qr;

  const padding = 34;
  const labelHeight = input.frame === "scan" ? 44 : 0;
  const size = input.width + padding * 2;
  const height = size + labelHeight;
  const radius = input.frame === "rounded" ? 28 : 12;
  const label = escapeXml(input.frameText || "ESCANEIE");
  const frame = Buffer.from(`
    <svg width="${size}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" rx="${radius}" fill="${input.background}"/>
      <rect x="1" y="1" width="${size - 2}" height="${height - 2}" rx="${radius}" fill="none" stroke="${input.foreground}" stroke-width="2"/>
      ${input.frame === "scan" ? `<rect y="${size}" width="${size}" height="${labelHeight}" fill="${input.foreground}"/><text x="50%" y="${size + 29}" text-anchor="middle" fill="${input.background}" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="1">${label}</text>` : ""}
    </svg>`,
  );
  return sharp(frame)
    .composite([{ input: qr, left: padding, top: padding }])
    .png()
    .toBuffer();
}

/** Renders a PNG data URL, suitable for an `<img src>` or a download. */
export async function renderQrDataUrl(input: QrInput): Promise<string> {
  const buffer = await renderQrBuffer(input);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

/** Renders raw PNG bytes as a plain `ArrayBuffer`, ready for a response body. */
export async function renderQrPng(input: QrInput): Promise<ArrayBuffer> {
  const buffer = await renderQrBuffer(input);
  return Uint8Array.from(buffer).buffer;
}
