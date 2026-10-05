import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import {
  analyticsGoals,
  analyticsOverview,
  analyticsTimeseries,
} from "@/modules/analytics/queries";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("analytics overview", () => {
  it("scopes every metric query to the actor workspace and keeps Free comparison unavailable", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const groupBy = vi.fn().mockResolvedValue([]);
    vi.mocked(getPrisma).mockReturnValue({
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ plan: "free", trial: null }),
      },
      workspace: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ timezone: "America/Sao_Paulo" }),
      },
      analyticsEvent: { count, groupBy },
      analyticsConversion: { count },
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

describe("analytics goals", () => {
  it("uses conversion records and keeps goal metrics inside the actor workspace", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([{ goalId: "goal_1", _count: { _all: 3 } }])
      .mockResolvedValueOnce([
        { goalId: "goal_1", visitorId: "visitor_1" },
        { goalId: "goal_1", visitorId: "visitor_2" },
      ]);
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "goal_1",
        name: "Lead capturado",
        goalType: "LEAD_CREATED",
        isPrimary: true,
      },
    ]);
    vi.mocked(getPrisma).mockReturnValue({
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          plan: "free",
          trial: null,
        }),
      },
      workspace: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ timezone: "America/Sao_Paulo" }),
      },
      analyticsConversion: { groupBy },
      analyticsGoal: { findMany },
    } as unknown as ReturnType<typeof getPrisma>);

    const result = await analyticsGoals(
      { userId: "user_1", workspaceId: "workspace_1", role: "owner" },
      {},
    );

    expect(result.items).toEqual([
      {
        goalId: "goal_1",
        name: "Lead capturado",
        goalType: "LEAD_CREATED",
        isPrimary: true,
        conversions: 3,
        visitors: 2,
        conversionRate: 150,
      },
    ]);
    expect(result.primary?.goalId).toBe("goal_1");
    for (const call of groupBy.mock.calls)
      expect(call[0].where).toMatchObject({ workspaceId: "workspace_1" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "workspace_1" }),
      }),
    );
  });
});

describe("analytics timeseries", () => {
  it("returns timezone-bucketed daily aggregates without deriving conversions from clicks", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          date: "2026-10-02",
          name: "smart_page_view",
          count: 2 as unknown as bigint,
        },
        {
          date: "2026-10-02",
          name: "link_click",
          count: 1 as unknown as bigint,
        },
      ])
      .mockResolvedValueOnce([
        { date: "2026-10-02", visitorId: "visitor_1" },
        { date: "2026-10-02", visitorId: "visitor_2" },
      ])
      .mockResolvedValueOnce([
        { date: "2026-10-02", count: 1 as unknown as bigint },
      ]);
    vi.mocked(getPrisma).mockReturnValue({
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          plan: "premium",
          trial: null,
        }),
      },
      workspace: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ timezone: "America/Sao_Paulo" }),
      },
      $queryRaw: queryRaw,
    } as unknown as ReturnType<typeof getPrisma>);

    const result = await analyticsTimeseries(
      { userId: "user_1", workspaceId: "workspace_1", role: "owner" },
      {
        from: new Date("2026-10-02T00:00:00.000Z"),
        to: new Date("2026-10-02T00:00:00.000Z"),
      },
    );

    expect(result.range).toMatchObject({
      timezone: "America/Sao_Paulo",
      granularity: "day",
    });
    expect(result.points).toEqual([
      { date: "2026-10-02", visitors: 2, views: 2, clicks: 1, conversions: 1 },
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });
});
