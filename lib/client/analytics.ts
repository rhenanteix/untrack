import {
  ANALYTICS_BROWSER_EVENT,
  CLIENT_ANALYTICS_EVENTS,
  ANALYTICS_PATHS,
  type AnalyticsEventName,
} from "../analytics-events";

export type { AnalyticsEventName };

export type AnalyticsContext = Partial<{
  product: string;
  category: string;
  source: string;
  location: string;
}>;

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
};
