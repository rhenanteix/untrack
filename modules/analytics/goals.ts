import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { track } from "@/lib/analytics";
import { ApiError } from "@/lib/api-response";
import { canUse } from "@/modules/billing/entitlements";
import {
  audit,
  releaseQuota,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import type { GoalConditions } from "./goal-engine";
import type { AnalyticsAssetType } from "./event-types";

const goalTypes = [
  "LINK_CLICK",
  "WHATSAPP_CLICK",
  "FORM_SUBMIT",
  "LEAD_CREATED",
  "QR_SCAN",
  "PAGE_VIEW",
  "BUTTON_CLICK",
] as const;

const scopeTypes = ["WORKSPACE", "CAMPAIGN", "ASSET", "ELEMENT"] as const;
const assetTypes = ["smart_page", "smart_card", "link", "qr_code"] as const;

export const analyticsGoalDefinitions = {
  LINK_CLICK: { eventName: "link_click", label: "Clique em link", assetTypes },
  WHATSAPP_CLICK: {
    eventName: "whatsapp_click",
    label: "Contato pelo WhatsApp",
    assetTypes: ["smart_page", "smart_card", "link"],
  },
  FORM_SUBMIT: {
    eventName: "form_submit",
    label: "Formulário enviado",
    assetTypes: ["smart_page", "smart_card"],
  },
  LEAD_CREATED: {
    eventName: "lead_created",
    label: "Lead capturado",
    assetTypes: ["smart_page", "smart_card"],
  },
  QR_SCAN: {
    eventName: "qr_scan",
    label: "QR Code escaneado",
    assetTypes: ["qr_code"],
  },
  PAGE_VIEW: {
    eventName: "smart_page_view",
    label: "Visita à página",
    assetTypes: ["smart_page"],
  },
  BUTTON_CLICK: {
    eventName: "button_click",
    label: "Clique em botão",
    assetTypes: ["smart_page", "smart_card"],
  },
} as const;

const conditionsSchema = z
  .object({
    assetType: z.enum(assetTypes).optional(),
    elementType: z.string().trim().min(1).max(40).optional(),
    elementId: z.string().trim().min(1).max(255).optional(),
  })
  .strict()
  .default({});

export const analyticsGoalInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    goalType: z.enum(goalTypes),
    scopeType: z.enum(scopeTypes).default("WORKSPACE"),
    scopeId: z.string().trim().min(1).max(255).optional(),
    conditions: conditionsSchema,
    isPrimary: z.boolean().default(false),
  })
  .strict()
  .superRefine((input, context) => {
    const definition = analyticsGoalDefinitions[input.goalType];
    if (input.scopeType === "WORKSPACE" && input.scopeId)
      context.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Um objetivo global não precisa de um ativo específico.",
      });
    if (input.scopeType !== "WORKSPACE" && !input.scopeId)
      context.addIssue({
        code: "custom",
        path: ["scopeId"],
        message: "Selecione onde este objetivo será aplicado.",
      });
    if (
      ["ASSET", "ELEMENT"].includes(input.scopeType) &&
      !input.conditions.assetType
    )
      context.addIssue({
        code: "custom",
        path: ["conditions", "assetType"],
        message: "Selecione o tipo do ativo.",
      });
    if (
      input.conditions.assetType &&
      !(definition.assetTypes as readonly string[]).includes(
        input.conditions.assetType,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["conditions", "assetType"],
        message: "Esse objetivo não é compatível com o ativo selecionado.",
      });
  });

const viewEventNames = ["page_view", "smart_page_view", "smart_card_view"];

function conditionsFor(value: unknown): GoalConditions {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  const conditions = value as Record<string, unknown>;
  return {
    ...(typeof conditions.assetType === "string"
      ? { assetType: conditions.assetType as AnalyticsAssetType }
      : {}),
    ...(typeof conditions.elementType === "string"
      ? { elementType: conditions.elementType }
      : {}),
    ...(typeof conditions.elementId === "string"
      ? { elementId: conditions.elementId }
      : {}),
  };
}

function visitorScopeWhere(goal: {
  scopeType: string;
  scopeId: string | null;
  conditions: unknown;
}) {
  const conditions = conditionsFor(goal.conditions);
  return {
    ...(goal.scopeType === "CAMPAIGN" && goal.scopeId
      ? { campaignId: goal.scopeId }
      : {}),
    ...(goal.scopeType === "ASSET" && goal.scopeId
      ? { assetId: goal.scopeId }
      : {}),
    ...(goal.scopeType === "ELEMENT" && goal.scopeId
      ? { elementId: goal.scopeId }
      : {}),
    ...(conditions.assetType ? { assetType: conditions.assetType } : {}),
    ...(conditions.elementType ? { elementType: conditions.elementType } : {}),
    ...(conditions.elementId ? { elementId: conditions.elementId } : {}),
  };
}

async function assertScope(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  input: z.infer<typeof analyticsGoalInputSchema>,
) {
  if (input.scopeType === "WORKSPACE") return;
  let found: { id: string } | null = null;
  if (input.scopeType === "CAMPAIGN")
    found = await tx.campaign.findFirst({
      where: { id: input.scopeId, workspaceId },
      select: { id: true },
    });
  if (input.scopeType === "ASSET") {
    const assetType = input.conditions.assetType;
    const where = { id: input.scopeId, workspaceId };
    found =
      assetType === "smart_page"
        ? await tx.smartPage.findFirst({ where, select: { id: true } })
        : assetType === "smart_card"
          ? await tx.smartCard.findFirst({ where, select: { id: true } })
          : assetType === "link"
            ? await tx.shortLink.findFirst({ where, select: { id: true } })
            : assetType === "qr_code"
              ? await tx.qrAsset.findFirst({ where, select: { id: true } })
              : null;
  }
  if (input.scopeType === "ELEMENT") {
    found =
      input.conditions.assetType === "smart_page"
        ? await tx.smartPageBlock.findFirst({
            where: { id: input.scopeId, smartPage: { workspaceId } },
            select: { id: true },
          })
        : input.conditions.assetType === "smart_card"
          ? await tx.smartCardAction.findFirst({
              where: { id: input.scopeId, smartCard: { workspaceId } },
              select: { id: true },
            })
          : null;
  }
  if (!found)
    throw new ApiError(
      404,
      "GOAL_SCOPE_NOT_FOUND",
      "O ativo, elemento ou campanha não pertence a este workspace.",
    );
}

function scopeWhere(goal: { scopeType: string; scopeId: string | null }) {
  return {
    scopeType: goal.scopeType as "WORKSPACE" | "CAMPAIGN" | "ASSET" | "ELEMENT",
    scopeId: goal.scopeId,
  };
}

export async function listAnalyticsGoals(actor: Actor) {
  const db = getPrisma();
  const goals = await db.analyticsGoal.findMany({
    where: { workspaceId: actor.workspaceId },
    include: { _count: { select: { conversions: true } } },
    orderBy: { createdAt: "desc" },
  });
  const visitorCounts = await Promise.all(
    goals.map((goal) =>
      db.analyticsEvent.groupBy({
        by: ["visitorId"],
        where: {
          workspaceId: actor.workspaceId,
          name: { in: viewEventNames },
          visitorId: { not: null },
          isBot: false,
          isTest: false,
          ...visitorScopeWhere(goal),
        },
      }),
    ),
  );
  const scopeNames = await Promise.all(
    goals.map(async (goal) => {
      if (goal.scopeType === "WORKSPACE") return "Todos os ativos";
      if (goal.scopeType === "CAMPAIGN") {
        const campaign = await db.campaign.findFirst({
          where: { id: goal.scopeId ?? "", workspaceId: actor.workspaceId },
          select: { name: true },
        });
        return campaign?.name ?? "Campanha específica";
      }
      if (goal.scopeType === "ELEMENT") return "Elemento específico";
      const assetType = conditionsFor(goal.conditions).assetType;
      const asset =
        assetType === "smart_page"
          ? await db.smartPage.findFirst({
              where: { id: goal.scopeId ?? "", workspaceId: actor.workspaceId },
              select: { title: true },
            })
          : assetType === "smart_card"
            ? await db.smartCard.findFirst({
                where: {
                  id: goal.scopeId ?? "",
                  workspaceId: actor.workspaceId,
                },
                select: { firstName: true, lastName: true },
              })
            : assetType === "link"
              ? await db.shortLink.findFirst({
                  where: {
                    id: goal.scopeId ?? "",
                    workspaceId: actor.workspaceId,
                  },
                  select: { slug: true },
                })
              : assetType === "qr_code"
                ? await db.qrAsset.findFirst({
                    where: {
                      id: goal.scopeId ?? "",
                      workspaceId: actor.workspaceId,
                    },
                    select: { name: true },
                  })
                : null;
      if (!asset) return "Ativo específico";
      if ("title" in asset) return asset.title;
      if ("slug" in asset) return asset.slug;
      if ("firstName" in asset)
        return `${asset.firstName} ${asset.lastName}`.trim();
      return asset.name;
    }),
  );
  return goals.map((goal, index) => ({
    ...goal,
    conversions: goal._count.conversions,
    scopeName: scopeNames[index],
    uniqueVisitors: visitorCounts[index].length,
    conversionRate: visitorCounts[index].length
      ? Number(
          (
            (goal._count.conversions / visitorCounts[index].length) *
            100
          ).toFixed(1),
        )
      : 0,
  }));
}

export async function createAnalyticsGoal(
  actor: Actor,
  input: z.infer<typeof analyticsGoalInputSchema>,
) {
  const goal = await workspaceTransaction(
    actor,
    "write",
    async (tx, access) => {
      if (!canUse(access, "goals"))
        throw new ApiError(
          403,
          "GOALS_UNAVAILABLE",
          "Objetivos não estão disponíveis nesta conta.",
        );
      await assertScope(tx, actor.workspaceId, input);
      await reserveQuota(tx, actor.workspaceId, access, "goals");
      if (input.isPrimary)
        await tx.analyticsGoal.updateMany({
          where: {
            workspaceId: actor.workspaceId,
            ...scopeWhere({
              scopeType: input.scopeType,
              scopeId: input.scopeId ?? null,
            }),
          },
          data: { isPrimary: false },
        });
      const goal = await tx.analyticsGoal.create({
        data: {
          workspaceId: actor.workspaceId,
          name: input.name,
          description: input.description,
          goalType: input.goalType,
          status: "ACTIVE",
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          eventName: analyticsGoalDefinitions[input.goalType].eventName,
          conditions: input.conditions,
          isPrimary: input.isPrimary,
        },
      });
      await audit(tx, actor, "goal.created", goal.id, {
        goalType: goal.goalType,
        scopeType: goal.scopeType,
        scopeId: goal.scopeId,
      });
      return goal;
    },
  );
  await track("goal_created", { workspaceId: actor.workspaceId });
  return goal;
}

export async function updateAnalyticsGoalStatus(
  actor: Actor,
  goalId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
) {
  const goal = await workspaceTransaction(
    actor,
    "write",
    async (tx, access) => {
      const current = await tx.analyticsGoal.findFirst({
        where: { id: goalId, workspaceId: actor.workspaceId },
      });
      if (!current)
        throw new ApiError(404, "GOAL_NOT_FOUND", "Objetivo não encontrado.");
      if (current.status === "ARCHIVED" && status !== "ARCHIVED")
        await reserveQuota(tx, actor.workspaceId, access, "goals");
      if (current.status !== "ARCHIVED" && status === "ARCHIVED")
        await releaseQuota(tx, actor.workspaceId, "goals");
      const updated = await tx.analyticsGoal.update({
        where: { id: current.id },
        data: {
          status,
          ...(status === "ARCHIVED" ? { isPrimary: false } : {}),
        },
      });
      await audit(tx, actor, `goal.${status.toLowerCase()}`, updated.id, {});
      return updated;
    },
  );
  await track(
    status === "PAUSED"
      ? "goal_paused"
      : status === "ARCHIVED"
        ? "goal_archived"
        : "goal_activated",
    { workspaceId: actor.workspaceId },
  );
  return goal;
}

export async function setAnalyticsGoalPrimary(
  actor: Actor,
  goalId: string,
  isPrimary: boolean,
) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const current = await tx.analyticsGoal.findFirst({
      where: { id: goalId, workspaceId: actor.workspaceId },
    });
    if (!current)
      throw new ApiError(404, "GOAL_NOT_FOUND", "Objetivo não encontrado.");
    if (current.status === "ARCHIVED" && isPrimary)
      throw new ApiError(
        400,
        "GOAL_ARCHIVED",
        "Reative o objetivo antes de defini-lo como principal.",
      );
    if (isPrimary)
      await tx.analyticsGoal.updateMany({
        where: { workspaceId: actor.workspaceId, ...scopeWhere(current) },
        data: { isPrimary: false },
      });
    const updated = await tx.analyticsGoal.update({
      where: { id: current.id },
      data: { isPrimary },
    });
    await audit(tx, actor, "goal.primary_updated", updated.id, { isPrimary });
    return updated;
  });
}

export async function listGoalScopeOptions(actor: Actor) {
  const db = getPrisma();
  const [smartPages, smartCards, links, qrCodes, campaigns] = await Promise.all(
    [
      db.smartPage.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      db.smartCard.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      db.shortLink.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, slug: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      db.qrAsset.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.campaign.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ],
  );
  return {
    smart_page: smartPages.map(({ id, title }) => ({ id, name: title })),
    smart_card: smartCards.map(({ id, firstName, lastName }) => ({
      id,
      name: `${firstName} ${lastName}`.trim(),
    })),
    link: links.map(({ id, slug }) => ({ id, name: slug })),
    qr_code: qrCodes.map(({ id, name }) => ({ id, name })),
    campaign: campaigns,
  };
}
