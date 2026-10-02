import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { canUse } from "@/modules/billing/entitlements";
import type { Actor } from "@/modules/workspaces/context";
import { workspaceTransaction } from "@/modules/workspaces/context";
import { analyticsAssetTypes, universalEventNames } from "./event-types";

export const analyticsGoalInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    eventName: z.enum(universalEventNames),
    assetType: z.enum(analyticsAssetTypes).optional(),
    assetId: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.assetId && !input.assetType)
      context.addIssue({
        code: "custom",
        path: ["assetType"],
        message: "Selecione o tipo do ativo específico.",
      });
  });

export async function listAnalyticsGoals(actor: Actor) {
  const { getPrisma } = await import("@/lib/prisma");
  return getPrisma().analyticsGoal.findMany({
    where: { workspaceId: actor.workspaceId },
    include: { _count: { select: { events: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAnalyticsGoal(
  actor: Actor,
  input: z.infer<typeof analyticsGoalInputSchema>,
) {
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    if (!canUse(plan, "advancedGoals"))
      throw new ApiError(
        403,
        "PREMIUM_REQUIRED",
        "Objetivos avançados estão disponíveis no Premium.",
      );
    return tx.analyticsGoal.create({
      data: { workspaceId: actor.workspaceId, ...input },
    });
  });
}

export async function deleteAnalyticsGoal(actor: Actor, goalId: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const result = await tx.analyticsGoal.deleteMany({
      where: { id: goalId, workspaceId: actor.workspaceId },
    });
    if (!result.count)
      throw new ApiError(404, "GOAL_NOT_FOUND", "Objetivo não encontrado.");
  });
}