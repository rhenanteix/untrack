import { describe, expect, it } from "vitest";
import {
  qrRenderOptions,
  renderQrDataUrl,
  renderQrPng,
} from "@/modules/qr-code/qr.service";
import { qrInputSchema } from "@/modules/qr-code/qr.schemas";

const base = { url: "https://example.com/p?id=42" };

describe("serviço de QR Code", () => {
  it("aplica as opções validadas sem mutar a entrada", () => {
    const input = qrInputSchema.parse({ ...base, width: 256, margin: 4 });
    const options = qrRenderOptions(input);

    expect(options).toEqual({
      width: 256,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#172A3A", light: "#FFFFFF" },
    });
    expect(input.url).toBe(base.url);
  });

  it("gera um PNG válido como data URL", async () => {
    const input = qrInputSchema.parse({ ...base, width: 256 });
    const dataUrl = await renderQrDataUrl(input);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    // Assinatura do cabeçalho PNG.
    expect([...bytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    // Dimensões codificadas no IHDR.
    expect(bytes.readUInt32BE(16)).toBe(256);
    expect(bytes.readUInt32BE(20)).toBe(256);
  });

  it("gera bytes PNG para a resposta binária", async () => {
    const input = qrInputSchema.parse(base);
    const png = await renderQrPng(input);

    expect(png).toBeInstanceOf(ArrayBuffer);
    const bytes = new Uint8Array(png);
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // Dimensões do IHDR confirmam que a saída é um PNG completo.
    const view = new DataView(png);
    expect(view.getUint32(16)).toBe(512);
    expect(view.getUint32(20)).toBe(512);
  });

  it("renderiza padrões e marcadores selecionados no PNG", async () => {
    const square = await renderQrDataUrl(
      qrInputSchema.parse({ ...base, width: 256 }),
    );
    const styled = await renderQrDataUrl(
      qrInputSchema.parse({
        ...base,
        width: 256,
        pattern: "dots",
        cornerStyle: "extra-rounded",
      }),
    );

    expect(styled).toMatch(/^data:image\/png;base64,/);
    expect(styled).not.toBe(square);
  });

  it("recusa URLs fora de http/https antes de codificar", () => {
    expect(() => qrInputSchema.parse({ url: "javascript:alert(1)" })).toThrow();
    expect(() => qrInputSchema.parse({ url: "file:///etc/passwd" })).toThrow();
  });
});
