import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import {
  getAudienceOverview,
  parseAudienceContactFilters,
} from "@/modules/audience/service";
import type { Actor } from "@/modules/workspaces/context";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

describe("Audience overview", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("counts newly identified contacts by creation date and derives conversion rate from real conversions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T14:24:00.000Z"));
    const count = vi
      .fn()
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    vi.mocked(getPrisma).mockReturnValue({
      audienceContact: {
        count,
        groupBy: vi.fn().mockResolvedValue([
          { firstSource: "instagram", _count: { _all: 4 } },
        ]),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      getAudienceOverview(
        { workspaceId: "workspace_1" } as Actor,
        { period: "30d" },
      ),
    ).resolves.toEqual({
      total: 8,
      newContacts: 2,
      converted: 2,
      conversionRate: 25,
      topSources: [{ source: "instagram", count: 4 }],
    });

    const acquisitionQuery = count.mock.calls[1]?.[0]?.where;
    expect(JSON.stringify(acquisitionQuery)).toContain("createdAt");
    expect(JSON.stringify(acquisitionQuery)).not.toContain("audienceStatus");
  });

  it("accepts workspace-scoped distribution and custom date filters", () => {
    expect(
      parseAudienceContactFilters({
        distribution: "distribution_1",
        conversion: "with",
        period: "custom",
        from: "2026-10-01",
        to: "2026-10-05",
        sort: "oldest",
      }),
    ).toMatchObject({
      campaignAssetId: "distribution_1",
      conversion: "with",
      period: "custom",
      from: "2026-10-01",
      to: "2026-10-05",
      sort: "oldest",
    });
  });
});