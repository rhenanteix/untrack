import { describe, expect, it } from "vitest";
import {
  getAccountAccess,
  trialExpiresAt,
  type AccountTrialRecord,
} from "@/modules/billing/account-access";

const startedAt = new Date("2026-10-04T12:00:00.000Z");

function activeTrial(): AccountTrialRecord {
  return {
    status: "active",
    startedAt,
    expiresAt: trialExpiresAt(startedAt),
    usedAt: startedAt,
    cancelledAt: null,
  };
}

describe("account access", () => {
  it("keeps a newly created account Free", () => {
    expect(getAccountAccess({ plan: "free" }, startedAt)).toMatchObject({
      basePlan: "free",
      effectivePlan: "free",
      accessSource: "free",
      trialStatus: "none",
    });
  });

  it("does not grant Premium from a legacy Premium workspace", () => {
    const legacyWorkspace = { plan: "premium" };
    expect(legacyWorkspace.plan).toBe("premium");
    expect(getAccountAccess({ plan: "free" }, startedAt)).toMatchObject({
      effectivePlan: "free",
      accessSource: "free",
    });
  });

  it("grants Premium access during a 30 day trial without changing the base plan", () => {
    const access = getAccountAccess(
      { plan: "free", trial: activeTrial() },
      startedAt,
    );
    expect(access).toMatchObject({
      basePlan: "free",
      effectivePlan: "premium",
      accessSource: "trial",
      trialStatus: "active",
      daysRemaining: 30,
    });
  });

  it("keeps the trial active after 29 days and expires exactly at its timestamp", () => {
    const trial = activeTrial();
    const afterTwentyNineDays = new Date(
      startedAt.getTime() + 29 * 24 * 60 * 60 * 1000,
    );
    expect(getAccountAccess({ plan: "free", trial }, afterTwentyNineDays)).toMatchObject({
      effectivePlan: "premium",
      trialStatus: "active",
      daysRemaining: 1,
    });
    expect(getAccountAccess({ plan: "free", trial }, trial.expiresAt!)).toMatchObject({
      effectivePlan: "free",
      trialStatus: "expired",
      daysRemaining: null,
    });
  });

  it("does not let an expired trial override a paid Premium plan", () => {
    const trial = activeTrial();
    const afterThirtyOneDays = new Date(
      startedAt.getTime() + 31 * 24 * 60 * 60 * 1000,
    );
    expect(getAccountAccess({ plan: "premium", trial }, afterThirtyOneDays)).toMatchObject({
      basePlan: "premium",
      effectivePlan: "premium",
      accessSource: "subscription",
      trialStatus: "expired",
    });
  });
});