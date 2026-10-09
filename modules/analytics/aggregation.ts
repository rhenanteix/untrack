import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { AnalyticsAssetType, UniversalEventName } from "./event-types";

type AggregateEvent = {
  workspaceId?: string;
  occurredAt: Date;
  name: UniversalEventName;
  assetType?: AnalyticsAssetType;
  assetId?: string;
  source?: string;
  channel?: string;
  campaignId?: string;
  country?: string;
  deviceType?: string;
  isBot: boolean;
};

function bucketStart(date: Date, granularity: "hour" | "day") {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  if (granularity === "day") bucket.setUTCHours(0);
  return bucket;
}

function dimensions(event: AggregateEvent) {
  return [
    ["event", event.name],
    [
      "asset",
      event.assetType && event.assetId
        ? `${event.assetType}:${event.assetId}`
        : undefined,
    ],
    ["source", event.source],
    ["channel", event.channel],
    ["campaign", event.campaignId],
    ["country", event.country],
    ["device", event.deviceType],
  ] as const;
}

/**
 * Shared dimension buckets. Legacy callers isolate failures; Connect supplies its
 * transaction so buckets, events, goals and queue acknowledgement commit together.
 */
export async function aggregateAnalyticsEvent(
  event: AggregateEvent,
  db: Pick<Prisma.TransactionClient, "analyticsAggregate"> = getPrisma(),
) {
  if (!event.workspaceId) return;
  const workspaceId = event.workspaceId;
  const records = ["hour", "day"] as const;
  await Promise.all(
    records.flatMap((granularity) =>
      dimensions(event).flatMap(([dimension, dimensionValue]) =>
        dimensionValue
          ? [
              db.analyticsAggregate.upsert({
                where: {
                  workspaceId_bucketStart_granularity_eventName_dimension_dimensionValue_isBot:
                    {
                      workspaceId,
                      bucketStart: bucketStart(event.occurredAt, granularity),
                      granularity,
                      eventName: event.name,
                      dimension,
                      dimensionValue,
                      isBot: event.isBot,
                    },
                },
                update: { count: { increment: 1 } },
                create: {
                  workspaceId,
                  bucketStart: bucketStart(event.occurredAt, granularity),
                  granularity,
                  eventName: event.name,
                  dimension,
                  dimensionValue,
                  isBot: event.isBot,
                  count: 1,
                },
              }),
            ]
          : [],
      ),
    ),
  );
}
