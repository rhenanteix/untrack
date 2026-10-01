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

function isFinderModule(row: number, column: number, size: number) {
  return (
    (row < 7 && column < 7) ||
    (row < 7 && column >= size - 7) ||
    (row >= size - 7 && column < 7)
  );
}

function moduleShape(
  x: number,
  y: number,
  size: number,
  pattern: QrInput["pattern"],
) {
  if (pattern === "dots")
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * 0.39}"/>`;
  if (pattern === "rounded")
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.32}"/>`;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}"/>`;
}

function finderShape(
  row: number,
  column: number,
  moduleSize: number,
  margin: number,
  foreground: string,
  background: string,
  style: QrInput["cornerStyle"],
) {
  const x = (column + margin) * moduleSize;
  const y = (row + margin) * moduleSize;
  const totalSize = moduleSize * 7;
  const outerRadius =
    style === "extra-rounded"
      ? totalSize / 2
      : style === "rounded"
        ? moduleSize
        : 0;
  const innerRadius =
    style === "extra-rounded"
      ? moduleSize * 1.5
      : style === "rounded"
        ? moduleSize * 0.5
        : 0;
  return `<rect x="${x}" y="${y}" width="${totalSize}" height="${totalSize}" rx="${outerRadius}" fill="${foreground}"/>
    <rect x="${x + moduleSize}" y="${y + moduleSize}" width="${moduleSize * 5}" height="${moduleSize * 5}" rx="${innerRadius}" fill="${background}"/>
    <rect x="${x + moduleSize * 2}" y="${y + moduleSize * 2}" width="${moduleSize * 3}" height="${moduleSize * 3}" rx="${innerRadius}" fill="${foreground}"/>`;
}

async function renderStyledQrBuffer(input: QrInput) {
  const qr = QRCode.create(input.url, {
    errorCorrectionLevel: input.errorCorrectionLevel,
  });
  const moduleSize = input.width / (qr.modules.size + input.margin * 2);
  const modules: string[] = [];

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (!qr.modules.get(row, column) || isFinderModule(row, column, qr.modules.size)) continue;
      modules.push(
        moduleShape(
          (column + input.margin) * moduleSize,
          (row + input.margin) * moduleSize,
          moduleSize,
          input.pattern,
        ),
      );
    }
  }

  const finders = [
    [0, 0],
    [0, qr.modules.size - 7],
    [qr.modules.size - 7, 0],
  ]
    .map(([row, column]) =>
      finderShape(
        row,
        column,
        moduleSize,
        input.margin,
        input.foreground,
        input.background,
        input.cornerStyle,
      ),
    )
    .join("");

  const svg = Buffer.from(`<svg width="${input.width}" height="${input.width}" viewBox="0 0 ${input.width} ${input.width}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${input.background}"/>
    <g fill="${input.foreground}">${modules.join("")}</g>${finders}
  </svg>`);
  return sharp(svg).png().toBuffer();
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!,
  );
}

async function renderQrBuffer(input: QrInput) {
  const qr = await renderStyledQrBuffer(input);
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
