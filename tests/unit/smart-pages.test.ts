import { describe, expect, it } from "vitest";
import { PLAN_LIMITS } from "@/modules/workspaces/policy";
import {
  smartPageBlockInputSchema,
  smartPageInputSchema,
  smartPageUpdateSchema,
} from "@/modules/smart-pages/schemas";

describe("smart page schemas", () => {
  it("normalizes a public slug and applies safe defaults", () => {
    expect(
      smartPageInputSchema.parse({
        slug: " Minha-Pagina ",
        title: "Minha pagina",
      }),
    ).toMatchObject({
      slug: "minha-pagina",
      title: "Minha pagina",
      description: "",
    });
  });

  it("rejects reserved, unsafe, and unknown page input", () => {
    expect(
      smartPageInputSchema.safeParse({ slug: "api", title: "Pagina" }).success,
    ).toBe(false);
    expect(
      smartPageInputSchema.safeParse({ slug: "minha_pagina", title: "Pagina" })
        .success,
    ).toBe(false);
    expect(
      smartPageUpdateSchema.safeParse({ title: "Pagina", workspaceId: "other" })
        .success,
    ).toBe(false);
  });

  it("requires an external destination or a managed link for a link block", () => {
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "link",
        settings: { title: "Portfolio" },
      }).success,
    ).toBe(false);
    expect(
      smartPageBlockInputSchema.parse({
        type: "link",
        settings: { title: "Portfolio" },
        linkId: "link_123",
      }),
    ).toMatchObject({
      visible: true,
      analyticsEnabled: true,
      linkId: "link_123",
    });
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "link",
        settings: { title: "Site", destinationUrl: "javascript:alert(1)" },
      }).success,
    ).toBe(false);
  });

  it("requires a workspace product for product blocks", () => {
    expect(
      smartPageBlockInputSchema.parse({
        type: "product",
        productId: "product_123",
        settings: {},
      }),
    ).toMatchObject({
      visible: true,
      analyticsEnabled: true,
      settings: { buttonLabel: "Ver produto" },
    });
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "product",
        settings: {},
      }).success,
    ).toBe(false);
  });

  it("accepts settings-only blocks and rejects unsafe media destinations", () => {
    const blocks = [
      { type: "title", settings: { text: "Novidades" } },
      { type: "text", settings: { content: "Conteúdo novo toda semana." } },
      { type: "divider", settings: {} },
      {
        type: "image",
        settings: { imageUrl: "https://cdn.example/image.webp" },
      },
      { type: "video", settings: { url: "https://youtu.be/dQw4w9WgXcQ" } },
      {
        type: "spotify",
        settings: { url: "https://open.spotify.com/track/abc" },
      },
      {
        type: "file",
        settings: { url: "https://cdn.example/guide.pdf", title: "Guia" },
      },
      { type: "qr", settings: { destinationUrl: "https://example.com" } },
      { type: "whatsapp", settings: { number: "+55 11 99999-9999" } },
      { type: "email", settings: { address: "ola@example.com" } },
      { type: "phone", settings: { number: "+55 11 99999-9999" } },
      {
        type: "event",
        settings: {
          title: "Aula ao vivo",
          destinationUrl: "https://example.com/event",
        },
      },
      {
        type: "appointment",
        settings: { destinationUrl: "https://cal.com/example" },
      },
    ];
    for (const block of blocks)
      expect(smartPageBlockInputSchema.safeParse(block).success).toBe(true);
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "video",
        settings: { url: "https://example.com/video" },
      }).success,
    ).toBe(false);
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "video",
        settings: { url: "https://evilyoutube.com/watch?v=dQw4w9WgXcQ" },
      }).success,
    ).toBe(false);
    expect(
      smartPageBlockInputSchema.safeParse({
        type: "spotify",
        settings: { url: "https://open.spotify.com/artist/artist-id" },
      }).success,
    ).toBe(false);
  });
});

describe("smart page entitlements", () => {
  it("keeps Smart Page limits centralized by plan", () => {
    expect(PLAN_LIMITS.free.smartPages).toBe(1);
    expect(PLAN_LIMITS.premium.smartPages).toBe(10);
  });
});
