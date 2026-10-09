import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { audit, type Actor } from "@/modules/workspaces/context";
import { connectSystem, connectWorkspace } from "./database";
import { connectLog } from "./telemetry";

export function sourceHealth(actor: Actor, now = new Date()) {
  return connectWorkspace(actor, "read", async (tx) => {
    const sources = await tx.connectSource.findMany({
      where: { workspaceId: actor.workspaceId },
      take: 100,
      orderBy: { key: "asc" },
    });
    const since = new Date(now.getTime() - 86_400_000);
    const results = [];
    for (const source of sources) {
      const where = {
        workspaceId: actor.workspaceId,
        sourceConnectionId: source.id,
      };
      const [states, traffic, retries, oldest, lag] = await Promise.all([
        tx.connectReceipt.groupBy({
          by: ["state"],
          where,
          _count: { _all: true },
        }),
        tx.connectReceipt.aggregate({
          where: { ...where, receivedAt: { gte: since } },
          _count: { _all: true },
          _sum: { duplicateCount: true, conflictCount: true },
        }),
        tx.connectDeliveryAttempt.groupBy({
          by: ["state"],
          where: {
            workspaceId: actor.workspaceId,
            receipt: {
              sourceConnectionId: source.id,
              workspaceId: actor.workspaceId,
            },
            startedAt: { gte: since },
          },
          _count: { _all: true },
        }),
        tx.connectReceipt.findFirst({
          where: { ...where, state: { in: ["queued", "processing"] } },
          orderBy: { receivedAt: "asc" },
          select: { receivedAt: true },
        }),
        tx.$queryRaw<
          Array<{ p95: number | null }>
        >`SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("processedAt" - "receivedAt")))::float8 AS p95 FROM "ConnectReceipt" WHERE "workspaceId" = ${actor.workspaceId} AND "sourceConnectionId" = ${source.id} AND "receivedAt" >= ${since} AND "state" = 'normalized'`,
      ]);
      const counts = Object.fromEntries(
        states.map((row) => [row.state, row._count._all]),
      );
      const failures = Object.fromEntries(
        retries.map((row) => [row.state, row._count._all]),
      );
      const oldestPendingSeconds = oldest
        ? Math.max(0, (now.getTime() - oldest.receivedAt.getTime()) / 1000)
        : 0;
      const overdue =
        source.expectedIntervalSeconds != null &&
        now.getTime() - (source.lastReceivedAt ?? source.createdAt).getTime() >
          source.expectedIntervalSeconds * 1000;
      results.push({
        sourceConnectionId: source.id,
        key: source.key,
        sourceType: source.type,
        trust: source.trust,
        projection: source.projection,
        status: !source.enabled
          ? "paused"
          : counts.dead_letter ||
              failures.retry ||
              failures.rejected ||
              counts.rejected ||
              oldestPendingSeconds > 300 ||
              overdue
            ? "degraded"
            : "healthy",
        counts,
        attemptsLast24h: failures,
        receivedLast24h: traffic._count._all,
        duplicateDeliveriesForReceiptsLast24h: traffic._sum.duplicateCount ?? 0,
        conflictingDeliveriesForReceiptsLast24h:
          traffic._sum.conflictCount ?? 0,
        oldestPendingSeconds,
        processingLagP95Seconds: lag[0]?.p95 ?? null,
        lastReceivedAt: source.lastReceivedAt,
        lastProcessedAt: source.lastProcessedAt,
        eventWatermark: source.eventWatermark,
        expectedIntervalSeconds: source.expectedIntervalSeconds,
        upstreamSyncStatus: "unknown", // Receiving events does not prove a provider's sync completed.
      });
    }
    return { measuredAt: now.toISOString(), sources: results };
  });
}

export function listReceipts(
  actor: Actor,
  sourceConnectionId: string,
  cursor?: string,
) {
  return connectWorkspace(actor, "read", async (tx) => {
    const source = await tx.connectSource.findFirst({
      where: { id: sourceConnectionId, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (!source)
      throw new ApiError(404, "SOURCE_NOT_FOUND", "Fonte não encontrada.");
    const previous = cursor
      ? await tx.connectReceipt.findFirst({
          where: {
            id: cursor,
            workspaceId: actor.workspaceId,
            sourceConnectionId,
          },
          select: { id: true, receivedAt: true },
        })
      : null;
    if (cursor && !previous)
      throw new ApiError(400, "INVALID_CURSOR", "Cursor inválido.");
    return tx.connectReceipt.findMany({
      where: {
        workspaceId: actor.workspaceId,
        sourceConnectionId,
        ...(previous
          ? {
              OR: [
                { receivedAt: { lt: previous.receivedAt } },
                { receivedAt: previous.receivedAt, id: { lt: previous.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        eventId: true,
        eventName: true,
        state: true,
        correlationId: true,
        receivedAt: true,
        occurredAt: true,
        processedAt: true,
        normalizedPayload: true,
        attempts: true,
        errorCode: true,
        analyticsEventId: true,
        replayCount: true,
        duplicateCount: true,
        conflictCount: true,
      },
    });
  });
}

export function setSourceEnabled(
  actor: Actor,
  sourceConnectionId: string,
  enabled: boolean,
) {
  return connectWorkspace(actor, "manage", async (tx) => {
    const updated = await tx.connectSource.updateMany({
      where: { id: sourceConnectionId, workspaceId: actor.workspaceId },
      data: { enabled },
    });
    if (!updated.count)
      throw new ApiError(404, "SOURCE_NOT_FOUND", "Fonte não encontrada.");
    await audit(
      tx,
      actor,
      "connect.source.status_changed",
      sourceConnectionId,
      { enabled },
    );
    return { sourceConnectionId, enabled };
  });
}

export async function purgeConnectData(now = new Date()) {
  const result = await connectSystem(async (tx) => {
    // A backlog beyond the raw retention window cannot be replayed; never claim success.
    await tx.connectReceipt.updateMany({
      where: {
        rawExpiresAt: { lte: now },
        state: { in: ["queued", "processing"] },
      },
      data: {
        state: "dead_letter",
        errorCode: "PAYLOAD_EXPIRED",
        leaseToken: null,
        leaseUntil: null,
      },
    });
    await tx.connectDeliveryAttempt.updateMany({
      where: {
        state: "processing",
        receipt: { errorCode: "PAYLOAD_EXPIRED", state: "dead_letter" },
      },
      data: {
        state: "dead_letter",
        errorCode: "PAYLOAD_EXPIRED",
        finishedAt: now,
      },
    });
    const raw = await tx.connectReceipt.updateMany({
      where: { rawExpiresAt: { lte: now }, rawPayload: { not: Prisma.DbNull } },
      data: { rawPayload: Prisma.DbNull },
    });
    const receipts = await tx.connectReceipt.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return { rawPayloadsPurged: raw.count, receiptsPurged: receipts.count };
  });
  connectLog("retention_completed");
  return result;
}
