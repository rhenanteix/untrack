import { describe, expect, it } from "vitest";
import {
  createWhatsappLinkSchema,
  updateWhatsappLinkSchema,
  whatsappTrackingSchema,
} from "@/modules/whatsapp/schemas";

describe("WhatsApp link input contracts", () => {
  it("keeps the quick-create flow small while enabling tracking by default", () => {
    expect(
      createWhatsappLinkSchema.parse({
        name: "Vendas",
        phoneNumber: "+55 (11) 99999-9999",
      }),
    ).toMatchObject({
      message: "",
      status: "ACTIVE",
      trackingConfig: { enabled: true },
      allowDuplicate: false,
    });
  });

  it("rejects untrusted fields and oversized tracking values", () => {
    expect(
      createWhatsappLinkSchema.safeParse({
        name: "Vendas",
        phoneNumber: "+5511999999999",
        workspaceId: "another-tenant",
      }).success,
    ).toBe(false);
    expect(
      whatsappTrackingSchema.safeParse({
        enabled: true,
        source: "a".repeat(121),
      }).success,
    ).toBe(false);
  });

  it("allows a patch to detach a campaign or project", () => {
    expect(
      updateWhatsappLinkSchema.parse({ campaignId: null, projectId: null }),
    ).toEqual({ campaignId: null, projectId: null });
  });
});