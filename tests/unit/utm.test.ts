import { describe, expect, it } from "vitest";
import { generateUtmUrl } from "@/modules/utm/utm.service";
import { utmInputSchema } from "@/modules/utm/utm.schemas";

describe("generateUtmUrl", () => {
  it("adiciona campos obrigatórios e codifica caracteres especiais", () => {
    const result = new URL(
      generateUtmUrl({
        url: "https://example.com/oferta?id=10#comprar",
        source: "newsletter setembro",
        medium: "e-mail",
        campaign: "promoção 50%",
        term: "tênis azul",
        content: "botão principal",
      }),
    );

    expect(result.searchParams.get("id")).toBe("10");
    expect(result.searchParams.get("utm_source")).toBe("newsletter setembro");
    expect(result.searchParams.get("utm_medium")).toBe("e-mail");
    expect(result.searchParams.get("utm_campaign")).toBe("promoção 50%");
    expect(result.searchParams.get("utm_term")).toBe("tênis azul");
    expect(result.searchParams.get("utm_content")).toBe("botão principal");
    expect(result.hash).toBe("#comprar");
  });

  it("substitui UTMs existentes e remove opcionais omitidas", () => {
    const result = new URL(
      generateUtmUrl({
        url: "https://example.com/?utm_source=old&utm_term=old&id=1",
        source: "new",
        medium: "social",
        campaign: "launch",
      }),
    );

    expect(result.searchParams.getAll("utm_source")).toEqual(["new"]);
    expect(result.searchParams.has("utm_term")).toBe(false);
    expect(result.searchParams.get("id")).toBe("1");
  });

  it("valida obrigatórios, tamanho e protocolo antes da geração", () => {
    expect(() =>
      utmInputSchema.parse({
        url: "https://example.com",
        source: "",
        medium: "cpc",
        campaign: "x",
      }),
    ).toThrow();
    expect(() =>
      utmInputSchema.parse({
        url: "file:///etc/passwd",
        source: "site",
        medium: "cpc",
        campaign: "x",
      }),
    ).toThrow();
  });
});
