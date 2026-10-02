import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import {
  analyticsRetentionDays,
  deleteAnalyticsVisitor,
  purgeExpiredAnalytics,
} from "@/modules/analytics/retention";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("analytics retention", () => {
  it("uses a configurable, bounded retention period", () => {
    expect(analyticsRetentionDays()).toBe(365);
    vi.stubEnv("ANALYTICS_RETENTION_DAYS", "90");
    expect(analyticsRetentionDays()).toBe(90);
    vi.stubEnv("ANALYTICS_RETENTION_DAYS", "2");
    expect(analyticsRetentionDays()).toBe(365);
  });

  it("purges raw visitor data and old aggregates", async () => {
    const tx = {
      analyticsEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
      analyticsSession: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      analyticsVisitor: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      analyticsAggregate: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    };
    vi.mocked(getPrisma).mockReturnValue({
      $transaction: vi.fn((work) => work(tx)),
    } as unknown as ReturnType<typeof getPrisma>);
    await expect(
      purgeExpiredAnalytics(new Date("2026-10-02T00:00:00.000Z")),
    ).resolves.toMatchObject({ events: 3, sessions: 2, visitors: 1, aggregates: 4 });
  });

  it("deletes only a visitor owned by the supplied workspace", async () => {
    const tx = {
      analyticsVisitor: {
        findFirst: vi.fn().mockResolvedValue({ id: "visitor_1" }),
        delete: vi.fn(),
      },
      analyticsEvent: { deleteMany: vi.fn() },
    };
    vi.mocked(getPrisma).mockReturnValue({
      $transaction: vi.fn((work) => work(tx)),
    } as unknown as ReturnType<typeof getPrisma>);
    await expect(deleteAnalyticsVisitor("workspace_1", "visitor_1")).resolves.toBe(true);
    expect(tx.analyticsVisitor.findFirst).toHaveBeenCalledWith({
      where: { id: "visitor_1", workspaceId: "workspace_1" },
      select: { id: true },
    });
  });
});