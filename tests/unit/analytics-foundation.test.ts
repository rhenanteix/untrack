import { describe, expect, it } from "vitest";
import {
  extractUtmAttribution,
  resolveAttribution,
} from "@/modules/analytics/attribution";
import { classifyBot, classifyDevice } from "@/modules/analytics/device";

describe("analytics attribution", () => {
  it("prioritizes explicit UTM values over referrer inference", () => {
    expect(
      resolveAttribution({
        utmSource: "Instagram",
        utmMedium: "paid",
        utmCampaign: "lancamento",
        referrer: "https://google.com/search?q=linkor",
      }),
    ).toEqual({
      source: "instagram",
      medium: "paid",
      channel: "paid_social",
      campaign: "lancamento",
    });
  });

  it("classifies recognized referrers and direct visits deterministically", () => {
    expect(resolveAttribution({ referrer: "https://www.google.com/search" })).toEqual({
      source: "google",
      medium: "organic",
      channel: "organic_search",
    });
    expect(resolveAttribution({})).toEqual({
      source: "direct",
      medium: "none",
      channel: "direct",
    });
  });

  it("uses recognized referrers before QR context and preserves unknown referrals", () => {
    expect(
      resolveAttribution({
        referrer: "https://web.whatsapp.com/",
        knownContext: { source: "qr", medium: "qr", channel: "qr" },
      }),
    ).toEqual({
      source: "whatsapp",
      medium: "organic",
      channel: "messaging",
    });
    expect(
      resolveAttribution({
        knownContext: { source: "qr", medium: "qr", channel: "qr" },
      }),
    ).toEqual({ source: "qr", medium: "qr", channel: "qr" });
    expect(
      resolveAttribution({ referrer: "https://partner.example/campaign" }),
    ).toEqual({
      source: "partner.example",
      medium: "referral",
      channel: "referral",
    });
  });

  it("extracts only UTM fields from a URL", () => {
    expect(
      extractUtmAttribution(
        "https://linkor.me/p?a=private&utm_source=QR&utm_medium=qr&utm_campaign=evento",
      ),
    ).toEqual({
      utmSource: "QR",
      utmMedium: "qr",
      utmCampaign: "evento",
      utmContent: null,
      utmTerm: null,
    });
  });
});

describe("analytics request classification", () => {
  it("classifies user agents without storing them", () => {
    expect(
      classifyDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Safari/604.1",
      ),
    ).toEqual({ deviceType: "mobile", os: "ios", browser: "safari" });
  });

  it("marks preview and crawler traffic", () => {
    expect(classifyBot(new Headers({ "user-agent": "facebookexternalhit/1.1" }))).toEqual({
      isBot: true,
      botType: "preview",
    });
    expect(classifyBot(new Headers({ "user-agent": "Googlebot/2.1" }))).toEqual({
      isBot: true,
      botType: "crawler",
    });
  });
});