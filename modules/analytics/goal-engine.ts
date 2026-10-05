import { Prisma } from "@prisma/client";
import type { Attribution } from "./attribution";
import type { AnalyticsAssetType, UniversalEventName } from "./event-types";

export const goalTypeByEvent = {
  link_click: "LINK_CLICK",
  whatsapp_click: "WHATSAPP_CLICK",
  form_submit: "FORM_SUBMIT",
  lead_created: "LEAD_CREATED",
  qr_scan: "QR_SCAN",
  page_view: "PAGE_VIEW",
  smart_page_view: "PAGE_VIEW",
  button_click: "BUTTON_CLICK",
} as const;

export type AnalyticsGoalType =
  (typeof goalTypeByEvent)[keyof typeof goalTypeByEvent];
export type AnalyticsGoalScopeType =
  "WORKSPACE" | "CAMPAIGN" | "ASSET" | "ELEMENT";

export type GoalConditions = {
  assetType?: AnalyticsAssetType;
  elementType?: string;
  elementId?: string;
};

export type GoalEventContext = {
  name: UniversalEventName;
  workspaceId: string;
  userId?: string;
  audienceContactId?: string;
  assetType?: AnalyticsAssetType;
  assetId?: string;
  elementType?: string;
  elementId?: string;
  campaignId?: string;
  campaignAssetId?: string;
  path?: string;
  attribution: Attribution;
  visitorId?: string;
  visitorHash?: string;
  sessionId?: string;
  firstTouchSource?: string | null;
  firstTouchMedium?: string | null;
  firstTouchChannel?: string | null;
  firstTouchCampaign?: string | null;
  occurredAt: Date;
  referrer?: string;
  device: {
    deviceType: string;
    os?: string;
    browser?: string;
  };
  bot: {
    isBot: boolean;
    botType?: string;
  };
  isTest: boolean;
  utm: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
    term?: string | null;
  };
};

type GoalCandidate = {
  id: string;
  workspaceId: string;
  goalType: string;
  scopeType: AnalyticsGoalScopeType;
  scopeId: string | null;
  conditions: Prisma.JsonValue;
};

function asConditions(value: Prisma.JsonValue): GoalConditions {
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

function legacyDevice(deviceType: GoalEventContext["device"]["deviceType"]) {
  return (
    {
      mobile: "Celular",
      desktop: "Desktop",
      tablet: "Tablet",
      other: "Outro",
    }[deviceType] ?? "Outro"
  );
}

export function goalMatchesEvent(goal: GoalCandidate, event: GoalEventContext) {
  const conditions = asConditions(goal.conditions);
  const expectedGoalType = Object.hasOwn(goalTypeByEvent, event.name)
    ? goalTypeByEvent[event.name as keyof typeof goalTypeByEvent]
    : undefined;
  const scopeMatches =
    goal.scopeType === "WORKSPACE" ||
    (goal.scopeType === "CAMPAIGN" && goal.scopeId === event.campaignId) ||
    (goal.scopeType === "ASSET" && goal.scopeId === event.assetId) ||
    (goal.scopeType === "ELEMENT" && goal.scopeId === event.elementId);
  return (
    goal.workspaceId === event.workspaceId &&
    expectedGoalType === goal.goalType &&
    scopeMatches &&
    (!conditions.assetType || conditions.assetType === event.assetType) &&
    (!conditions.elementType || conditions.elementType === event.elementType) &&
    (!conditions.elementId || conditions.elementId === event.elementId)
  );
}

function compatibleScopes(event: GoalEventContext) {
  return [
    { scopeType: "WORKSPACE" as const },
    ...(event.campaignId
      ? [{ scopeType: "CAMPAIGN" as const, scopeId: event.campaignId }]
      : []),
    ...(event.assetId
      ? [{ scopeType: "ASSET" as const, scopeId: event.assetId }]
      : []),
    ...(event.elementId
      ? [{ scopeType: "ELEMENT" as const, scopeId: event.elementId }]
      : []),
  ];
}

/** Evaluates user-defined Goals only after their source event has been persisted. */
export class GoalEngine {
  static async record(
    tx: Prisma.TransactionClient,
    event: { id: string; eventId: string },
    context: GoalEventContext,
  ) {
    if (context.name === "goal_completed") return 0;
    const goals = await tx.analyticsGoal.findMany({
      where: {
        workspaceId: context.workspaceId,
        status: "ACTIVE",
        eventName: context.name,
        OR: compatibleScopes(context),
      },
      select: {
        id: true,
        workspaceId: true,
        goalType: true,
        scopeType: true,
        scopeId: true,
        conditions: true,
      },
    });
    let completed = 0;
    for (const goal of goals as GoalCandidate[]) {
      if (!goalMatchesEvent(goal, context)) continue;
      const existing = await tx.analyticsConversion.findUnique({
        where: { goalId_eventId: { goalId: goal.id, eventId: event.id } },
        select: { id: true },
      });
      if (existing) continue;
      await tx.analyticsConversion.create({
        data: {
          workspaceId: context.workspaceId,
          goalId: goal.id,
          eventId: event.id,
          visitorId: context.visitorId,
          sessionId: context.sessionId,
          campaignId: context.campaignId,
          campaignAssetId: context.campaignAssetId,
          assetType: context.assetType,
          assetId: context.assetId,
          source: context.attribution.source,
          medium: context.attribution.medium,
          channel: context.attribution.channel,
          firstTouchSource:
            context.firstTouchSource ?? context.attribution.source,
          firstTouchMedium:
            context.firstTouchMedium ?? context.attribution.medium,
          firstTouchChannel:
            context.firstTouchChannel ?? context.attribution.channel,
          firstTouchCampaign:
            context.firstTouchCampaign ?? context.attribution.campaign,
          metadata: { goalType: goal.goalType },
          occurredAt: context.occurredAt,
          day: new Date(
            Date.UTC(
              context.occurredAt.getUTCFullYear(),
              context.occurredAt.getUTCMonth(),
              context.occurredAt.getUTCDate(),
            ),
          ),
          isBot: context.bot.isBot,
          isTest: context.isTest,
        },
      });
      await tx.analyticsEvent.create({
        data: {
          eventId: `${event.eventId}:goal:${goal.id}`,
          name: "goal_completed",
          origin: "server",
          occurredAt: context.occurredAt,
          metadata: { goalId: goal.id },
          workspaceId: context.workspaceId,
          userId: context.userId,
          audienceContactId: context.audienceContactId,
          visitorId: context.visitorId,
          sessionId: context.sessionId,
          assetType: context.assetType,
          assetId: context.assetId,
          campaignId: context.campaignId,
          campaignAssetId: context.campaignAssetId,
          goalId: goal.id,
          path: context.path,
          day: new Date(
            Date.UTC(
              context.occurredAt.getUTCFullYear(),
              context.occurredAt.getUTCMonth(),
              context.occurredAt.getUTCDate(),
            ),
          ),
          visitorHash: context.visitorHash,
          referrer: context.referrer,
          device: legacyDevice(context.device.deviceType),
          source: context.attribution.source,
          medium: context.attribution.medium,
          channel: context.attribution.channel,
          utmSource: context.utm.source?.slice(0, 120),
          utmMedium: context.utm.medium?.slice(0, 120),
          utmCampaign: context.utm.campaign?.slice(0, 120),
          utmContent: context.utm.content?.slice(0, 120),
          utmTerm: context.utm.term?.slice(0, 120),
          deviceType: context.device.deviceType,
          os: context.device.os,
          browser: context.device.browser,
          isBot: context.bot.isBot,
          botType: context.bot.botType,
          isTest: context.isTest,
        },
      });
      completed += 1;
    }
    return completed;
  }
}
