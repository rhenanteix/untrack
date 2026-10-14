import { describe, expect, it } from "vitest";
import {
  CHARGE_TRANSITIONS,
  chargeCancelSchema,
  chargeInputSchema,
  chargeStatusSchema,
  chargeUpdateSchema,
} from "@/modules/charges/schemas";

describe("charge schemas", () => {
  it("creates a draft charge with defaults", () => {
    const parsed = chargeInputSchema.parse({
      description: "Taxa de assinatura",
      amountInCents: 2990,
    });
    expect(parsed).toMatchObject({
      description: "Taxa de assinatura",
      amountInCents: 2990,
      currency: "BRL",
      status: "draft",
      metadata: {},
    });
  });

  it("rejects unsafe status on create (no paid)", () => {
    expect(
      chargeInputSchema.safeParse({
        description: "Cobrança",
        amountInCents: 1000,
        status: "paid",
      }).success,
    ).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(chargeInputSchema.safeParse({ description: "x", amountInCents: -1 }).success).toBe(false);
  });

  it("accepts BRL currency by default", () => {
    const parsed = chargeInputSchema.parse({ description: "x", amountInCents: 100 });
    expect(parsed.currency).toBe("BRL");
  });

  it("validates cancel schema with default reason", () => {
    expect(chargeCancelSchema.parse({})).toMatchObject({ reason: "" });
  });

  it("allows partial updates with strict mode", () => {
    expect(
      chargeUpdateSchema.safeParse({ amountInCents: 5000, unknown: true }).success,
    ).toBe(false);
  });

  it("validates all status values", () => {
    expect(chargeStatusSchema.parse("draft")).toBe("draft");
    expect(chargeStatusSchema.parse("pending")).toBe("pending");
    expect(chargeStatusSchema.parse("paid")).toBe("paid");
    expect(chargeStatusSchema.parse("expired")).toBe("expired");
    expect(chargeStatusSchema.parse("cancelled")).toBe("cancelled");
    expect(chargeStatusSchema.parse("refunded")).toBe("refunded");
  });
});

describe("charge state machine transitions", () => {
  it("allows draft to pending and cancelled", () => {
    expect(CHARGE_TRANSITIONS.draft).toContain("pending");
    expect(CHARGE_TRANSITIONS.draft).toContain("cancelled");
  });

  it("allows pending to paid, expired, cancelled", () => {
    expect(CHARGE_TRANSITIONS.pending).toContain("paid");
    expect(CHARGE_TRANSITIONS.pending).toContain("expired");
    expect(CHARGE_TRANSITIONS.pending).toContain("cancelled");
  });

  it("allows paid to refunded only", () => {
    expect(CHARGE_TRANSITIONS.paid).toEqual(["refunded"]);
  });

  it("does not allow terminal states to transition", () => {
    expect(CHARGE_TRANSITIONS.expired).toHaveLength(0);
    expect(CHARGE_TRANSITIONS.cancelled).toHaveLength(0);
    expect(CHARGE_TRANSITIONS.refunded).toHaveLength(0);
  });

  it("does not allow draft to paid directly", () => {
    expect(CHARGE_TRANSITIONS.draft).not.toContain("paid");
  });
});
