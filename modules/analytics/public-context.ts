import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  analyticsContextCookieName,
  analyticsSessionCookieName,
  analyticsVisitorCookieName,
  type PublicAnalyticsIdentity,
} from "./public-contract";
import {
  type Attribution,
  type AttributionInput,
  type ResolvedAttributionContext,
} from "./attribution";
import { analyticsSessionTimeoutMilliseconds } from "./session";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const oneYearInSeconds = 365 * 24 * 60 * 60;

type PublicAnalyticsContextPayload = {
  version: 1;
  expiresAt: number;
  attribution: ResolvedAttributionContext;
  campaignId?: string;
  campaignAssetId?: string;
  qrContext?: string;
};

export type PublicAnalyticsRequestContext = {
  trackingAllowed: boolean;
  identity: PublicAnalyticsIdentity;
  attribution: AttributionInput;
  cookieHeaders: string[];
};

function readCookie(headers: Headers, name: string) {
  const value = headers.get("cookie");
  if (!value) return undefined;
  const item = value
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!item) return undefined;
  try {
    return decodeURIComponent(item.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function validUuid(value: string | undefined) {
  return value && uuidPattern.test(value) ? value : undefined;
}

function cookieAttributes(headers: Headers, maxAge?: number) {
  const secure =
    process.env.NODE_ENV === "production" ||
    headers.get("x-forwarded-proto") === "https";
  return [
    "Path=/",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
    ...(maxAge ? [`Max-Age=${maxAge}`] : []),
  ].join("; ");
}

function setCookie(
  headers: Headers,
  name: string,
  value: string,
  maxAge?: number,
) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttributes(headers, maxAge)}`;
}

function contextSecret() {
  return process.env.BETTER_AUTH_SECRET;
}

function sign(value: string) {
  const secret = contextSecret();
  return secret
    ? createHmac("sha256", secret).update(value).digest("base64url")
    : undefined;
}

function decodeContext(value: string | undefined) {
  if (!value) return undefined;
  const [payload, signature] = value.split(".");
  const expected = payload ? sign(payload) : undefined;
  if (
    !payload ||
    !signature ||
    !expected ||
    signature.length !== expected.length
  )
    return undefined;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
    return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as PublicAnalyticsContextPayload;
    if (
      parsed.version !== 1 ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() ||
      !parsed.attribution ||
      typeof parsed.attribution.source !== "string" ||
      typeof parsed.attribution.medium !== "string" ||
      typeof parsed.attribution.channel !== "string"
    )
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function encodeContext(payload: PublicAnalyticsContextPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return signature ? `${encoded}.${signature}` : undefined;
}

function limited(value: string | undefined, length: number) {
  return value?.slice(0, length) || undefined;
}

function analyticsOptOut(headers: Headers) {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1";
}

/**
 * Resolves pseudonymous first-party identity and a previously signed acquisition
 * context. Client-provided IDs are accepted only when they are opaque UUIDs.
 */
export function resolvePublicAnalyticsContext(
  headers: Headers,
  suppliedIdentity: PublicAnalyticsIdentity = {},
  attribution: AttributionInput = {},
): PublicAnalyticsRequestContext {
  if (analyticsOptOut(headers))
    return {
      trackingAllowed: false,
      identity: {},
      attribution,
      cookieHeaders: [],
    };

  const existingVisitorId = validUuid(
    readCookie(headers, analyticsVisitorCookieName),
  );
  const existingSessionId = validUuid(
    readCookie(headers, analyticsSessionCookieName),
  );
  const visitorId =
    validUuid(suppliedIdentity.visitorId) ?? existingVisitorId ?? randomUUID();
  const sessionId =
    validUuid(suppliedIdentity.sessionId) ?? existingSessionId ?? randomUUID();
  const cookieHeaders = [
    ...(existingVisitorId === visitorId
      ? []
      : [
          setCookie(
            headers,
            analyticsVisitorCookieName,
            visitorId,
            oneYearInSeconds,
          ),
        ]),
    ...(existingSessionId === sessionId
      ? []
      : [
          setCookie(
            headers,
            analyticsSessionCookieName,
            sessionId,
            Math.ceil(analyticsSessionTimeoutMilliseconds() / 1_000),
          ),
        ]),
  ];
  const context = decodeContext(
    readCookie(headers, analyticsContextCookieName),
  );
  return {
    trackingAllowed: true,
    identity: { visitorId, sessionId },
    attribution: {
      ...attribution,
      ...(context ? { trustedContext: context.attribution } : {}),
    },
    cookieHeaders,
  };
}

/** Creates a short-lived, tamper-evident context for the next public event. */
export function publicAnalyticsContextCookies(
  headers: Headers,
  requestContext: PublicAnalyticsRequestContext,
  attribution: Attribution,
  context: {
    campaignId?: string;
    campaignAssetId?: string;
    qrContext?: string;
  } = {},
) {
  if (!requestContext.trackingAllowed) return [];
  const utm = Object.fromEntries(
    ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"].flatMap(
      (key) => {
        const value = requestContext.attribution[key as keyof AttributionInput];
        return typeof value === "string" ? [[key, limited(value, 120)]] : [];
      },
    ),
  );
  const payload: PublicAnalyticsContextPayload = {
    version: 1,
    expiresAt: Date.now() + analyticsSessionTimeoutMilliseconds(),
    attribution: {
      source: limited(attribution.source, 253) ?? "unknown",
      medium: limited(attribution.medium, 120) ?? "unknown",
      channel: attribution.channel,
      ...(limited(attribution.campaign, 120)
        ? { campaign: limited(attribution.campaign, 120) }
        : {}),
      ...(limited(attribution.content, 120)
        ? { content: limited(attribution.content, 120) }
        : {}),
      ...(limited(attribution.term, 120)
        ? { term: limited(attribution.term, 120) }
        : {}),
      ...utm,
    },
    ...(context.campaignId
      ? { campaignId: context.campaignId.slice(0, 255) }
      : {}),
    ...(context.campaignAssetId
      ? { campaignAssetId: context.campaignAssetId.slice(0, 255) }
      : {}),
    ...(context.qrContext ? { qrContext: context.qrContext.slice(0, 80) } : {}),
  };
  const encoded = encodeContext(payload);
  return [
    ...requestContext.cookieHeaders,
    ...(encoded
      ? [
          setCookie(
            headers,
            analyticsContextCookieName,
            encoded,
            Math.ceil(analyticsSessionTimeoutMilliseconds() / 1_000),
          ),
        ]
      : []),
  ];
}

export function trustedCampaignContext(headers: Headers) {
  if (analyticsOptOut(headers)) return {};
  const context = decodeContext(
    readCookie(headers, analyticsContextCookieName),
  );
  return context
    ? {
        ...(context.campaignId ? { campaignId: context.campaignId } : {}),
        ...(context.campaignAssetId
          ? { campaignAssetId: context.campaignAssetId }
          : {}),
        ...(context.qrContext ? { qrContext: context.qrContext } : {}),
      }
    : {};
}
