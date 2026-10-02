import { describe, expect, it } from "vitest";
import {
  productBlockSettingsSchema,
  productInputSchema,
} from "@/modules/products/schemas";
import { isProductPublic } from "@/modules/products/availability";

describe("product schemas", () => {
  it("normalizes a product and applies safe defaults", () => {
    expect(
      productInputSchema.parse({
        name: " Curso de Links ",
        slug: " Curso-Links ",
        type: "course",
        priceInCents: 12990,
      }),
    ).toMatchObject({
      name: "Curso de Links",
      slug: "curso-links",
      status: "draft",
      currency: "BRL",
      visible: true,
      images: [],
    });
  });

  it("rejects unsafe input and invalid availability windows", () => {
    expect(
      productInputSchema.safeParse({
        name: "Curso",
        slug: "curso",
        type: "course",
        priceInCents: 100,
        currency: "BR",
      }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({
        name: "Curso",
        slug: "curso",
        type: "course",
        priceInCents: 100,
        startAt: "2026-10-03T12:00:00.000Z",
        endAt: "2026-10-03T11:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("uses a bounded public call to action for product blocks", () => {
    expect(productBlockSettingsSchema.parse({})).toEqual({
      buttonLabel: "Ver produto",
    });
    expect(
      productBlockSettingsSchema.safeParse({ buttonLabel: "" }).success,
    ).toBe(false);
  });

  it("keeps draft, archived, and expired products off public pages", () => {
    const now = new Date("2026-10-02T12:00:00.000Z");
    expect(
      isProductPublic(
        { status: "active", visible: true, startAt: null, endAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      isProductPublic(
        {
          status: "archived",
          visible: true,
          startAt: null,
          endAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isProductPublic(
        {
          status: "active",
          visible: true,
          startAt: null,
          endAt: new Date("2026-10-02T11:59:59.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });
});