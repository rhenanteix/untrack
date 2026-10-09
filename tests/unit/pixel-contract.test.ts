import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  inboundEventSchema,
  publicEventNames,
} from "@/modules/connect/contract";
import { pixelInput } from "@/modules/pixel/service";
import { installationSnippet } from "@/modules/pixel/installation";
const event = (name: string, properties = {}) => ({
  event_id: randomUUID(),
  event_name: name,
  event_version: 1,
  occurred_at: new Date().toISOString(),
  properties,
  consent_context: { analytics: "granted" },
});
describe("Pixel strict data contract", () => {
  it.each(["page_view", "link_click", "cta_click", "custom_event"])(
    "accepts %s",
    (name) => {
      expect(inboundEventSchema.safeParse(event(name)).success).toBe(true);
      expect(publicEventNames.has(name)).toBe(true);
    },
  );
  it.each(["email", "password", "message", "text", "href", "url", "name"])(
    "rejects %s in custom properties",
    (field) => {
      expect(
        inboundEventSchema.safeParse(
          event("custom_event", { [field]: "sensitive" }),
        ).success,
      ).toBe(false);
    },
  );
  it("accepts only enumerated goals and UUID tests, never public purchase evidence", () => {
    expect(
      inboundEventSchema.safeParse(event("cta_click", { goal: "quote" }))
        .success,
    ).toBe(true);
    expect(
      inboundEventSchema.safeParse(event("cta_click", { goal: "purchase" }))
        .success,
    ).toBe(false);
    expect(
      inboundEventSchema.safeParse(
        event("pixel_test", { test_id: "email@example.com" }),
      ).success,
    ).toBe(false);
    expect(publicEventNames.has("payment_completed")).toBe(false);
  });
  it.each(
    [
      [],
      ["https://example.com/"],
      ["https://*.example.com"],
      ["http://example.com"],
      ["https://example.com/path"],
    ].map((origins) => ({ origins })),
  )("rejects unsafe origin list $origins", ({ origins }) => {
    expect(pixelInput.safeParse({ origins }).success).toBe(false);
  });
  it("allows exact multiple domains and rejects authority overrides", () => {
    expect(
      pixelInput.safeParse({
        origins: ["https://example.com", "https://www.example.com"],
      }).success,
    ).toBe(true);
    expect(
      pixelInput.safeParse({
        origins: ["https://example.com"],
        workspaceId: "other",
      }).success,
    ).toBe(false);
  });
  it("escapes script markup and has a small standalone gzip budget", () => {
    expect(
      installationSnippet("https://linkor.example", '"><script>'),
    ).not.toContain('id=""><script>');
    expect(gzipSync(readFileSync("public/pixel/v1.js")).length).toBeLessThan(
      4096,
    );
  });
});
