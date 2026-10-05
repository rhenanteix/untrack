import { describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { refreshAudienceContactSummary } from "@/modules/audience/summary";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

function summaryDatabase({ conversions, interactions }: { conversions: number; interactions: number }) {
  const update = vi.fn().mockResolvedValue({});
  vi.mocked(getPrisma).mockReturnValue({
    audienceContact: {
      findFirst: vi.fn().mockResolvedValue({
        id: "contact_1",
        createdAt: new Date("2026-10-02T14:24:00.000Z"),
      }),
      update,
    },
    analyticsEvent: {
      aggregate: vi.fn().mockResolvedValue({
        _min: { occurredAt: new Date("2026-10-02T14:21:00.000Z") },
        _max: { occurredAt: new Date("2026-10-02T14:30:00.000Z") },
      }),
      count: vi.fn().mockResolvedValue(interactions),
    },
    smartPageFormSubmission: {
      aggregate: vi.fn().mockResolvedValue({
        _min: { submittedAt: new Date("2026-10-02T14:24:00.000Z") },
        _max: { submittedAt: new Date("2026-10-02T14:24:00.000Z") },
      }),
    },
    smartCardContactExchange: {
      aggregate: vi.fn().mockResolvedValue({
        _min: { capturedAt: null },
        _max: { capturedAt: null },
      }),
    },
    analyticsConversion: { count: vi.fn().mockResolvedValue(conversions) },
  } as unknown as ReturnType<typeof getPrisma>);
  return update;
}

describe("Audience Contact summary", () => {
  it("marks a contact converted and highly engaged only from real conversion and interaction records", async () => {
    const update = summaryDatabase({ conversions: 1, interactions: 2 });

    await refreshAudienceContactSummary("workspace_1", "contact_1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audienceStatus: "converted",
          engagementLevel: "high",
          conversionCount: 1,
          meaningfulInteractionCount: 2,
        }),
      }),
    );
  });

  it("keeps a newly identified contact at low engagement without later interactions", async () => {
    const update = summaryDatabase({ conversions: 0, interactions: 0 });

    await refreshAudienceContactSummary("workspace_1", "contact_1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audienceStatus: "new",
          engagementLevel: "low",
        }),
      }),
    );
  });
});