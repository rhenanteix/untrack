import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { analyticsOverview } from "@/modules/analytics/queries";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("analytics overview", () => {
  it("scopes every metric query to the actor workspace and keeps Free comparison unavailable", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const groupBy = vi.fn().mockResolvedValue([]);
    vi.mocked(getPrisma).mockReturnValue({
      user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ plan: "free", trial: null }) },
      analyticsEvent: { count, groupBy },
    } as unknown as ReturnType<typeof getPrisma>);

    const result = await analyticsOverview(
      { userId: "user_1", workspaceId: "workspace_1", role: "owner" },
      { assetType: "smart_page" },
    );

    expect(result.comparison).toEqual({
      visitors: null,
      views: null,
      clicks: null,
      conversions: null,
    });
    for (const call of [...count.mock.calls, ...groupBy.mock.calls])
      expect(call[0].where).toMatchObject({
        workspaceId: "workspace_1",
        assetType: "smart_page",
        isBot: false,
      });
  });
});