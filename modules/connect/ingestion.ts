import { randomUUID } from "node:crypto";
import { type ConnectSource } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { universalEventNames } from "@/modules/analytics/event-types";
import {
  inboundEventSchema,
  payloadDigest,
  temporalError,
  publicEventNames,
  EVENT_RETENTION_MS,
  RAW_RETENTION_MS,
} from "./contract";
import { connectSystem, json } from "./database";
import { connectLog } from "./telemetry";

export type IngestContext = {
  correlationId?: string;
  privacyDenied?: boolean;
  now?: Date;
};

export async function ingestEvent(
  source: ConnectSource,
  raw: unknown,
  context: IngestContext = {},
) {
  const now = context.now ?? new Date();
  const correlationId = context.correlationId ?? randomUUID();
  const parsed = inboundEventSchema.safeParse(raw);
  let errorCode: string | null = parsed.success
    ? temporalError(parsed.data, now)
    : "INVALID_EVENT";
  const input = parsed.success ? parsed.data : null;
  if (input && !source.allowedEvents.includes(input.event_name))
    errorCode = "EVENT_NOT_ALLOWED";
  if (
    input &&
    source.trust === "public" &&
    !publicEventNames.has(input.event_name)
  )
    errorCode = "EVENT_NOT_ALLOWED";
  if (context.privacyDenied || input?.consent_context?.analytics === "denied")
    errorCode = "CONSENT_DENIED";
  else if (
    input &&
    source.requiresConsent &&
    input.consent_context?.analytics !== "granted"
  )
    errorCode = "CONSENT_REQUIRED";
  // Existing session/campaign/asset IDs are only usable by the internal owned-asset adapter.
  if (
    input &&
    (input.session_id || input.campaign_id || input.asset_id) &&
    (source.type !== "owned_asset" || source.trust !== "internal")
  )
    errorCode = "UNTRUSTED_ASSOCIATION";
  if (input?.session_id && input.consent_context?.analytics !== "granted")
    errorCode = "IDENTITY_REQUIRES_CONSENT";

  const envelope =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const eventId = z.string().uuid().safeParse(envelope.event_id).data ?? null;
  const eventName =
    z.enum(universalEventNames).safeParse(envelope.event_name).data ?? null;
  const digest = payloadDigest(parsed.success ? parsed.data : raw);
  const idempotencyKey = eventId ?? `invalid:${digest}`;
  const state = errorCode ? "rejected" : "queued";
  const result = await connectSystem(async (tx) => {
    const currentSource = await tx.connectSource.findFirst({
      where: { id: source.id, workspaceId: source.workspaceId, enabled: true },
    });
    if (!currentSource)
      throw new ApiError(403, "SOURCE_DISABLED", "Fonte desativada.");
    if (currentSource.updatedAt.getTime() !== source.updatedAt.getTime())
      throw new ApiError(
        409,
        "SOURCE_POLICY_CHANGED",
        "Reenvie usando a política atual da fonte.",
      );
    // Upsert uses the database unique key; duplicate requests cannot enqueue another job.
    const created = await tx.connectReceipt.createMany({
      data: [
        {
          id: randomUUID(),
          workspaceId: source.workspaceId,
          sourceConnectionId: source.id,
          eventId,
          eventName,
          eventVersion: input?.event_version ?? null,
          idempotencyKey,
          payloadHash: digest,
          correlationId,
          state,
          rawPayload: errorCode
            ? json({ event_id: eventId, event_name: eventName, rejected: true })
            : json(input),
          occurredAt: input ? new Date(input.occurred_at) : null,
          receivedAt: now,
          processedAt: errorCode ? now : null,
          errorCode,
          rawExpiresAt: new Date(now.getTime() + RAW_RETENTION_MS),
          expiresAt: new Date(
            now.getTime() + (errorCode ? RAW_RETENTION_MS : EVENT_RETENTION_MS),
          ),
          nextAttemptAt: now,
        },
      ],
      skipDuplicates: true,
    });
    const receipt = await tx.connectReceipt.findUniqueOrThrow({
      where: {
        workspaceId_sourceConnectionId_idempotencyKey: {
          workspaceId: source.workspaceId,
          sourceConnectionId: source.id,
          idempotencyKey,
        },
      },
    });
    if (!created.count) {
      const conflict = receipt.payloadHash !== digest;
      await tx.connectReceipt.update({
        where: { id: receipt.id },
        data: conflict
          ? { conflictCount: { increment: 1 } }
          : { duplicateCount: { increment: 1 } },
      });
      return {
        receiptId: receipt.id,
        state: receipt.state,
        correlationId: receipt.correlationId,
        duplicate: !conflict,
        conflict,
        errorCode: conflict ? "IDEMPOTENCY_CONFLICT" : receipt.errorCode,
      };
    }
    await tx.$executeRaw`UPDATE "ConnectSource" SET "lastReceivedAt" = GREATEST("lastReceivedAt", ${now}) WHERE "id" = ${source.id} AND "workspaceId" = ${source.workspaceId}`;
    return {
      receiptId: receipt.id,
      state: receipt.state,
      correlationId,
      duplicate: false,
      conflict: false,
      errorCode,
    };
  });
  connectLog(
    result.conflict
      ? "idempotency_conflict"
      : result.duplicate
        ? "duplicate"
        : state,
    {
      correlationId,
      workspaceId: source.workspaceId,
      sourceConnectionId: source.id,
      receiptId: result.receiptId,
      ...(result.errorCode ? { code: result.errorCode } : {}),
    },
  );
  return result;
}
