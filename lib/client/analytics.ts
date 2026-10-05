import {
  ANALYTICS_BROWSER_EVENT,
  CLIENT_ANALYTICS_EVENTS,
  ANALYTICS_PATHS,
  type AnalyticsEventName,
} from "../analytics-events";
import type { UniversalEventName } from "@/modules/analytics/event-types";
import {
  analyticsSessionCookieName,
  analyticsVisitorCookieName,
} from "@/modules/analytics/public-contract";

export type { AnalyticsEventName };

export type AnalyticsContext = Partial<{
  product: string;
  category: string;
  source: string;
  location: string;
}>;

type PublicIdentity = {
  visitorId?: string;
  sessionId?: string;
};

type SmartPageEvent =
  | "smart_page_view"
  | "smart_block_view"
  | "form_view"
  | "smart_block_clicked"
  | "link_in_bio_product_view"
  | "link_in_bio_product_click"
  | "social_click";

type SmartCardEvent =
  | "card_view"
  | "card_share"
  | "qr_scan"
  | "nfc_open"
  | "apple_wallet_add_click"
  | "google_wallet_add_click"
  | "contact_save"
  | "contact_form_open"
  | "link_click"
  | "social_click"
  | "whatsapp_click"
  | "booking_click";

const visitorStorageKey = "linkor:analytics:visitor";
const sessionStorageKey = "linkor:analytics:session";

function readBrowserCookie(name: string) {
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

function persistBrowserCookie(name: string, value: string, persistent = false) {
  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
    ...(persistent ? ["Max-Age=31536000"] : []),
  ].join("; ");
}

function publicIdentity(): PublicIdentity {
  if (typeof window === "undefined") return {};
  const navigatorWithPrivacy = navigator as Navigator & {
    globalPrivacyControl?: boolean;
  };
  if (navigatorWithPrivacy.globalPrivacyControl || navigator.doNotTrack === "1")
    return {};
  try {
    const visitorId =
      readBrowserCookie(analyticsVisitorCookieName) ??
      window.localStorage.getItem(visitorStorageKey) ??
      crypto.randomUUID();
    const sessionId =
      readBrowserCookie(analyticsSessionCookieName) ??
      window.sessionStorage.getItem(sessionStorageKey) ??
      crypto.randomUUID();
    window.localStorage.setItem(visitorStorageKey, visitorId);
    window.sessionStorage.setItem(sessionStorageKey, sessionId);
    persistBrowserCookie(analyticsVisitorCookieName, visitorId, true);
    persistBrowserCookie(analyticsSessionCookieName, sessionId);
    return { visitorId, sessionId };
  } catch {
    return {};
  }
}

function utmContext() {
  const search = new URLSearchParams(window.location.search);
  return {
    utmSource: search.get("utm_source") ?? undefined,
    utmMedium: search.get("utm_medium") ?? undefined,
    utmCampaign: search.get("utm_campaign") ?? undefined,
    utmContent: search.get("utm_content") ?? undefined,
    utmTerm: search.get("utm_term") ?? undefined,
  };
}

function publicTrackingContext() {
  return { ...publicIdentity(), ...utmContext() };
}

function post(path: string, body: Record<string, unknown>) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * First-party analytics: only event names and known page paths leave the browser.
 * DOM events remain available for optional provider integrations.
 */
export const analytics = {
  track(event: AnalyticsEventName, context?: AnalyticsContext) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(ANALYTICS_BROWSER_EVENT, {
        detail: { event, context },
      }),
    );
    if (!(CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(event)) return;
    const path = window.location.pathname;
    if (!(ANALYTICS_PATHS as readonly string[]).includes(path)) return;
    // Never include query strings, submitted URLs, identifiers or local history.
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, path, ...(context ? { context } : {}) }),
      keepalive: true,
    }).catch(() => {
      // Analytics failure must not interrupt any tool.
    });
  },

  identity: publicIdentity,

  publicContext: publicTrackingContext,

  trackPublicEvent(event: UniversalEventName, context: { path?: string } = {}) {
    if (typeof window === "undefined") return Promise.resolve(undefined);
    return post("/api/events", {
      event,
      eventId: crypto.randomUUID(),
      path: context.path ?? window.location.pathname,
      ...publicTrackingContext(),
    });
  },

  trackSmartPage(event: SmartPageEvent, slug: string, blockId?: string) {
    if (typeof window === "undefined") return Promise.resolve(undefined);
    return post("/api/smart-pages/events", {
      event,
      eventId: crypto.randomUUID(),
      slug,
      blockId,
      ...publicTrackingContext(),
    });
  },

  trackSmartCard(
    event: SmartCardEvent,
    slug: string,
    source: string,
    actionId?: string,
    contactId?: string,
    providerId?: string,
  ) {
    if (typeof window === "undefined") return Promise.resolve(undefined);
    return post("/api/smart-cards/events", {
      event,
      eventId: crypto.randomUUID(),
      slug,
      source,
      actionId,
      contactId,
      providerId,
      ...publicTrackingContext(),
    });
  },
};
