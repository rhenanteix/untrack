import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { recordPublicSmartPageEvent } from "@/modules/smart-pages/events";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
} from "@/modules/analytics/public-context";

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

describe("smart page analytics events", () => {
  it("routes a page view to the universal collector with its trusted asset", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartPageEvent(
        {
          event: "smart_page_view",
          slug: "minha-pagina",
          visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
        },
        new Headers({
          referer: "https://social.example/post?email=private@example.com",
          "user-agent": "Mozilla Mobile Android",
        }),
      ),
    ).resolves.toMatchObject({ recorded: true });

    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "smart_page_view",
        workspaceId: "workspace_1",
        assetType: "smart_page",
        assetId: "page_1",
        smartPageId: "page_1",
      }),
    );
  });

  it("records preview bots so standard analytics can exclude them", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" });
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartPageEvent(
        { event: "smart_page_view", slug: "minha-pagina" },
        new Headers({ "user-agent": "Slackbot" }),
      ),
    ).resolves.toMatchObject({ recorded: true });
    expect(findFirst).toHaveBeenCalledOnce();
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });

  it("records product events only for product blocks on the published page", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ id: "block_1", type: "product", link: null });
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
      smartPageBlock: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartPageEvent(
        {
          event: "link_in_bio_product_click",
          slug: "minha-pagina",
          blockId: "block_1",
          visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
        },
        new Headers({ "user-agent": "Mozilla Desktop" }),
      ),
    ).resolves.toMatchObject({ recorded: true });

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "block_1",
        smartPageId: "page_1",
        type: "product",
      }),
      select: {
        id: true,
        type: true,
        link: { select: { campaignId: true, destinationUrl: true } },
      },
    });
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "product_click",
        elementId: "block_1",
      }),
    );
  });

  it("keeps signed QR campaign and identity context through a Smart Page CTA", async () => {
    const initialHeaders = new Headers();
    const initial = resolvePublicAnalyticsContext(initialHeaders);
    const attribution = resolveAttribution({
      ...initial.attribution,
      knownContext: { source: "qr", medium: "qr", channel: "qr" },
    });
    const cookie = publicAnalyticsContextCookies(
      initialHeaders,
      initial,
      attribution,
      { campaignId: "campaign_1", qrContext: "event_stand" },
    )
      .map((item) => item.split(";")[0])
      .join("; ");
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
      smartPageBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: "block_1",
          type: "link",
          link: { campaignId: null, destinationUrl: "https://example.com" },
        }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await recordPublicSmartPageEvent(
      { event: "smart_block_clicked", slug: "minha-pagina", blockId: "block_1" },
      new Headers({ cookie }),
    );

    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "link_click",
        visitorKey: initial.identity.visitorId,
        sessionKey: initial.identity.sessionId,
        campaignId: "campaign_1",
        attribution: expect.objectContaining({ trustedContext: expect.any(Object) }),
      }),
    );
  });

  it("classifies a WhatsApp block as a WhatsApp click", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
      smartPageBlock: {
        findFirst: vi.fn().mockResolvedValue({
          id: "block_1",
          type: "whatsapp",
          link: null,
        }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await recordPublicSmartPageEvent(
      { event: "smart_block_clicked", slug: "minha-pagina", blockId: "block_1" },
      new Headers(),
    );

    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "whatsapp_click", elementId: "block_1" }),
    );
  });
});
