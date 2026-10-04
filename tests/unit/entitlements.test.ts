import { describe, expect, it } from "vitest";
import {
  canUse,
  getAnalyticsHistoryDays,
  getLimit,
  hasReachedLimit,
} from "@/modules/billing/entitlements";

describe("LinkOr plan entitlements", () => {
  it("keeps Free useful while gating advanced features to Premium", () => {
    const free = { effectivePlan: "free" as const };
    const premium = { effectivePlan: "premium" as const };
    expect(getLimit(free, "links")).toBe(10);
    expect(getLimit(free, "smartPages")).toBe(1);
    expect(canUse(free, "advancedAnalytics")).toBe(false);
    expect(canUse(premium, "advancedAnalytics")).toBe(true);
    expect(canUse(premium, "advancedThemes")).toBe(true);
    expect(getAnalyticsHistoryDays(free)).toBe(7);
    expect(getAnalyticsHistoryDays(premium)).toBe(365);
  });

  it("reports when a real usage summary reaches a plan limit", () => {
    const usage = {
      links: 10,
      smartPages: 0,
      smartCards: 0,
      qrCodes: 0,
      campaigns: 0,
      audienceContacts: 0,
    };
    expect(hasReachedLimit({ effectivePlan: "free" }, "links", usage)).toBe(true);
    expect(hasReachedLimit({ effectivePlan: "premium" }, "links", usage)).toBe(false);
  });
});