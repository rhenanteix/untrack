import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { startTrial } from "@/modules/billing/trial-service";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("trial service", () => {
  it("records one 30 day trial without promoting the account plan", async () => {
    const startedAt = new Date("2026-10-04T12:00:00.000Z");
    const create = vi.fn().mockImplementation(({ data }) => data);
    const tx = {
      $queryRaw: vi.fn(),
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ plan: "free", trial: null }),
      },
      userTrial: { create },
      analyticsEvent: { create: vi.fn() },
    };
    vi.mocked(getPrisma).mockReturnValue({
      $transaction: vi.fn((work) => work(tx)),
    } as unknown as ReturnType<typeof getPrisma>);

    const access = await startTrial("user_1", "account", startedAt);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "user_1",
        status: "active",
        usedAt: startedAt,
        expiresAt: new Date("2026-11-03T12:00:00.000Z"),
      }),
    }));
    expect(access).toMatchObject({
      basePlan: "free",
      effectivePlan: "premium",
      accessSource: "trial",
    });
  });

  it("refuses a second trial for the same user", async () => {
    const usedAt = new Date("2026-09-01T12:00:00.000Z");
    const tx = {
      $queryRaw: vi.fn(),
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          plan: "free",
          trial: {
            status: "expired",
            startedAt: usedAt,
            expiresAt: new Date("2026-10-01T12:00:00.000Z"),
            usedAt,
            cancelledAt: null,
          },
        }),
      },
    };
    vi.mocked(getPrisma).mockReturnValue({
      $transaction: vi.fn((work) => work(tx)),
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(startTrial("user_1", "account", usedAt)).rejects.toMatchObject({
      code: "TRIAL_ALREADY_USED",
    });
  });
});