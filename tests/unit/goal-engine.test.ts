import { describe, expect, it, vi } from "vitest";
import {
  GoalEngine,
  type GoalEventContext,
} from "@/modules/analytics/goal-engine";

const occurredAt = new Date("2026-10-04T14:32:00.000Z");

function eventContext(
  overrides: Partial<GoalEventContext> = {},
): GoalEventContext {
  return {
    name: "whatsapp_click",
    workspaceId: "workspace_a",
    visitorId: "visitor_a",
    sessionId: "session_a",
    assetType: "smart_page",
    assetId: "page_a",
    campaignId: "campaign_october",
    attribution: {
      source: "instagram",
      medium: "organic",
      channel: "organic_social",
      campaign: "outubro",
    },
    firstTouchSource: "instagram",
    firstTouchMedium: "organic",
    firstTouchChannel: "organic_social",
    firstTouchCampaign: "outubro",
    occurredAt,
    device: { deviceType: "mobile", os: "ios", browser: "safari" },
    bot: { isBot: false },
    isTest: false,
    utm: { source: "instagram", medium: "organic", campaign: "outubro" },
    ...overrides,
  };
}

function transaction(goals: unknown[], existing: { id: string } | null = null) {
  return {
    analyticsGoal: { findMany: vi.fn().mockResolvedValue(goals) },
    analyticsConversion: {
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: "conversion_1" }),
    },
    analyticsEvent: {
      create: vi.fn().mockResolvedValue({ id: "goal_completed_1" }),
    },
  };
}

function goal(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal_whatsapp",
    workspaceId: "workspace_a",
    goalType: "WHATSAPP_CLICK",
    scopeType: "ASSET",
    scopeId: "page_a",
    conditions: { assetType: "smart_page" },
    ...overrides,
  };
}

describe("GoalEngine", () => {
  it("creates one attributed conversion for a WhatsApp click on its scoped Smart Page", async () => {
    const tx = transaction([goal()]);
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_1", eventId: "public_event_1" },
        eventContext(),
      ),
    ).resolves.toBe(1);

    expect(tx.analyticsGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace_a",
          status: "ACTIVE",
          eventName: "whatsapp_click",
        }),
      }),
    );
    expect(tx.analyticsConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          goalId: "goal_whatsapp",
          eventId: "event_1",
          source: "instagram",
          medium: "organic",
          channel: "organic_social",
          campaignId: "campaign_october",
          firstTouchSource: "instagram",
        }),
      }),
    );
  });

  it("does not create a second conversion when the same event already completed the Goal", async () => {
    const tx = transaction([goal()], { id: "conversion_1" });
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_1", eventId: "public_event_1" },
        eventContext(),
      ),
    ).resolves.toBe(0);
    expect(tx.analyticsConversion.create).not.toHaveBeenCalled();
  });

  it("does not match a WhatsApp click on a different Smart Page", async () => {
    const tx = transaction([goal()]);
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_2", eventId: "public_event_2" },
        eventContext({ assetId: "page_b" }),
      ),
    ).resolves.toBe(0);
    expect(tx.analyticsConversion.create).not.toHaveBeenCalled();
  });

  it("queries only active Goals, so paused Goals produce no conversion", async () => {
    const tx = transaction([]);
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_3", eventId: "public_event_3" },
        eventContext(),
      ),
    ).resolves.toBe(0);
    expect(tx.analyticsGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("records QR scans as QR_SCAN conversions without turning them into leads", async () => {
    const tx = transaction([
      goal({
        id: "goal_qr",
        goalType: "QR_SCAN",
        scopeId: "qr_a",
        conditions: { assetType: "qr_code" },
      }),
    ]);
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_4", eventId: "public_event_4" },
        eventContext({
          name: "qr_scan",
          assetType: "qr_code",
          assetId: "qr_a",
        }),
      ),
    ).resolves.toBe(1);
    expect(tx.analyticsConversion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: { goalType: "QR_SCAN" } }),
      }),
    );
  });

  it("never completes a Goal from another workspace even if it is returned unexpectedly", async () => {
    const tx = transaction([goal({ workspaceId: "workspace_b" })]);
    await expect(
      GoalEngine.record(
        tx as never,
        { id: "event_5", eventId: "public_event_5" },
        eventContext(),
      ),
    ).resolves.toBe(0);
    expect(tx.analyticsConversion.create).not.toHaveBeenCalled();
  });
});
