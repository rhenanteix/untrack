import { describe, it, expect } from "vitest";
import { campaignStatusSchema, channelTypeSchema, checklistStatusSchema, checklistSeveritySchema, incidentStatusSchema, incidentSeveritySchema, createCampaignSchema, createChannelSchema, campaignKitInputSchema, campaignKitProposalSchema } from "@/modules/campaigns/schemas";

describe("campaigns schemas", () => {
  it("validates campaign status", () => {
    expect(campaignStatusSchema.parse("draft")).toBe("draft");
    expect(() => campaignStatusSchema.parse("invalid" as never)).toThrow();
  });

  it("validates channel type", () => {
    expect(channelTypeSchema.parse("social")).toBe("social");
    expect(() => channelTypeSchema.parse("invalid" as never)).toThrow();
  });

  it("validates create campaign input", () => {
    const result = createCampaignSchema.parse({ name: "Campanha Teste" });
    expect(result.name).toBe("Campanha Teste");
    expect(result.status).toBe("draft");
  });

  it("validates create channel input", () => {
    const result = createChannelSchema.parse({ name: "Canal 1", type: "social", destinationUrl: "https://example.com" });
    expect(result.name).toBe("Canal 1");
    expect(result.destinationUrl).toBe("https://example.com");
  });

  it("validates checklist status", () => {
    expect(checklistStatusSchema.parse("approved")).toBe("approved");
    expect(() => checklistStatusSchema.parse("invalid" as never)).toThrow();
  });

  it("validates checklist severity", () => {
    expect(checklistSeveritySchema.parse("blocker")).toBe("blocker");
    expect(() => checklistSeveritySchema.parse("invalid" as never)).toThrow();
  });

  it("validates incident status", () => {
    expect(incidentStatusSchema.parse("open")).toBe("open");
    expect(() => incidentStatusSchema.parse("invalid" as never)).toThrow();
  });

  it("validates incident severity", () => {
    expect(incidentSeveritySchema.parse("critical")).toBe("critical");
    expect(() => incidentSeveritySchema.parse("invalid" as never)).toThrow();
  });

  it("validates campaign kit input", () => {
    const result = campaignKitInputSchema.parse({ destination: "https://example.com", channels: [{ type: "social", name: "Instagram" }] });
    expect(result.destination).toBe("https://example.com");
    expect(result.channels[0].name).toBe("Instagram");
  });

  it("validates campaign kit proposal", () => {
    const result = campaignKitProposalSchema.parse({ channels: [{ name: "Instagram", type: "social", destinationUrl: "https://example.com", utmSource: "ig", utmMedium: "social", utmCampaign: "test", shortLinkSlug: "instagram-test", qrToken: "qr-instagram-test" }] });
    expect(result.channels[0].utmSource).toBe("ig");
  });
});
