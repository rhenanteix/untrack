import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
  trustedCampaignContext,
} from "@/modules/analytics/public-context";

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "analytics-test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public analytics context", () => {
  it("keeps a signed QR attribution and campaign context for the next event", () => {
    const requestHeaders = new Headers();
    const context = resolvePublicAnalyticsContext(requestHeaders, {}, {});
    const attribution = resolveAttribution({
      ...context.attribution,
      knownContext: { source: "qr", medium: "qr", channel: "qr" },
    });
    const cookies = publicAnalyticsContextCookies(
      requestHeaders,
      context,
      attribution,
      { campaignId: "campaign_1", qrContext: "event_stand" },
    );
    const responseCookieHeader = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
    const nextHeaders = new Headers({ cookie: responseCookieHeader });
    const next = resolvePublicAnalyticsContext(nextHeaders);

    expect(next.identity).toEqual(context.identity);
    expect(resolveAttribution(next.attribution)).toMatchObject({
      source: "qr",
      medium: "qr",
      channel: "qr",
    });
    expect(trustedCampaignContext(nextHeaders)).toEqual({
      campaignId: "campaign_1",
      qrContext: "event_stand",
    });
  });

  it("does not create persistent identity when DNT or GPC is enabled", () => {
    for (const headers of [
      new Headers({ dnt: "1" }),
      new Headers({ "sec-gpc": "1" }),
    ]) {
      expect(resolvePublicAnalyticsContext(headers)).toEqual({
        trackingAllowed: false,
        identity: {},
        attribution: {},
        cookieHeaders: [],
      });
    }
  });
});