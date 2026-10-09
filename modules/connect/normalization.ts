import type { ConnectReceipt, ConnectSource, Prisma } from "@prisma/client";
import {
  inboundEventSchema,
  nativeEventId,
  temporalError,
  type CanonicalEvent,
} from "./contract";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { json } from "./database";

export class RejectedEvent extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function assetExists(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  type: string,
  id: string,
) {
  const where = { id, workspaceId };
  const select = { id: true };
  switch (type) {
    case "link":
      return tx.shortLink.findFirst({ where, select });
    case "smart_page":
      return tx.smartPage.findFirst({ where, select });
    case "smart_card":
      return tx.smartCard.findFirst({ where, select });
    case "qr_code":
      return tx.qrAsset.findFirst({ where, select });
    case "campaign":
      return tx.campaign.findFirst({ where, select });
    case "product":
      return tx.product.findFirst({ where, select });
    default:
      return null; // Reserved payment_link has no authoritative asset model yet.
  }
}

export async function normalizeAndProject(
  tx: Prisma.TransactionClient,
  source: ConnectSource,
  receipt: ConnectReceipt,
  now: Date,
) {
  const parsed = inboundEventSchema.safeParse(receipt.rawPayload);
  if (!parsed.success) throw new RejectedEvent("INVALID_STORED_EVENT");
  const input = parsed.data;
  const temporal = temporalError(input, receipt.receivedAt);
  if (temporal) throw new RejectedEvent(temporal);
  if (!source.allowedEvents.includes(input.event_name))
    throw new RejectedEvent("EVENT_NOT_ALLOWED");
  if (
    input.consent_context?.analytics === "denied" ||
    (source.requiresConsent && input.consent_context?.analytics !== "granted")
  )
    throw new RejectedEvent("CONSENT_REQUIRED");
  if (
    (input.session_id || input.campaign_id || input.asset_id) &&
    (source.type !== "owned_asset" || source.trust !== "internal")
  )
    throw new RejectedEvent("UNTRUSTED_ASSOCIATION");
  if (
    input.asset_id &&
    input.asset_type &&
    !(await assetExists(
      tx,
      source.workspaceId,
      input.asset_type,
      input.asset_id,
    ))
  )
    throw new RejectedEvent("ASSET_NOT_OWNED");
  if (
    input.campaign_id &&
    !(await tx.campaign.findFirst({
      where: { id: input.campaign_id, workspaceId: source.workspaceId },
      select: { id: true },
    }))
  )
    throw new RejectedEvent("CAMPAIGN_NOT_OWNED");
  let identity: {
    visitorId?: string;
    sessionId?: string;
    visitorHash?: string;
  } = {};
  if (input.session_id) {
    if (input.consent_context?.analytics !== "granted")
      throw new RejectedEvent("IDENTITY_REQUIRES_CONSENT");
    const session = await tx.analyticsSession.findFirst({
      where: {
        id: input.session_id,
        workspaceId: source.workspaceId,
        visitor: { workspaceId: source.workspaceId },
      },
      include: { visitor: { select: { id: true, visitorHash: true } } },
    });
    if (!session) throw new RejectedEvent("SESSION_NOT_OWNED");
    // Association uses an existing authoritative session, never an IP or inferred identity.
    identity = {
      sessionId: session.id,
      visitorId: session.visitor.id,
      visitorHash: session.visitor.visitorHash,
    };
  }
  const canonical: CanonicalEvent = {
    ...input,
    workspace_id: source.workspaceId,
    source_type: source.type,
    source_connection_id: source.id,
    received_at: receipt.receivedAt.toISOString(),
    processed_at: now.toISOString(),
  };
  if (source.projection !== "native")
    return { canonical, analyticsEventId: null };
  if (source.type !== "owned_asset" || source.trust !== "internal")
    throw new RejectedEvent("PROJECTION_NOT_ALLOWED");
  const eventId = nativeEventId(source.workspaceId, input.event_id);
  const existing = await tx.analyticsEvent.findFirst({
    where: {
      workspaceId: source.workspaceId,
      eventId: { in: [eventId, input.event_id] },
    },
  });
  if (existing) {
    if (
      existing.connectPayloadHash
        ? existing.connectPayloadHash !== receipt.payloadHash
        : existing.name !== input.event_name ||
          existing.assetId !== input.asset_id ||
          existing.assetType !== input.asset_type ||
          existing.sessionId !== input.session_id ||
          existing.campaignId !== input.campaign_id ||
          existing.occurredAt.getTime() !==
            new Date(input.occurred_at).getTime()
    )
      throw new RejectedEvent("RECONCILIATION_CONFLICT");
    return { canonical, analyticsEventId: existing.eventId };
  }
  await recordAnalyticsEvent(
    {
      name: input.event_name,
      eventId,
      workspaceId: source.workspaceId,
      occurredAt: new Date(input.occurred_at),
      origin: "server",
      assetType: input.asset_type ?? undefined,
      assetId: input.asset_id ?? undefined,
      campaignId: input.campaign_id ?? undefined,
      ...(input.asset_type === "smart_page"
        ? { smartPageId: input.asset_id! }
        : {}),
      ...(input.asset_type === "smart_card"
        ? { smartCardId: input.asset_id! }
        : {}),
      metadata: input.properties,
      attribution: {
        knownContext: {
          source: "unknown",
          medium: "unknown",
          channel: "other",
        },
      },
      connectContext: {
        eventVersion: 1,
        sourceType: source.type,
        sourceConnectionId: source.id,
        receivedAt: receipt.receivedAt,
        processedAt: now,
        correlationId: receipt.correlationId,
        consentContext: json(input.consent_context ?? {}),
        connectPayloadHash: receipt.payloadHash,
        connectOriginalEventId: input.event_id,
      },
    },
    { transaction: tx, resolvedIdentity: identity },
  );
  return { canonical, analyticsEventId: eventId };
}
