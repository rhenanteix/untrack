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
});

describe("smart page entitlements", () => {
  it("keeps Smart Page limits centralized by plan", () => {
    expect(PLAN_LIMITS.free.smartPages).toBe(1);
    expect(PLAN_LIMITS.pro.smartPages).toBe(10);
    expect(PLAN_LIMITS.business.smartPages).toBe(100);
  });
});
