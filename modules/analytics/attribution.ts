import type { AnalyticsChannel } from "./event-types";

export type Attribution = {
  source: string;
  medium: string;
  channel: AnalyticsChannel;
  campaign?: string;
  content?: string;
  term?: string;
};

export type ResolvedAttributionContext = Attribution & {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

export type AttributionInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  /** Server-verified context from the preceding first-party navigation. */
  trustedContext?: ResolvedAttributionContext;
  /** Asset context resolved on the server, for example a tracked QR code. */
  knownContext?: Pick<Attribution, "source" | "medium" | "channel"> &
    Partial<Pick<Attribution, "campaign" | "content" | "term">>;
};

const knownReferrerSources = [
  { source: "google", pattern: /(^|\.)google\.[a-z.]+$/ },
  { source: "bing", pattern: /(^|\.)bing\.com$/ },
  { source: "instagram", pattern: /(^|\.)instagram\.com$/ },
  { source: "facebook", pattern: /(^|\.)facebook\.com$/ },
  { source: "linkedin", pattern: /(^|\.)linkedin\.com$/ },
  { source: "youtube", pattern: /(^|\.)youtube\.com$/ },
  { source: "tiktok", pattern: /(^|\.)tiktok\.com$/ },
  { source: "x", pattern: /(^|\.)(x\.com|twitter\.com)$/ },
  { source: "whatsapp", pattern: /(^|\.)whatsapp\.com$/ },
] as const;

const searchSources = new Set(["google", "bing"]);
const socialSources = new Set([
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
  "x",
]);

function normalize(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function referrerHost(referrer: string | null | undefined) {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    return ["http:", "https:"].includes(url.protocol)
      ? url.hostname.toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

function channelFor(source: string, medium: string | undefined): AnalyticsChannel {
  if (medium === "qr" || source === "qr") return "qr";
  if (medium === "email" || source === "email") return "email";
  if (medium === "messaging" || source === "whatsapp") return "messaging";
  if (medium === "direct" || source === "direct") return "direct";

  const isPaid = /^(cpc|cpm|paid|ppc|display|affiliate)$/.test(medium ?? "");
  if (searchSources.has(source)) return isPaid ? "paid_search" : "organic_search";
  if (socialSources.has(source)) return isPaid ? "paid_social" : "organic_social";
  if (medium === "referral") return "referral";
  return medium ? "other" : "referral";
}

function contextAttribution(
  context:
    | ResolvedAttributionContext
    | (Pick<Attribution, "source" | "medium" | "channel"> &
        Partial<Pick<Attribution, "campaign" | "content" | "term">>)
    | undefined,
) {
  const source = normalize(context?.source);
  const medium = normalize(context?.medium);
  if (!source || !medium) return undefined;
  return {
    source,
    medium,
    channel: context?.channel ?? channelFor(source, medium),
    ...(normalize(context?.campaign) ? { campaign: normalize(context?.campaign) } : {}),
    ...(normalize(context?.content) ? { content: normalize(context?.content) } : {}),
    ...(normalize(context?.term) ? { term: normalize(context?.term) } : {}),
  } satisfies Attribution;
}

function referrerAttribution(referrer: string | null | undefined) {
  const host = referrerHost(referrer);
  if (!host) return undefined;
  const known = knownReferrerSources.find(({ pattern }) => pattern.test(host));
  if (!known) return undefined;
  return {
    source: known.source,
    medium: "organic",
    channel: channelFor(known.source, "organic"),
  } satisfies Attribution;
}

/**
 * Resolves one stable acquisition record. Explicit UTMs always take precedence
 * over referrer inference; unknown direct visits are never fabricated as sources.
 */
export function resolveAttribution(input: AttributionInput): Attribution {
  const utmSource = normalize(input.utmSource);
  const utmMedium = normalize(input.utmMedium);
  const utmCampaign = normalize(input.utmCampaign);
  const utmContent = normalize(input.utmContent);
  const utmTerm = normalize(input.utmTerm);

  if (utmSource || utmMedium || utmCampaign || utmContent || utmTerm) {
    const source = utmSource ?? "unknown";
    const medium = utmMedium ?? "unknown";
    return {
      source,
      medium,
      channel: channelFor(source, utmMedium),
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(utmContent ? { content: utmContent } : {}),
      ...(utmTerm ? { term: utmTerm } : {}),
    };
  }

  const referrer = referrerAttribution(input.referrer);
  if (referrer) return referrer;

  const knownContext = contextAttribution(input.knownContext);
  if (knownContext) return knownContext;

  const trustedContext = contextAttribution(input.trustedContext);
  if (trustedContext) return trustedContext;

  const host = referrerHost(input.referrer);
  if (!host)
    return { source: "direct", medium: "none", channel: "direct" };
  return {
    source: host,
    medium: "referral",
    channel: "referral",
  };
}

export function extractUtmAttribution(url: string): AttributionInput {
  try {
    const search = new URL(url).searchParams;
    return {
      utmSource: search.get("utm_source"),
      utmMedium: search.get("utm_medium"),
      utmCampaign: search.get("utm_campaign"),
      utmContent: search.get("utm_content"),
      utmTerm: search.get("utm_term"),
    };
  } catch {
    return {};
  }
}