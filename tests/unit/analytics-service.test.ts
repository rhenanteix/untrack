import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { aggregateAnalyticsEvent } from "@/modules/analytics/aggregation";
import { recordAnalyticsEvent } from "@/modules/analytics/service";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/modules/analytics/aggregation", () => ({
  aggregateAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "analytics-test-secret");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function eventTransaction(overrides: Record<string, unknown> = {}) {
  const tx = {
    analyticsVisitor: {
      upsert: vi.fn().mockResolvedValue({ id: "visitor_1" }),
    },
    analyticsSession: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "session_1" }),
      update: vi.fn(),
    },
    analyticsEvent: {
      create: vi
        .fn()
        .mockResolvedValue({ id: "event_row_1", eventId: "event_1" }),
    },
    analyticsGoal: { findMany: vi.fn().mockResolvedValue([]) },
    analyticsConversion: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    ...overrides,
  };
  vi.mocked(getPrisma).mockReturnValue({
    $transaction: vi.fn((work) => work(tx)),
  } as unknown as ReturnType<typeof getPrisma>);
  return tx;
}

describe("universal analytics collector", () => {
  it("persists a hashed visitor, a first session, attribution, and device details", async () => {
    const tx = eventTransaction();
    await expect(
      recordAnalyticsEvent({
        eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
        name: "link_click",
        workspaceId: "workspace_1",
        userId: "user_1",
        audienceContactId: "contact_1",
        visitorKey: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
        sessionKey: "c9227788-a9fb-462e-93da-c6197c0a33a0",
        assetType: "link",
        assetId: "link_1",
        attribution: { utmSource: "Instagram", utmMedium: "paid" },
        headers: new Headers({
          referer: "https://example.com/path?email=private@example.com",
          "user-agent": "Mozilla/5.0 (iPhone) Safari/604.1",
        }),
      }),
    ).resolves.toEqual({
      eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
      recorded: true,
      duplicate: false,
    });

    expect(tx.analyticsVisitor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_visitorHash: {
            workspaceId: "workspace_1",
            visitorHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        },
        create: expect.objectContaining({
          firstTouchSource: "instagram",
          firstTouchMedium: "paid",
          firstTouchChannel: "paid_social",
          lastTouchSource: "instagram",
          lastTouchMedium: "paid",
          lastTouchChannel: "paid_social",
        }),
      }),
    );
    expect(tx.analyticsSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId: "visitor_1",
          initialSource: "instagram",
          initialMedium: "paid",
          initialChannel: "paid_social",
        }),
      }),
    );
    expect(tx.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId: "visitor_1",
          sessionId: "session_1",
          userId: "user_1",
          audienceContactId: "contact_1",
          source: "instagram",
          channel: "paid_social",
          referrer: "example.com",
          deviceType: "mobile",
          os: "ios",
          browser: "safari",
        }),
      }),
    );
    expect(
      JSON.stringify(tx.analyticsEvent.create.mock.calls[0][0]),
    ).not.toContain("private@example.com");
    expect(aggregateAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "link_click",
        workspaceId: "workspace_1",
        source: "instagram",
        channel: "paid_social",
      }),
    );
  });

  it("starts a new session when the previous one expired", async () => {
    const tx = eventTransaction({
      analyticsSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: "session_old",
          lastActivityAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
        create: vi.fn().mockResolvedValue({ id: "session_new" }),
        update: vi.fn(),
      },
    });
    await recordAnalyticsEvent({
      name: "smart_page_view",
      workspaceId: "workspace_1",
      visitorKey: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
      sessionKey: "c9227788-a9fb-462e-93da-c6197c0a33a0",
    });
    expect(tx.analyticsSession.create).toHaveBeenCalledOnce();
    expect(tx.analyticsSession.update).not.toHaveBeenCalled();
  });

  it("reuses an active session for a later interaction by the same visitor", async () => {
    const tx = eventTransaction({
      analyticsSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: "session_active",
          lastActivityAt: new Date(),
        }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "session_active" }),
      },
    });
    await recordAnalyticsEvent({
      name: "link_click",
      workspaceId: "workspace_1",
      visitorKey: "d75f415d-9dbd-4a68-b6c2-975f32ed5b4c",
      sessionKey: "c9227788-a9fb-462e-93da-c6197c0a33a0",
    });
    expect(tx.analyticsSession.create).not.toHaveBeenCalled();
    expect(tx.analyticsSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "session_active" } }),
    );
    expect(tx.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sessionId: "session_active" }),
      }),
    );
  });

  it("marks bot traffic instead of discarding it", async () => {
    const tx = eventTransaction();
    await recordAnalyticsEvent({
      name: "qr_scan",
      workspaceId: "workspace_1",
      headers: new Headers({ "user-agent": "Slackbot 1.0" }),
    });
    expect(tx.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isBot: true, botType: "preview" }),
      }),
    );
  });

  it("treats a duplicate event id as idempotent", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      $transaction: vi.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
        }),
      ),
    } as unknown as ReturnType<typeof getPrisma>);
    await expect(
      recordAnalyticsEvent({
        eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
        name: "link_click",
      }),
    ).resolves.toEqual({
      eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
      recorded: false,
      duplicate: true,
    });
  });

  it("marks test events and excludes them from aggregate updates", async () => {
    const tx = eventTransaction();
    await recordAnalyticsEvent({
      name: "smart_page_view",
      workspaceId: "workspace_1",
      isTest: true,
    });
    expect(tx.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isTest: true }),
      }),
    );
    expect(aggregateAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("creates one conversion and a goal_completed event for a matching goal", async () => {
    const eventCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: "event_row_1", eventId: "event_1" })
      .mockResolvedValueOnce({
        id: "goal_event_row",
        eventId: "event_1:goal:goal_1",
      });
    const tx = eventTransaction({
      analyticsEvent: { create: eventCreate },
      analyticsGoal: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "goal_1",
            workspaceId: "workspace_1",
            goalType: "LEAD_CREATED",
            scopeType: "WORKSPACE",
            scopeId: null,
            conditions: {},
          },
        ]),
      },
    });
    await recordAnalyticsEvent({
      eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
      name: "lead_created",
      workspaceId: "workspace_1",
      assetType: "smart_card",
      assetId: "card_1",
      isTest: true,
    });
    expect(tx.analyticsConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          goalId: "goal_1",
          eventId: "event_row_1",
          source: "direct",
          medium: "none",
          channel: "direct",
        }),
      }),
    );
    expect(eventCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "goal_completed",
          metadata: { goalId: "goal_1" },
          isTest: true,
        }),
      }),
    );
  });
});
