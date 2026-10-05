import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { aggregateAnalyticsEvent } from "./aggregation";
import { resolveAttribution, type AttributionInput } from "./attribution";
import { classifyBot, classifyDevice } from "./device";
import { GoalEngine } from "./goal-engine";
import { reportAnalyticsHealth } from "./health";
import { analyticsSessionTimeoutMinutes } from "./session";
import type {
  AnalyticsAssetType,
  AnalyticsEventOrigin,
  UniversalEventName,
} from "./event-types";

const sensitiveMetadataKey =
  /email|phone|whatsapp|address|name|message|token|password/i;

type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export type RecordAnalyticsEventInput = {
  name: UniversalEventName;
  workspaceId?: string;
  userId?: string;
  audienceContactId?: string;
  eventId?: string;
  visitorKey?: string;
  sessionKey?: string;
  assetType?: AnalyticsAssetType;
  assetId?: string;
  elementType?: string;
  elementId?: string;
  campaignId?: string;
  smartPageId?: string;
  smartPageBlockId?: string;
  smartCardId?: string;
  smartCardActionId?: string;
  path?: string;
  destinationUrl?: string;
  attribution?: AttributionInput;
  metadata?: AnalyticsMetadata;
  origin?: AnalyticsEventOrigin;
  isTest?: boolean;
  occurredAt?: Date;
  headers?: Headers;
  includeIdentity?: boolean;
};

export type RecordAnalyticsEventResult = {
  eventId: string;
  recorded: boolean;
  duplicate: boolean;
  visitorId?: string;
  sessionId?: string;
};

function hashIdentifier(value: string | undefined) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!value || !secret) return undefined;
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

function dateBucket(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function hostname(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? url.hostname.toLowerCase().slice(0, 253)
      : undefined;
  } catch {
    return undefined;
  }
}

function pathOnly(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, "https://linkor.invalid");
    return url.pathname.slice(0, 2048);
  } catch {
    return undefined;
  }
}

function destinationOnly(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().slice(0, 4096);
  } catch {
    return undefined;
  }
}

function cleanMetadata(metadata: AnalyticsMetadata | undefined) {
  return Object.fromEntries(
    Object.entries(metadata ?? {})
      .filter(
        ([key, value]) =>
          Boolean(key) &&
          key.length <= 80 &&
          !sensitiveMetadataKey.test(key) &&
          (typeof value === "string"
            ? value.length <= 500
            : typeof value === "number" ||
              typeof value === "boolean" ||
              value === null),
      )
      .slice(0, 20),
  );
}

function legacyDevice(
  deviceType: ReturnType<typeof classifyDevice>["deviceType"],
) {
  return {
    mobile: "Celular",
    desktop: "Desktop",
    tablet: "Tablet",
    other: "Outro",
  }[deviceType];
}

async function resolveIdentity(
  tx: Prisma.TransactionClient,
  input: RecordAnalyticsEventInput,
  occurredAt: Date,
  firstTouch: ReturnType<typeof resolveAttribution>,
  referrer: string | undefined,
  path: string | undefined,
) {
  if (!input.workspaceId) return {};
  const visitorHash = hashIdentifier(input.visitorKey);
  if (!visitorHash) return {};
  const visitor = await tx.analyticsVisitor.upsert({
    where: {
      workspaceId_visitorHash: { workspaceId: input.workspaceId, visitorHash },
    },
    update: {
      lastSeenAt: occurredAt,
      lastTouchSource: firstTouch.source,
      lastTouchMedium: firstTouch.medium,
      lastTouchChannel: firstTouch.channel,
      lastTouchCampaign: firstTouch.campaign,
      lastTouchAt: occurredAt,
    },
    create: {
      workspaceId: input.workspaceId,
      visitorHash,
      firstTouchSource: firstTouch.source,
      firstTouchMedium: firstTouch.medium,
      firstTouchChannel: firstTouch.channel,
      firstTouchCampaign: firstTouch.campaign,
      firstTouchAt: occurredAt,
      lastTouchSource: firstTouch.source,
      lastTouchMedium: firstTouch.medium,
      lastTouchChannel: firstTouch.channel,
      lastTouchCampaign: firstTouch.campaign,
      lastTouchAt: occurredAt,
      lastSeenAt: occurredAt,
    },
  });
  const sessionHash = hashIdentifier(input.sessionKey);
  if (!sessionHash) return { visitorId: visitor.id, visitorHash };

  const expiresBefore = new Date(
    occurredAt.getTime() - analyticsSessionTimeoutMinutes() * 60_000,
  );
  const previous = await tx.analyticsSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      visitorId: visitor.id,
      sessionHash,
    },
    orderBy: { lastActivityAt: "desc" },
  });
  const session =
    previous && previous.lastActivityAt >= expiresBefore
      ? await tx.analyticsSession.update({
          where: { id: previous.id },
          data: { lastActivityAt: occurredAt },
        })
      : await tx.analyticsSession.create({
          data: {
            workspaceId: input.workspaceId,
            visitorId: visitor.id,
            sessionHash,
            startedAt: occurredAt,
            lastActivityAt: occurredAt,
            landingPage: path,
            entryReferrer: referrer,
            initialSource: firstTouch.source,
            initialMedium: firstTouch.medium,
            initialChannel: firstTouch.channel,
            initialCampaign: firstTouch.campaign,
          },
        });
  return {
    visitorId: visitor.id,
    visitorHash,
    sessionId: session.id,
    firstTouchSource: visitor.firstTouchSource,
    firstTouchMedium: visitor.firstTouchMedium,
    firstTouchChannel: visitor.firstTouchChannel,
    firstTouchCampaign: visitor.firstTouchCampaign,
  };
}

/** Records a pseudonymous universal event and treats repeated event IDs as idempotent. */
export async function recordAnalyticsEvent(
  input: RecordAnalyticsEventInput,
): Promise<RecordAnalyticsEventResult> {
  const eventId = input.eventId ?? randomUUID();
  const occurredAt = input.occurredAt ?? new Date();
  const isTest = input.isTest || process.env.ANALYTICS_TEST_MODE === "true";
  const referrer = hostname(input.headers?.get("referer"));
  const attribution = resolveAttribution({
    ...input.attribution,
    referrer: input.attribution?.referrer ?? input.headers?.get("referer"),
  });
  const device = classifyDevice(input.headers?.get("user-agent"));
  const bot: ReturnType<typeof classifyBot> = input.headers
    ? classifyBot(input.headers)
    : { isBot: false };
  const path = pathOnly(input.path);

  try {
    const persisted = await getPrisma().$transaction(async (tx) => {
      const identity = await resolveIdentity(
        tx,
        input,
        occurredAt,
        attribution,
        referrer,
        path,
      );
      const event = await tx.analyticsEvent.create({
        data: {
          eventId,
          name: input.name,
          origin: input.origin ?? "server",
          occurredAt,
          metadata: cleanMetadata(input.metadata),
          workspaceId: input.workspaceId,
          userId: input.userId,
          audienceContactId: input.audienceContactId,
          visitorId: identity.visitorId,
          sessionId: identity.sessionId,
          assetType: input.assetType,
          assetId: input.assetId,
          elementType: input.elementType?.slice(0, 40),
          elementId: input.elementId?.slice(0, 255),
          campaignId: input.campaignId?.slice(0, 255),
          smartPageId: input.smartPageId,
          smartPageBlockId: input.smartPageBlockId,
          smartCardId: input.smartCardId,
          smartCardActionId: input.smartCardActionId,
          path,
          destinationUrl: destinationOnly(input.destinationUrl),
          day: dateBucket(occurredAt),
          visitorHash: identity.visitorHash,
          referrer,
          device: legacyDevice(device.deviceType),
          source: attribution.source,
          medium: attribution.medium,
          channel: attribution.channel,
          utmSource: input.attribution?.utmSource?.slice(0, 120),
          utmMedium: input.attribution?.utmMedium?.slice(0, 120),
          utmCampaign: input.attribution?.utmCampaign?.slice(0, 120),
          utmContent: input.attribution?.utmContent?.slice(0, 120),
          utmTerm: input.attribution?.utmTerm?.slice(0, 120),
          deviceType: device.deviceType,
          os: device.os,
          browser: device.browser,
          isBot: bot.isBot,
          botType: bot.botType,
          isTest,
        },
      });
      const completedGoals = input.workspaceId
        ? await GoalEngine.record(tx, event, {
            name: input.name,
            workspaceId: input.workspaceId,
            userId: input.userId,
            audienceContactId: input.audienceContactId,
            assetType: input.assetType,
            assetId: input.assetId,
            elementType: input.elementType,
            elementId: input.elementId,
            campaignId: input.campaignId,
            path,
            attribution,
            ...identity,
            occurredAt,
            referrer,
            device,
            bot,
            isTest,
            utm: {
              source: input.attribution?.utmSource,
              medium: input.attribution?.utmMedium,
              campaign: input.attribution?.utmCampaign,
              content: input.attribution?.utmContent,
              term: input.attribution?.utmTerm,
            },
          })
        : 0;
      return {
        eventId,
        recorded: true,
        duplicate: false,
        completedGoals,
        visitorId: identity.visitorId,
        sessionId: identity.sessionId,
      };
    });
    if (!isTest) {
      void aggregateAnalyticsEvent({
        workspaceId: input.workspaceId,
        occurredAt,
        name: input.name,
        assetType: input.assetType,
        assetId: input.assetId,
        source: attribution.source,
        channel: attribution.channel,
        campaignId: input.campaignId,
        isBot: bot.isBot,
      }).catch((error) =>
        console.error("Analytics aggregation was not recorded", error),
      );
      for (let index = 0; index < persisted.completedGoals; index += 1)
        void aggregateAnalyticsEvent({
          workspaceId: input.workspaceId,
          occurredAt,
          name: "goal_completed",
          assetType: input.assetType,
          assetId: input.assetId,
          source: attribution.source,
          channel: attribution.channel,
          campaignId: input.campaignId,
          isBot: bot.isBot,
        }).catch((error) =>
          console.error("Analytics aggregation was not recorded", error),
        );
    }
    reportAnalyticsHealth("events_received", {
      eventName: input.name,
      isTest,
    });
    if (bot.isBot)
      reportAnalyticsHealth("bot_events", { eventName: input.name, isTest });
    return {
      eventId: persisted.eventId,
      recorded: persisted.recorded,
      duplicate: persisted.duplicate,
      ...(input.includeIdentity
        ? {
            visitorId: persisted.visitorId,
            sessionId: persisted.sessionId,
          }
        : {}),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      reportAnalyticsHealth("duplicate_events", {
        eventName: input.name,
        isTest,
      });
      return { eventId, recorded: false, duplicate: true };
    }
    reportAnalyticsHealth("ingestion_errors", {
      eventName: input.name,
      isTest,
    });
    throw error;
  }
}
