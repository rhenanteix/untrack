import type { AnalyticsEventName } from "./analytics-events";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  occurredAt: Date;
  metadata?: Record<string, string | number | boolean>;
}

export interface AnalyticsSink {
  track(event: AnalyticsEvent): Promise<void>;
}

const noopSink: AnalyticsSink = { async track() {} };

const consoleSink: AnalyticsSink = {
  async track(event) {
    console.info("analytics", JSON.stringify(event));
  },
};

const prismaSink: AnalyticsSink = {
  async track(event) {
    const { getPrisma } = await import("./prisma");
    const { workspaceId, ...metadata } = event.metadata ?? {};
    await getPrisma().analyticsEvent.create({
      data: {
        name: event.name,
        occurredAt: event.occurredAt,
        metadata,
        ...(typeof workspaceId === "string" ? { workspaceId } : {}),
      },
    });
  },
};

function configuredSink(): AnalyticsSink {
  if (process.env.ANALYTICS_PERSISTENCE === "prisma") return prismaSink;
  if (process.env.ANALYTICS_CONSOLE === "true") return consoleSink;
  return noopSink;
}

export async function track(
  name: AnalyticsEventName,
  metadata?: AnalyticsEvent["metadata"],
): Promise<void> {
  try {
    await configuredSink().track({ name, metadata, occurredAt: new Date() });
  } catch (error) {
    console.error("Analytics event was not recorded", error);
  }
}
