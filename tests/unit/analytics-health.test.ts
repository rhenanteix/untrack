import { afterEach, describe, expect, it, vi } from "vitest";
import { reportAnalyticsHealth } from "@/modules/analytics/health";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("analytics health diagnostics", () => {
  it("emits a bounded debug record when explicitly enabled", () => {
    vi.stubEnv("ANALYTICS_DEBUG", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    reportAnalyticsHealth("events_received", {
      eventName: "smart_page_view",
      isTest: true,
    });

    expect(info).toHaveBeenCalledWith(
      "analytics_health",
      JSON.stringify({
        metric: "events_received",
        eventName: "smart_page_view",
        isTest: true,
      }),
    );
  });
});