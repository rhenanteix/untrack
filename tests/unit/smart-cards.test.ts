import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { recordPublicSmartCardEvent } from "@/modules/smart-cards/events";
import {
  smartCardContactFormSchema,
  smartCardInputSchema,
  smartCardSlugSchema,
} from "@/modules/smart-cards/schemas";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

beforeEach(() => {
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-with-enough-entropy-for-hashing",
  );
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
  it("records a privacy-safe event with the card and action context", async () => {
    const create = vi.fn().mockResolvedValue({});
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "card_1", workspaceId: "workspace_1" }),
      },
      smartCardAction: {
        findFirst: vi.fn().mockResolvedValue({ id: "action_1" }),
      },
      analyticsEvent: { create },
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

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "whatsapp_click",
        metadata: { path: "/c/ana-silva", source: "qr" },
        workspaceId: "workspace_1",
        smartCardId: "card_1",
        smartCardActionId: "action_1",
        referrer: "evento.example",
        device: "Celular",
        visitorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(
      "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
    );
  });

  it("ignores preview bots before querying a card", async () => {
    const findFirst = vi.fn();
    vi.mocked(getPrisma).mockReturnValue({
      smartCard: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartCardEvent(
        {
          event: "card_view",
          slug: "ana-silva",
          visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
          source: "direct",
        },
        new Headers({ "user-agent": "Slackbot" }),
      ),
    ).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
