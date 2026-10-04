import type { Plan } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type TrialStatus = "none" | "active" | "expired" | "cancelled";
export type AccessSource = "free" | "trial" | "subscription";

export type AccountTrialRecord = {
  status: TrialStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
  usedAt: Date | null;
  cancelledAt: Date | null;
};

export type AccountAccessRecord = {
  plan: Plan;
  trial?: AccountTrialRecord | null;
};

export type AccountAccess = {
  basePlan: Plan;
  effectivePlan: Plan;
  accessSource: AccessSource;
  trialStatus: TrialStatus;
  trialStartedAt: Date | null;
  trialExpiresAt: Date | null;
  daysRemaining: number | null;
};

export function trialExpiresAt(startedAt: Date) {
  return new Date(startedAt.getTime() + TRIAL_DURATION_MS);
}

export function resolveTrialStatus(
  trial: AccountTrialRecord | null | undefined,
  now = new Date(),
): TrialStatus {
  if (!trial || trial.status === "none") return "none";
  if (trial.status === "cancelled") return "cancelled";
  if (trial.status === "expired") return "expired";
  if (!trial.expiresAt || now >= trial.expiresAt) return "expired";
  return "active";
}

export function getAccountAccess(
  account: AccountAccessRecord,
  now = new Date(),
): AccountAccess {
  const trial = account.trial ?? null;
  const trialStatus = resolveTrialStatus(trial, now);
  const trialExpires = trial?.expiresAt ?? null;
  const daysRemaining =
    trialStatus === "active" && trialExpires
      ? Math.ceil((trialExpires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

  if (account.plan === "premium") {
    return {
      basePlan: account.plan,
      effectivePlan: "premium",
      accessSource: "subscription",
      trialStatus,
      trialStartedAt: trial?.startedAt ?? null,
      trialExpiresAt: trialExpires,
      daysRemaining,
    };
  }

  if (trialStatus === "active") {
    return {
      basePlan: account.plan,
      effectivePlan: "premium",
      accessSource: "trial",
      trialStatus,
      trialStartedAt: trial?.startedAt ?? null,
      trialExpiresAt: trialExpires,
      daysRemaining,
    };
  }

  return {
    basePlan: account.plan,
    effectivePlan: "free",
    accessSource: "free",
    trialStatus,
    trialStartedAt: trial?.startedAt ?? null,
    trialExpiresAt: trialExpires,
    daysRemaining,
  };
}

export async function getAccountAccessForUser(
  userId: string,
  now = new Date(),
) {
  const account = await getPrisma().user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      plan: true,
      trial: {
        select: {
          status: true,
          startedAt: true,
          expiresAt: true,
          usedAt: true,
          cancelledAt: true,
        },
      },
    },
  });
  return getAccountAccess(account, now);
}