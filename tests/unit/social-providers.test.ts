import { describe, expect, it } from "vitest";
import {
  getSocialProvider,
  normalizeSocialUrl,
  socialProviderIds,
} from "@/modules/social-providers";

describe("social providers", () => {
  it("normalizes supported handle and contact shortcuts", () => {
    expect(normalizeSocialUrl("instagram", "@linkor")).toBe(
      "https://instagram.com/linkor",
    );
    expect(normalizeSocialUrl("whatsapp", "+55 11 99999-9999")).toBe(
      "https://wa.me/5511999999999",
    );
    expect(normalizeSocialUrl("email", "oi@linkor.com")).toBe(
      "mailto:oi@linkor.com",
    );
  });

  it("only accepts URLs belonging to a provider when it has known hosts", () => {
    expect(normalizeSocialUrl("instagram", "https://example.com/linkor")).toBe(
      null,
    );
    expect(normalizeSocialUrl("website", "https://example.com/linkor")).toBe(
      "https://example.com/linkor",
    );
  });

  it("keeps a named, branded provider definition for every supported id", () => {
    expect(socialProviderIds).toHaveLength(20);
    expect(getSocialProvider("linkedin")).toMatchObject({
      id: "linkedin",
      name: "LinkedIn",
      placeholder: "linkedin.com/in/linkor",
    });
  });
});