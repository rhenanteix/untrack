import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { resolveAttribution } from "@/modules/analytics/attribution";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
} from "@/modules/analytics/public-context";
import { recordPublicSmartCardEvent } from "@/modules/smart-cards/events";
import { captureSmartCardContact } from "@/modules/smart-cards/service";
import {
  smartCardContactFormSchema,
  smartCardInputSchema,
  smartCardSlugSchema,
} from "@/modules/smart-cards/schemas";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/modules/analytics/service", () => ({
  recordAnalyticsEvent: vi.fn(),
}));
vi.mock("@/modules/audience/summary", () => ({
  refreshAudienceContactSummary: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-with-enough-entropy-for-hashing",
  );
  vi.mocked(recordAnalyticsEvent).mockResolvedValue({
    eventId: "event_1",
    recorded: true,
    duplicate: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Smart Card schemas", () => {
  it("normalizes the public card address and applies its contact defaults", () => {
    const card = smartCardInputSchema.parse({
      slug: " Ana-Silva ",
      firstName: "Ana",
      contactPoints: [{ type: "phone", value: "+55 11 99999-9999" }],
      socialLinks: [{ providerId: "instagram", url: "@ana" }],
    });
    expect(card.slug).toBe("ana-silva");
    expect(card.socialLinks).toEqual([
      { providerId: "instagram", url: "https://instagram.com/ana" },
    ]);
    expect(card.contactForm.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "firstName", required: true }),
        expect.objectContaining({
          key: "email",
          type: "email",
          required: true,
        }),
      ]),
    );
    expect(card.contactForm.publicDetails).toEqual({
      phone: true,
      whatsapp: true,
      email: true,
      website: true,
    });
  });

  it("rejects reserved addresses, unsafe actions, and ambiguous capture fields", () => {
    expect(smartCardSlugSchema.safeParse("c").success).toBe(false);
    expect(
      smartCardInputSchema.safeParse({
        slug: "ana-silva",
        firstName: "Ana",
        actions: [
          {
            type: "website",
            label: "Portfólio",
            url: "javascript:alert(1)",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      smartCardContactFormSchema.safeParse({
        fields: [
          {
            key: "interest",
            label: "Interesse",
            type: "select",
            required: false,
            options: ["Parceria"],
          },
        ],
        intent: {
          enabled: true,
          label: "Como posso ajudar?",
          options: ["A", "B"],
        },
      }).success,
    ).toBe(false);
  });
});

describe("Smart Card public analytics", () => {
  it("routes an action through the universal collector with card context", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: "card_1",
            workspaceId: "workspace_1",
            campaignId: null,
          }),
      },
      smartCardAction: {
        findFirst: vi.fn().mockResolvedValue({
          id: "action_1",
          type: "whatsapp",
        }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartCardEvent(
        {
          event: "whatsapp_click",
          slug: "ana-silva",
          actionId: "action_1",
          visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
          source: "qr",
        },
        new Headers({
          referer: "https://evento.example/stand?contact=private@example.com",
          "user-agent": "Mozilla Mobile Android",
        }),
      ),
    ).resolves.toMatchObject({ recorded: true });

    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "whatsapp_click",
        workspaceId: "workspace_1",
        assetType: "smart_card",
        assetId: "card_1",
        smartCardId: "card_1",
        smartCardActionId: "action_1",
        elementId: "action_1",
      }),
    );
  });

  it("sends preview bots to the collector for marked exclusion", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({
        id: "card_1",
        workspaceId: "workspace_1",
        campaignId: null,
      });
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartCardEvent(
        { event: "card_view", slug: "ana-silva", source: "direct" },
        new Headers({ "user-agent": "Slackbot" }),
      ),
    ).resolves.toMatchObject({ recorded: true });
    expect(findFirst).toHaveBeenCalledOnce();
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("keeps a signed campaign distribution only after workspace validation", async () => {
    const initialHeaders = new Headers();
    const context = resolvePublicAnalyticsContext(initialHeaders);
    const cookie = publicAnalyticsContextCookies(
      initialHeaders,
      context,
      resolveAttribution({
        knownContext: { source: "qr", medium: "qr", channel: "qr" },
      }),
      { campaignId: "campaign_1", campaignAssetId: "distribution_1" },
    )
      .map((value) => value.split(";")[0])
      .join("; ");
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          workspaceId: "workspace_1",
          campaignId: null,
        }),
      },
      campaign: { findFirst: vi.fn().mockResolvedValue({ id: "campaign_1" }) },
      campaignAsset: {
        findFirst: vi.fn().mockResolvedValue({ id: "distribution_1" }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await recordPublicSmartCardEvent(
      {
        event: "card_view",
        slug: "ana-silva",
        source: "qr",
        visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
      },
      new Headers({ cookie }),
    );

    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign_1",
        campaignAssetId: "distribution_1",
      }),
    );
  });
});

describe("Smart Card contact capture", () => {
  it("does not emit lead_created when an existing contact shares details again", async () => {
    const contactEventCreate = vi.fn().mockResolvedValue({});
    const updateContact = vi.fn().mockResolvedValue({ id: "contact_1" });
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: {
        findFirst: vi.fn().mockResolvedValue({
          id: "card_1",
          slug: "ana-silva",
          workspaceId: "workspace_1",
          campaignId: null,
          firstName: "Ana",
          lastName: "Silva",
          company: "",
        }),
      },
      $transaction: vi.fn(async (operation) =>
        operation({
          audienceContact: {
            findFirst: vi.fn().mockResolvedValue({
              id: "contact_1",
              creationSource: "form",
              customFields: {},
              firstSource: null,
              firstMedium: null,
              firstChannel: null,
              firstCampaign: null,
            }),
            update: updateContact,
          },
          smartCardContactExchange: {
            create: vi.fn().mockResolvedValue({ id: "exchange_1" }),
          },
          audienceContactEvent: { create: contactEventCreate },
        }),
      ),
    } as unknown as ReturnType<typeof getPrisma>);

    await captureSmartCardContact(
      "ana-silva",
      {
        values: { firstName: "Maria", email: "maria@example.com" },
        intent: "Conhecer produto",
        source: "instagram",
        visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
        consent: true,
      },
      new Headers(),
    );

    expect(recordAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "form_submit" }),
    );
    expect(contactEventCreate).toHaveBeenCalledTimes(1);
    expect(updateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstSource: "direct",
          lastSource: "direct",
        }),
      }),
    );
  });
});
