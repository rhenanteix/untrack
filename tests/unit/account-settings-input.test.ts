import { describe, expect, it } from "vitest";
import { settingsSchema } from "@/app/api/account/settings/route";

describe("account settings input", () => {
  it("does not accept plan or trial privilege fields from the client", () => {
    expect(settingsSchema.safeParse({ profile: { plan: "premium" } }).success).toBe(false);
    expect(settingsSchema.safeParse({ workspace: { plan: "premium" } }).success).toBe(false);
    expect(settingsSchema.safeParse({ trial: { expiresAt: "2099-01-01" } }).success).toBe(false);
  });
});