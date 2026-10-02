import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { recordPublicSmartPageEvent } from "@/modules/smart-pages/events";

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

describe("smart page analytics events", () => {
  it("records a page view with a hashed session and privacy-safe metadata", async () => {
    const create = vi.fn().mockResolvedValue({});
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
      analyticsEvent: { create },
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
    ).resolves.toBe(true);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "smart_page_view",
        metadata: { path: "/minha-pagina" },
        workspaceId: "workspace_1",
        smartPageId: "page_1",
        smartPageBlockId: null,
        referrer: "social.example",
        device: "Celular",
        visitorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });

  it("ignores preview bots before querying the page", async () => {
    const findFirst = vi.fn();
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      recordPublicSmartPageEvent(
        {
          event: "smart_page_view",
          slug: "minha-pagina",
          visitorId: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
        },
        new Headers({ "user-agent": "Slackbot" }),
      ),
    ).resolves.toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("records product events only for product blocks on the published page", async () => {
    const create = vi.fn().mockResolvedValue({});
    const findFirst = vi.fn().mockResolvedValue({ id: "block_1" });
    vi.mocked(getPrisma).mockReturnValue({
      smartPage: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "page_1", workspaceId: "workspace_1" }),
      },
      smartPageBlock: { findFirst },
      analyticsEvent: { create },
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
    ).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "block_1",
        smartPageId: "page_1",
        type: "product",
      }),
      select: { id: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "link_in_bio_product_click" }),
    });
  });
});
