import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inboundEventSchema,
  nativeEventId,
  payloadDigest,
  retryDelayMs,
  temporalError,
} from "@/modules/connect/contract";
import { sourceConfigSchema } from "@/modules/connect/sources";
import { operationalAuth, connectError } from "@/modules/connect/http";

const now = new Date("2026-10-08T12:00:00Z");
const event = () => ({
  event_id: randomUUID(),
  event_name: "page_view",
  event_version: 1,
  occurred_at: now.toISOString(),
  properties: { page_category: "landing" },
  consent_context: { analytics: "granted", policy_version: "v1" },
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Connect canonical v1 contract", () => {
  it("normalizes optional context without inventing tenant, identity or journey", () => {
    expect(inboundEventSchema.parse(event())).toMatchObject({
      session_id: null,
      journey_id: null,
      campaign_id: null,
      asset_id: null,
      asset_type: null,
    });
  });
  it.each([
    "workspace_id",
    "source_type",
    "source_connection_id",
    "received_at",
    "processed_at",
  ])("rejects client authority field %s", (field) => {
    expect(
      inboundEventSchema.safeParse({ ...event(), [field]: "forged" }).success,
    ).toBe(false);
  });
  it.each([
    { properties: { email: "private@example.com" } },
    { properties: { arbitrary: "private@example.com" } },
    { properties: { count: 300 } },
    { properties: { page_path: "/people/private@example.com?token=secret" } },
    { event_version: 2 },
    { event_name: "goal_completed" },
    { journey_id: "guessed" },
    { event_id: "provider-user-email" },
    { asset_id: "asset" },
  ])("rejects invalid or sensitive input %#", (change) => {
    expect(
      inboundEventSchema.safeParse({ ...event(), ...change }).success,
    ).toBe(false);
  });
  it("validates monetary event units without accepting metric snapshots", () => {
    const input = {
      ...event(),
      event_name: "payment_completed",
      properties: {
        transaction_id: randomUUID(),
        value_minor: 1200,
        currency: "BRL",
      },
    };
    expect(inboundEventSchema.safeParse(input).success).toBe(true);
    expect(
      inboundEventSchema.safeParse({
        ...input,
        properties: { value_minor: 1200 },
      }).success,
    ).toBe(false);
    expect(
      inboundEventSchema.safeParse({
        ...input,
        properties: { value_minor: 1.5, currency: "BRL" },
      }).success,
    ).toBe(false);
  });
  it("bounds late and future timestamps independently of arrival ordering", () => {
    const valid = inboundEventSchema.parse(event());
    expect(
      temporalError(
        {
          ...valid,
          occurred_at: new Date(now.getTime() - 29 * 86_400_000).toISOString(),
        },
        now,
      ),
    ).toBeNull();
    expect(
      temporalError(
        {
          ...valid,
          occurred_at: new Date(now.getTime() - 31 * 86_400_000).toISOString(),
        },
        now,
      ),
    ).toBe("EVENT_TOO_OLD");
    expect(
      temporalError(
        {
          ...valid,
          occurred_at: new Date(now.getTime() + 301_000).toISOString(),
        },
        now,
      ),
    ).toBe("EVENT_IN_FUTURE");
  });
  it("hashes stable object order, namespaces native IDs and bounds retry backoff", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "unit-test-secret");
    expect(payloadDigest({ a: 1, b: 2 })).toBe(payloadDigest({ b: 2, a: 1 }));
    expect(nativeEventId("a", "same")).not.toBe(nativeEventId("b", "same"));
    expect(retryDelayMs(1, 0)).toBe(1000);
    expect(retryDelayMs(5, 1)).toBe(20000);
    expect(retryDelayMs(100, 1)).toBeLessThanOrEqual(4_500_000);
  });
});

describe("Connect source trust", () => {
  it("requires consent and observational events for public sources", () => {
    const source = {
      key: "website",
      type: "external_site",
      trust: "public",
      allowedOrigins: ["https://example.com"],
      allowedEvents: ["page_view"],
    };
    expect(sourceConfigSchema.safeParse(source).success).toBe(true);
    expect(
      sourceConfigSchema.safeParse({ ...source, requiresConsent: false })
        .success,
    ).toBe(false);
    expect(
      sourceConfigSchema.safeParse({
        ...source,
        allowedEvents: ["payment_completed"],
      }).success,
    ).toBe(false);
    expect(
      sourceConfigSchema.safeParse({
        ...source,
        allowedOrigins: ["https://example.com/path"],
      }).success,
    ).toBe(false);
    expect(
      sourceConfigSchema.safeParse({ ...source, projection: "native" }).success,
    ).toBe(false);
  });
  it("does not let an external server credential enable native projection", () => {
    expect(
      sourceConfigSchema.safeParse({
        key: "conversion-api",
        type: "conversion_api",
        trust: "authenticated",
        projection: "native",
        allowedEvents: ["page_view"],
      }).success,
    ).toBe(false);
  });
  it("separates worker/admin secrets and refuses browser operational requests", () => {
    vi.stubEnv("CONNECT_WORKER_SECRET", "w".repeat(32));
    vi.stubEnv("CONNECT_ADMIN_SECRET", "a".repeat(32));
    const request = new Request("https://linkor.test/api/internal/connect", {
      headers: { authorization: `Bearer ${"w".repeat(32)}` },
    });
    expect(() => operationalAuth(request, "worker")).not.toThrow();
    expect(() => operationalAuth(request, "admin")).toThrow();
    expect(() =>
      operationalAuth(
        new Request(request, {
          headers: {
            authorization: `Bearer ${"w".repeat(32)}`,
            origin: "https://linkor.test",
          },
        }),
        "worker",
      ),
    ).toThrow();
  });
  it("returns retryable failures without leaking exceptions", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const response = connectError(
      new Error("token=private email=private@example.com"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.text()).not.toContain("private");
    expect(JSON.stringify(log.mock.calls)).not.toContain("private");
  });
});
