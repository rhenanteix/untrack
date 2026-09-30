import { describe, expect, it } from "vitest";
import { analyzeInputSchema, urlInputSchema } from "@/modules/links/schemas";
import { qrInputSchema } from "@/modules/qr-code/qr.schemas";

describe("validação de URL", () => {
  it.each([
    "https://example.com",
    "http://example.com:8080/caminho?q=olá#parte",
    "https://xn--exemplo-6wa.com/",
    "https://[2001:4860:4860::8888]/",
  ])("aceita URL web válida: %s", (url) => {
    expect(urlInputSchema.parse({ url }).url).toBe(url);
  });

  it.each([
    "",
    "example.com",
    "javascript:alert(1)",
    "ftp://example.com/file",
    "https://usuario:senha@example.com/",
    "https://",
  ])("rejeita URL inválida ou insegura: %s", (url) => {
    expect(() => urlInputSchema.parse({ url })).toThrow();
  });

  it("rejeita propriedades extras e categorias desconhecidas", () => {
    expect(() =>
      analyzeInputSchema.parse({
        url: "https://example.com",
        categories: ["utm", "desconhecida"],
      }),
    ).toThrow();
    expect(() =>
      urlInputSchema.parse({ url: "https://example.com", admin: true }),
    ).toThrow();
  });

  it("aplica limites e padrões do QR Code", () => {
    expect(qrInputSchema.parse({ url: "https://example.com" })).toMatchObject({
      format: "dataUrl",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    expect(() =>
      qrInputSchema.parse({ url: "https://example.com", width: 127 }),
    ).toThrow();
  });
});
