import { describe, expect, it, vi, afterEach } from "vitest";
import { safeReturnPath } from "@/modules/auth/return-path";
import { clickMetadata } from "@/modules/short-links/click-metadata";
import {
  shortLinkInputSchema,
  updateShortLinkSchema,
  historyImportSchema,
  slugSchema,
} from "@/modules/short-links/schemas";
import { enforceSameOrigin } from "@/lib/request-origin";
import { publicLinkUrl } from "@/lib/app-url";

afterEach(() => vi.unstubAllEnvs());

describe("retorno após autenticação", () => {
  it.each([
    "https://evil.example/conta",
    "//evil.example/conta",
    "/\\evil.example/conta",
    "/api/auth/sign-out",
    "/entrar",
    "javascript:alert(1)",
    undefined,
  ])("recusa destino externo ou fora da área da conta: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/conta");
  });
  it("preserva o destino de uma ferramenta e o detalhe privado", () => {
    expect(safeReturnPath("/encurtar?url=https%3A%2F%2Fexample.com")).toBe(
      "/encurtar?url=https%3A%2F%2Fexample.com",
    );
    expect(safeReturnPath("/conta/links/123")).toBe("/conta/links/123");
  });
});

describe("métricas sem identificação de visitantes", () => {
  it("retém apenas domínio, categoria do dispositivo e dia UTC", () => {
    const metadata = clickMetadata(
      new Headers({
        referer: "https://news.example/private?email=user@example.com",
        "user-agent": "Mozilla Mobile Android",
        "x-real-ip": "203.0.113.1",
      }),
      new Date("2026-09-30T23:59:59Z"),
    );
    expect(metadata).toEqual({
      referrer: "news.example",
      device: "Celular",
      day: new Date("2026-09-30T00:00:00Z"),
    });
  });
  it.each([
    "Slackbot",
    "Googlebot",
    "facebookexternalhit",
    "WhatsApp",
    "TelegramBot",
  ])("ignora pré-visualizações conhecidas: %s", (agent) => {
    expect(clickMetadata(new Headers({ "user-agent": agent }))).toBeNull();
  });
  it("ignora prefetch e trata visitas sem referer", () => {
    expect(
      clickMetadata(new Headers({ "sec-purpose": "prefetch;prerender" })),
    ).toBeNull();
    expect(clickMetadata(new Headers())).toMatchObject({
      referrer: "Direto",
      device: "Outro",
    });
    expect(
      clickMetadata(
        new Headers({ "user-agent": "iPad", referer: "file:///private/file" }),
      ),
    ).toMatchObject({ referrer: "Direto", device: "Tablet" });
  });
});

describe("contratos da V2", () => {
  it("não aceita ownership do cliente, protocolos inseguros ou slug arbitrário", () => {
    expect(
      shortLinkInputSchema.safeParse({
        url: "https://example.com",
        userId: "outra-conta",
      }).success,
    ).toBe(false);
    expect(
      shortLinkInputSchema.safeParse({ url: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      shortLinkInputSchema.safeParse({ url: "https://user:pass@example.com" })
        .success,
    ).toBe(false);
    expect(slugSchema.safeParse("abc/../123").success).toBe(false);
    expect(slugSchema.safeParse("abcDEF12_-").success).toBe(true);
    expect(
      updateShortLinkSchema.safeParse({
        isActive: false,
        userId: "outra-conta",
      }).success,
    ).toBe(false);
  });
  it("aplica limites ao título, descrição e importação", () => {
    expect(
      shortLinkInputSchema.safeParse({
        url: "https://example.com",
        title: "a".repeat(121),
      }).success,
    ).toBe(false);
    expect(
      shortLinkInputSchema.safeParse({
        url: "https://example.com",
        description: "a".repeat(501),
      }).success,
    ).toBe(false);
    const item = {
      id: "abc",
      originalUrl: "https://example.com",
      cleanUrl: "https://example.com",
      createdAt: new Date().toISOString(),
    };
    expect(
      historyImportSchema.safeParse({ items: Array(11).fill(item) }).success,
    ).toBe(false);
    expect(historyImportSchema.safeParse({ items: [item] }).success).toBe(true);
  });
  it("recusa mutações de outra origem e gera URLs usando configuração confiável", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://links.example");
    expect(() =>
      enforceSameOrigin(
        new Request("https://links.example/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      enforceSameOrigin(
        new Request("https://links.example/api", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toThrow();
    expect(() =>
      enforceSameOrigin(
        new Request("https://links.example/api", {
          headers: { origin: "https://links.example" },
        }),
      ),
    ).not.toThrow();
    expect(publicLinkUrl("abcDEF12_-")).toBe(
      "https://links.example/s/abcDEF12_-",
    );
  });
});
