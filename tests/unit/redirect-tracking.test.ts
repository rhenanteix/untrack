import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redirectResponse } from "@/modules/link-management/redirect";
import { publicLink } from "@/lib/short-links";
import { getPrisma } from "@/lib/prisma";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { cachedDestination } from "@/modules/link-management/cache";

vi.mock("next/server", () => ({
  after: (callback: () => unknown) => callback(),
}));
vi.mock("@/lib/app-url", () => ({
  appUrl: () => new URL("http://localhost:3000"),
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/lib/short-links", () => ({ publicLink: vi.fn() }));
vi.mock("@/modules/short-links/click-metadata", () => ({
  clickMetadata: vi.fn(() => null),
}));
vi.mock("@/modules/link-management/cache", () => ({
  cachedDestination: vi.fn(),
}));
vi.mock("@/modules/analytics/service", () => ({
  recordAnalyticsEvent: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", "analytics-test-secret");
  vi.mocked(publicLink).mockResolvedValue({
    id: "link_1",
    workspaceId: "workspace_1",
    campaignId: "campaign_1",
    destinationUrl: "https://linkor.test/minha-pagina",
  } as never);
  vi.mocked(getPrisma).mockReturnValue({
    qrAsset: {
      findFirst: vi.fn().mockResolvedValue({
        id: "qr_1",
        campaignId: "campaign_1",
        context: "event_stand",
      }),
    },
    campaignAsset: {
      findFirst: vi.fn().mockResolvedValue({
        id: "distribution_stand",
        campaignId: "campaign_1",
      }),
    },
  } as never);
  vi.mocked(recordAnalyticsEvent).mockResolvedValue({
    eventId: "event_1",
    recorded: true,
    duplicate: false,
  });
  vi.mocked(cachedDestination).mockResolvedValue(
    "https://linkor.test/minha-pagina",
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("tracked redirects", () => {
  it("sets a signed QR context before redirecting and records asynchronously", async () => {
    const response = await redirectResponse(
      new Request("http://localhost:3000/q/qr-stand"),
      "qr-stand",
      "qr",
      true,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://linkor.test/minha-pagina",
    );
    expect(response.headers.get("Set-Cookie")).toContain(
      "linkor_analytics_context=",
    );
    await vi.waitFor(() =>
      expect(recordAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "qr_scan",
          assetType: "qr_code",
          assetId: "qr_1",
          campaignId: "campaign_1",
          campaignAssetId: "distribution_stand",
          metadata: { qrContext: "event_stand" },
          attribution: expect.objectContaining({
            knownContext: { source: "qr", medium: "qr", channel: "qr" },
          }),
        }),
      ),
    );
  });

  it("does not create tracking context for HEAD requests", async () => {
    const response = await redirectResponse(
      new Request("http://localhost:3000/q/qr-stand", { method: "HEAD" }),
      "qr-stand",
      "qr",
      false,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(recordAnalyticsEvent).not.toHaveBeenCalled();
  });
});
