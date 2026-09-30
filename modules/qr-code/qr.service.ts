import QRCode from "qrcode";
import type { QrInput } from "./qr.schemas";

export interface QrRenderOptions {
  width: number;
  margin: number;
  errorCorrectionLevel: "L" | "M" | "Q" | "H";
}

export function qrRenderOptions(input: QrInput): QrRenderOptions {
  return {
    width: input.width,
    margin: input.margin,
    errorCorrectionLevel: input.errorCorrectionLevel,
  };
}

/** Renders a PNG data URL, suitable for an `<img src>` or a download. */
export function renderQrDataUrl(input: QrInput): Promise<string> {
  return QRCode.toDataURL(input.url, {
    ...qrRenderOptions(input),
    type: "image/png",
  });
}

/** Renders raw PNG bytes as a plain `ArrayBuffer`, ready for a response body. */
export async function renderQrPng(input: QrInput): Promise<ArrayBuffer> {
  const buffer = await QRCode.toBuffer(input.url, {
    ...qrRenderOptions(input),
    type: "png",
  });
  return Uint8Array.from(buffer).buffer;
}
