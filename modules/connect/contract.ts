import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import {
  analyticsAssetTypes,
  universalEventNames,
} from "@/modules/analytics/event-types";

export const CONNECT_VERSION = 1 as const;
export const MAX_LATENESS_MS = 30 * 86_400_000;
export const MAX_FUTURE_MS = 5 * 60_000;
export const MAX_ATTEMPTS = 5;
export const LEASE_MS = 60_000;
export const RAW_RETENTION_MS = 7 * 86_400_000;
export const EVENT_RETENTION_MS = 365 * 86_400_000;
export const sourceTypes = [
  "owned_asset",
  "external_site",
  "conversion_api",
  "connector",
] as const;
export const sourceTrusts = ["public", "authenticated", "internal"] as const;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const tokenLabel = z.string().regex(/^[a-zA-Z0-9_.-]{1,40}$/);

export const consentSchema = z
  .object({
    analytics: z.enum(["granted", "denied", "unknown", "not_applicable"]),
    policy_version: tokenLabel.optional(),
    collected_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

const emptyProperties = z.object({}).strict();
const viewProperties = z
  .object({
    page_category: z
      .enum(["landing", "product", "profile", "other"])
      .optional(),
  })
  .strict();
const interactionProperties = z
  .object({
    element_type: z
      .enum(["link", "button", "social", "qr", "form", "other"])
      .optional(),
  })
  .strict();
const transactionProperties = z
  .object({
    transaction_id: z.string().uuid().optional(),
    value_minor: z
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.value_minor === undefined) === (value.currency === undefined),
    {
      message: "value_minor and currency must be supplied together",
    },
  );

/** No free-form metadata. This is an event-level contract, not imported metric totals. */
export const inboundEventSchema = z
  .object({
    event_id: z.string().uuid(),
    event_name: z
      .enum(universalEventNames)
      .refine((name) => name !== "goal_completed", "Internal event"),
    event_version: z.literal(CONNECT_VERSION),
    occurred_at: z.iso.datetime({ offset: true }),
    session_id: id.nullable().optional(),
    journey_id: z.null().optional(),
    campaign_id: id.nullable().optional(),
    asset_id: id.nullable().optional(),
    asset_type: z.enum(analyticsAssetTypes).nullable().optional(),
    properties: z.record(z.string(), z.unknown()).default({}),
    consent_context: consentSchema.nullable().optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    const schema = ["payment_completed", "checkout_completed"].includes(
      event.event_name,
    )
      ? transactionProperties
      : event.event_name.endsWith("_view")
        ? viewProperties
        : event.event_name.endsWith("_click") ||
            event.event_name.endsWith("_scan")
          ? interactionProperties
          : emptyProperties;
    if (!schema.safeParse(event.properties).success)
      ctx.addIssue({
        code: "custom",
        path: ["properties"],
        message: "Properties do not match the event schema",
      });
    if (Boolean(event.asset_id) !== Boolean(event.asset_type))
      ctx.addIssue({
        code: "custom",
        path: ["asset_id"],
        message: "Asset ID and type must be supplied together",
      });
  })
  .transform((event) => ({
    ...event,
    occurred_at: new Date(event.occurred_at).toISOString(),
    session_id: event.session_id ?? null,
    journey_id: null,
    campaign_id: event.campaign_id ?? null,
    asset_id: event.asset_id ?? null,
    asset_type: event.asset_type ?? null,
    consent_context: event.consent_context ?? null,
    properties: event.properties as Record<string, string | number>,
  }));
export type InboundEvent = z.infer<typeof inboundEventSchema>;

export type CanonicalEvent = InboundEvent & {
  workspace_id: string;
  source_type: (typeof sourceTypes)[number];
  source_connection_id: string;
  received_at: string;
  processed_at: string;
};

export const publicEventNames = new Set([
  "page_view",
  "block_view",
  "smart_page_view",
  "smart_card_view",
  "link_click",
  "button_click",
  "social_click",
  "whatsapp_click",
  "product_view",
  "product_click",
  "qr_scan",
  "form_view",
  "campaign_view",
  "campaign_click",
  "website_click",
  "save_contact_click",
  "apple_wallet_add_click",
  "google_wallet_add_click",
]);

export function temporalError(event: InboundEvent, receivedAt: Date) {
  const time = new Date(event.occurred_at).getTime();
  if (time < receivedAt.getTime() - MAX_LATENESS_MS) return "EVENT_TOO_OLD";
  if (time > receivedAt.getTime() + MAX_FUTURE_MS) return "EVENT_IN_FUTURE";
  if (
    event.consent_context?.collected_at &&
    new Date(event.consent_context.collected_at).getTime() >
      time + MAX_FUTURE_MS
  )
    return "INVALID_CONSENT_TIME";
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  return value;
}
export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

/** Keyed digest, so rejected PII is neither retained nor exposed as a plain hash. */
export function payloadDigest(value: unknown) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Connect requires BETTER_AUTH_SECRET");
  return createHmac("sha256", secret).update(stableJson(value)).digest("hex");
}
export function nativeEventId(workspaceId: string, eventId: string) {
  return `connect:v1:${createHash("sha256").update(`${workspaceId}\0${eventId}`).digest("hex")}`;
}
export function retryDelayMs(attempt: number, random = Math.random()) {
  const base = Math.min(3_600_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (1 + Math.max(0, Math.min(1, random)) * 0.25));
}
