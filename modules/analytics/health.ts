export const analyticsHealthMetrics = [
  "events_received",
  "events_rejected",
  "duplicate_events",
  "bot_events",
  "ingestion_errors",
] as const;

export type AnalyticsHealthMetric = (typeof analyticsHealthMetrics)[number];

/** Emits bounded operational diagnostics without logging visitor or event IDs. */
export function reportAnalyticsHealth(
  metric: AnalyticsHealthMetric,
  detail: { eventName?: string; isTest?: boolean } = {},
) {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ANALYTICS_DEBUG !== "true"
  )
    return;
  console.info(
    "analytics_health",
    JSON.stringify({ metric, ...detail }),
  );
}