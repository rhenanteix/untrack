import { describe, expect, it } from "vitest";
import {
  WHATSAPP_MESSAGE_MAX_LENGTH,
  WhatsAppInputError,
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  resolveWhatsAppMessage,
  scoreWhatsAppLink,
} from "@/modules/whatsapp/domain";

describe("WhatsApp phone normalization", () => {
  it("stores a formatted Brazilian number in one canonical form", () => {
    expect(normalizeWhatsAppPhone("+55 (11) 99999-9999")).toBe(
      "5511999999999",
    );
  });

  it.each(["", "00000000", "+55 11 ABC", "+55 11 99999 9999999999"])(
    "rejects an invalid number: %s",
    (phoneNumber) => {
      expect(() => normalizeWhatsAppPhone(phoneNumber)).toThrow(
        WhatsAppInputError,
      );
    },
  );
});

describe("WhatsApp URL builder", () => {
  it.each([
    ["Olá, tudo bem?", "Ol%C3%A1%2C+tudo+bem%3F"],
    ["Olá! 👋", "%F0%9F%91%8B"],
    ["produto & oferta = 10%", "produto+%26+oferta+%3D+10%25"],
    ["linha um\nlinha dois", "linha+um%0Alinha+dois"],
  ])("encodes messages safely: %s", (message, encodedPart) => {
    const url = buildWhatsAppUrl("+55 (11) 99999-9999", message);
    expect(url).toContain(encodedPart);
    expect(new URL(url).searchParams.get("text")).toBe(message);
  });

  it("omits the query string for an empty message", () => {
    expect(buildWhatsAppUrl("5511999999999", "")).toBe(
      "https://wa.me/5511999999999",
    );
  });

  it("accepts the maximum supported message length", () => {
    const message = "a".repeat(WHATSAPP_MESSAGE_MAX_LENGTH);
    expect(new URL(buildWhatsAppUrl("5511999999999", message)).searchParams.get("text")).toBe(message);
  });
});

describe("WhatsApp message variables", () => {
  it("substitutes only supported variables without evaluating template content", () => {
    expect(
      resolveWhatsAppMessage(
        "Olá {{campaign}}, {{source}} {{unknown}} {{constructor}}",
        { campaign: "Black Friday", source: "Instagram" },
      ),
    ).toBe("Olá Black Friday, Instagram {{unknown}} {{constructor}}");
  });
});

describe("WhatsApp link score", () => {
  it("explains every earned point", () => {
    expect(
      scoreWhatsAppLink({
        phoneNumber: "+55 (11) 99999-9999",
        message: "Olá!",
        trackingEnabled: true,
        hasCampaign: true,
        hasHealthMonitoring: false,
      }),
    ).toEqual({
      score: 85,
      checks: [
        { label: "Destination configured", configured: true, points: 30 },
        { label: "Message configured", configured: true, points: 20 },
        { label: "Tracking enabled", configured: true, points: 20 },
        { label: "Campaign connected", configured: true, points: 15 },
        { label: "Monitoring enabled", configured: false, points: 15 },
      ],
    });
  });
});