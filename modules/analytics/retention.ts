import { getPrisma } from "@/lib/prisma";

const defaultRetentionDays = 365;

export function analyticsRetentionDays() {
  const configured = Number(process.env.ANALYTICS_RETENTION_DAYS);
  return Number.isInteger(configured) && configured >= 30 && configured <= 1_825
    ? configured
    : defaultRetentionDays;
}

function retentionCutoff(now: Date) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - analyticsRetentionDays());
  return cutoff;
}

/** Removes expired raw data while preserving non-identifying aggregate totals. */
export async function purgeExpiredAnalytics(now = new Date()) {
  const cutoff = retentionCutoff(now);
  return getPrisma().$transaction(async (tx) => {
    const [events, sessions, visitors, aggregates] = await Promise.all([
      tx.analyticsEvent.deleteMany({ where: { occurredAt: { lt: cutoff } } }),
      tx.analyticsSession.deleteMany({
        where: { lastActivityAt: { lt: cutoff } },
      }),
      tx.analyticsVisitor.deleteMany({ where: { lastSeenAt: { lt: cutoff } } }),
      tx.analyticsAggregate.deleteMany({
        where: { bucketStart: { lt: cutoff } },
      }),
    ]);
    return {
      cutoff: cutoff.toISOString(),
      events: events.count,
      sessions: sessions.count,
      visitors: visitors.count,
      aggregates: aggregates.count,
    };
  });
}

/** Deletes a visitor's raw, workspace-scoped analytics trail on a valid request. */
export async function deleteAnalyticsVisitor(
  workspaceId: string,
  visitorId: string,
) {
  return getPrisma().$transaction(async (tx) => {
    const visitor = await tx.analyticsVisitor.findFirst({
      where: { id: visitorId, workspaceId },
      select: { id: true },
    });
    if (!visitor) return false;
    await tx.analyticsEvent.deleteMany({ where: { workspaceId, visitorId } });
    await tx.analyticsVisitor.delete({ where: { id: visitor.id } });
    return true;
  });
}