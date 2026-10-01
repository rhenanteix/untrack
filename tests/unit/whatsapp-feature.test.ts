import { afterEach, describe, expect, it, vi } from "vitest";
import { isWhatsAppIntelligenceEnabled } from "@/modules/whatsapp/feature";

afterEach(() => vi.unstubAllEnvs());

describe("WhatsApp Intelligence feature flag", () => {
  it("is enabled unless explicitly disabled", () => {
    vi.stubEnv("WHATSAPP_INTELLIGENCE", "");
    expect(isWhatsAppIntelligenceEnabled()).toBe(true);
    vi.stubEnv("WHATSAPP_INTELLIGENCE", "false");
    expect(isWhatsAppIntelligenceEnabled()).toBe(false);
  });
});