import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { recordPublicSmartCardEvent } from "@/modules/smart-cards/events";
import {
  smartCardContactFormSchema,
  smartCardInputSchema,
  smartCardSlugSchema,
} from "@/modules/smart-cards/schemas";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/modules/analytics/service", () => ({
  recordAnalyticsEvent: vi.fn(),
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
    });
    expect(card.slug).toBe("ana-silva");
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
    ).resolves.toBe(true);

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
    ).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledOnce();
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
