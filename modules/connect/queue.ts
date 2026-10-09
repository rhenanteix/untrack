import { randomUUID } from "node:crypto";
import { Prisma, type ConnectReceipt } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { audit, type Actor } from "@/modules/workspaces/context";
import { connectSystem, connectWorkspace, json } from "./database";
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  RAW_RETENTION_MS,
  retryDelayMs,
} from "./contract";
import { normalizeAndProject, RejectedEvent } from "./normalization";
import { connectLog } from "./telemetry";

export type ClaimedReceipt = Pick<
  ConnectReceipt,
  | "id"
  | "workspaceId"
  | "sourceConnectionId"
  | "leaseToken"
  | "attempts"
  | "replayCount"
  | "correlationId"
>;

/** Leases are persisted before processing; a process crash consumes an attempt. */
export async function claimReceipts(
  limit = 20,
  now = new Date(),
): Promise<ClaimedReceipt[]> {
  return connectSystem(async (tx) => {
    const expired = await tx.$queryRaw<
      Array<Pick<ConnectReceipt, "id" | "attempts" | "replayCount">>
    >`SELECT "id", "attempts", "replayCount" FROM "ConnectReceipt" WHERE "state" = 'processing' AND "leaseUntil" <= ${now} LIMIT 100 FOR UPDATE SKIP LOCKED`;
    for (const receipt of expired) {
      await tx.connectDeliveryAttempt.updateMany({
        where: {
          receiptId: receipt.id,
          number: receipt.attempts,
          state: "processing",
        },
        data: {
          state: "lease_expired",
          finishedAt: now,
          errorCode: "LEASE_EXPIRED",
        },
      });
      if (receipt.attempts >= MAX_ATTEMPTS * (receipt.replayCount + 1))
        await tx.connectReceipt.updateMany({
          where: {
            id: receipt.id,
            state: "processing",
            leaseUntil: { lte: now },
          },
          data: {
            state: "dead_letter",
            errorCode: "LEASE_EXPIRED",
            leaseToken: null,
            leaseUntil: null,
          },
        });
    }
    const token = randomUUID();
    const leaseUntil = new Date(now.getTime() + LEASE_MS);
    const batch = Math.max(1, Math.min(50, Math.floor(limit)));
    const rows = await tx.$queryRaw<ClaimedReceipt[]>`
      WITH candidates AS (
        SELECT r."id" FROM "ConnectReceipt" r
        JOIN "ConnectSource" s ON s."id" = r."sourceConnectionId" AND s."workspaceId" = r."workspaceId"
        WHERE s."enabled" = true AND r."expiresAt" > ${now} AND r."rawExpiresAt" > ${now}
        AND r."attempts" < ${MAX_ATTEMPTS} * (r."replayCount" + 1)
        AND ((r."state" = 'queued' AND r."nextAttemptAt" <= ${now})
          OR (r."state" = 'processing' AND r."leaseUntil" <= ${now}))
        ORDER BY r."nextAttemptAt", r."id" LIMIT ${batch} FOR UPDATE OF r SKIP LOCKED
      )
      UPDATE "ConnectReceipt" r SET "state" = 'processing', "attempts" = r."attempts" + 1,
        "leaseToken" = ${token}, "leaseUntil" = ${leaseUntil}
      FROM candidates c WHERE r."id" = c."id"
      RETURNING r."id", r."workspaceId", r."sourceConnectionId", r."leaseToken", r."attempts", r."replayCount", r."correlationId"`;
    for (const row of rows) {
      // A large expired backlog can exceed the bounded sweep above. Close every
      // predecessor of a reclaimed row before opening its new attempt.
      await tx.connectDeliveryAttempt.updateMany({
        where: {
          receiptId: row.id,
          state: "processing",
          number: { lt: row.attempts },
        },
        data: {
          state: "lease_expired",
          finishedAt: now,
          errorCode: "LEASE_EXPIRED",
        },
      });
      await tx.connectDeliveryAttempt.create({
        data: {
          workspaceId: row.workspaceId,
          receiptId: row.id,
          number: row.attempts,
          state: "processing",
          startedAt: now,
        },
      });
    }
    return rows;
  });
}

function failureCode(error: unknown) {
  if (error instanceof RejectedEvent) return error.code;
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return `DB_${error.code}`;
  return "PROCESSING_FAILED";
}

export async function processReceipt(claim: ClaimedReceipt, now = new Date()) {
  const started = Date.now();
  try {
    const result = await connectSystem(async (tx) => {
      const rows = await tx.$queryRaw<
        ConnectReceipt[]
      >`SELECT * FROM "ConnectReceipt" WHERE "id" = ${claim.id} AND "workspaceId" = ${claim.workspaceId} FOR UPDATE`;
      const receipt = rows[0];
      if (
        !receipt ||
        receipt.state !== "processing" ||
        receipt.leaseToken !== claim.leaseToken
      )
        return "stale" as const;
      const source = await tx.connectSource.findFirst({
        where: {
          id: receipt.sourceConnectionId,
          workspaceId: receipt.workspaceId,
        },
      });
      if (!source?.enabled) throw new RejectedEvent("SOURCE_DISABLED");
      const projected = await normalizeAndProject(tx, source, receipt, now);
      await tx.connectReceipt.update({
        where: { id: receipt.id },
        data: {
          state: "normalized",
          normalizedPayload: json(projected.canonical),
          processedAt: now,
          analyticsEventId: projected.analyticsEventId,
          leaseToken: null,
          leaseUntil: null,
          errorCode: null,
        },
      });
      await tx.connectDeliveryAttempt.update({
        where: {
          receiptId_number: { receiptId: receipt.id, number: receipt.attempts },
        },
        data: { state: "processed", finishedAt: now },
      });
      await tx.$executeRaw`UPDATE "ConnectSource" SET "lastProcessedAt" = GREATEST("lastProcessedAt", ${now}),
        "eventWatermark" = GREATEST("eventWatermark", ${new Date(projected.canonical.occurred_at)}) WHERE "id" = ${source.id} AND "workspaceId" = ${source.workspaceId}`;
      return "normalized" as const;
    });
    if (result !== "stale")
      connectLog("normalized", {
        receiptId: claim.id,
        correlationId: claim.correlationId,
        sourceConnectionId: claim.sourceConnectionId,
        workspaceId: claim.workspaceId,
        attempt: claim.attempts,
        durationMs: Date.now() - started,
      });
    return result;
  } catch (error) {
    // The failed projection transaction rolls back all event/conversion/bucket writes.
    const code = failureCode(error);
    const rejected = error instanceof RejectedEvent;
    const exhausted = claim.attempts >= MAX_ATTEMPTS * (claim.replayCount + 1);
    const state = rejected ? "rejected" : exhausted ? "dead_letter" : "queued";
    const result = await connectSystem(async (tx) => {
      const updated = await tx.connectReceipt.updateMany({
        where: {
          id: claim.id,
          workspaceId: claim.workspaceId,
          state: "processing",
          leaseToken: claim.leaseToken,
        },
        data: {
          state,
          errorCode: code,
          leaseToken: null,
          leaseUntil: null,
          nextAttemptAt: new Date(
            now.getTime() +
              retryDelayMs(claim.attempts - claim.replayCount * MAX_ATTEMPTS),
          ),
          ...(rejected
            ? {
                rawPayload: Prisma.DbNull,
                processedAt: now,
                expiresAt: new Date(now.getTime() + RAW_RETENTION_MS),
              }
            : {}),
        },
      });
      if (!updated.count) return "stale" as const;
      await tx.connectDeliveryAttempt.updateMany({
        where: {
          receiptId: claim.id,
          workspaceId: claim.workspaceId,
          number: claim.attempts,
        },
        data: {
          state: rejected ? "rejected" : exhausted ? "dead_letter" : "retry",
          errorCode: code,
          finishedAt: now,
        },
      });
      return state;
    });
    connectLog(result === "queued" ? "retry" : result, {
      receiptId: claim.id,
      correlationId: claim.correlationId,
      sourceConnectionId: claim.sourceConnectionId,
      workspaceId: claim.workspaceId,
      attempt: claim.attempts,
      code,
    });
    return result;
  }
}

export async function drainConnectQueue(limit = 20) {
  // Bound the invocation; unclaimed rows remain durable for the next scheduled call.
  const claims = await claimReceipts(limit);
  const results: string[] = [];
  for (const claim of claims) results.push(await processReceipt(claim));
  return {
    claimed: claims.length,
    normalized: results.filter((r) => r === "normalized").length,
    retried: results.filter((r) => r === "queued").length,
    rejected: results.filter((r) => r === "rejected").length,
    deadLetter: results.filter((r) => r === "dead_letter").length,
  };
}

export function replayDeadLetter(
  actor: Actor,
  receiptId: string,
  now = new Date(),
) {
  return connectWorkspace(actor, "manage", async (tx) => {
    const rows = await tx.$queryRaw<
      ConnectReceipt[]
    >`SELECT * FROM "ConnectReceipt" WHERE "id" = ${receiptId} AND "workspaceId" = ${actor.workspaceId} FOR UPDATE`;
    const receipt = rows[0];
    if (!receipt)
      throw new ApiError(
        404,
        "RECEIPT_NOT_FOUND",
        "Recebimento não encontrado.",
      );
    if (
      receipt.state !== "dead_letter" ||
      !receipt.rawPayload ||
      receipt.rawExpiresAt <= now
    )
      throw new ApiError(
        409,
        "REPLAY_NOT_AVAILABLE",
        "Replay indisponível para este recebimento.",
      );
    await tx.connectReceipt.update({
      where: { id: receipt.id },
      data: {
        state: "queued",
        replayCount: { increment: 1 },
        nextAttemptAt: now,
        errorCode: null,
        leaseToken: null,
        leaseUntil: null,
      },
    });
    await audit(tx, actor, "connect.receipt.replayed", receipt.id, {
      sourceConnectionId: receipt.sourceConnectionId,
    });
    return { receiptId, state: "queued" };
  });
}
