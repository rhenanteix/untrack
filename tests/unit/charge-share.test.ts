import { describe, expect, it, vi } from "vitest";
import { chargeShareUrl } from "@/modules/charges/service";

vi.mock("@/modules/billing/plans", () => ({
  requirePremium: vi.fn(),
}));
vi.mock("@/modules/analytics", () => ({
  track: vi.fn().mockResolvedValue(undefined),
}));

describe("charge share service", () => {
  describe("chargeShareUrl", () => {
    it("builds a /pay/{token} URL from appUrl", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://arrume-meu-link.com";
      expect(chargeShareUrl("abc123")).toBe(
        "https://arrume-meu-link.com/pay/abc123",
      );
    });

    it("works with https base only", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.test.dev";
      expect(chargeShareUrl("0123456789abcdef0123456789abcdef")).toBe(
        "https://app.test.dev/pay/0123456789abcdef0123456789abcdef",
      );
    });
  });

  describe("generateShareToken (token format)", () => {
    it("produces 32-char hex token via randomUUID", async () => {
      const { generateShareToken } = await import("@/modules/charges/service");
      const token = generateShareToken();
      expect(token).toMatch(/^[a-f0-9]{32}$/);
    });

    it("produces unique tokens across calls", async () => {
      const { generateShareToken } = await import("@/modules/charges/service");
      const a = generateShareToken();
      const b = generateShareToken();
      expect(a).not.toBe(b);
    });
  });
});
