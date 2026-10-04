import { ApiError } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import {
  getAccountAccess,
  resolveTrialStatus,
  trialExpiresAt,
  type AccountAccess,
} from "./account-access";

const trialSelect = {
  status: true,
  startedAt: true,
  expiresAt: true,
  usedAt: true,
  cancelledAt: true,
} as const;

type TrialOrigin = "account" | "signup";

export async function startTrial(
  userId: string,
  origin: TrialOrigin = "account",
  now = new Date(),
): Promise<AccountAccess> {
  return getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true, trial: { select: trialSelect } },
    });
    const currentStatus = resolveTrialStatus(user.trial, now);
    if (user.plan === "premium")
      throw new ApiError(
        409,
        "TRIAL_NOT_ELIGIBLE",
        "Contas Premium não precisam de período de teste.",
      );
    if (user.trial?.usedAt || currentStatus !== "none")
      throw new ApiError(
        409,
        "TRIAL_ALREADY_USED",
        "O período de teste desta conta já foi utilizado.",
      );

    const expiresAt = trialExpiresAt(now);
    const trial = user.trial
      ? await tx.userTrial.update({
          where: { userId },
          data: {
            status: "active",
            startedAt: now,
            expiresAt,
            usedAt: now,
            cancelledAt: null,
          },
          select: trialSelect,
        })
      : await tx.userTrial.create({
          data: {
            userId,
            status: "active",
            startedAt: now,
            expiresAt,
            usedAt: now,
          },
          select: trialSelect,
        });
    await tx.analyticsEvent.create({
      data: {
        name: "trial_started",
        origin: "server",
        metadata: { origin },
      },
    });
    return getAccountAccess({ plan: user.plan, trial }, now);
  });
}

export async function cancelTrial(userId: string) {
  return getPrisma().userTrial.updateMany({
    where: { userId, status: "active" },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
}

export async function expireTrial(userId: string, now = new Date()) {
  return getPrisma().$transaction(async (tx) => {
    const result = await tx.userTrial.updateMany({
      where: { userId, status: "active", expiresAt: { lte: now } },
      data: { status: "expired" },
    });
    if (result.count)
      await tx.analyticsEvent.create({
        data: {
          name: "trial_expired",
          origin: "server",
          metadata: {},
        },
      });
    return result;
  });
}

export async function grantPremium(userId: string) {
  return getPrisma().user.update({
    where: { id: userId },
    data: { plan: "premium" },
    select: { id: true, plan: true },
  });
}