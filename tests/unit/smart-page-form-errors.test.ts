import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiRequestError } from "@/lib/client/api";
import { smartPageSlugSchema } from "@/modules/smart-pages/schemas";
import { themes } from "@/modules/smart-pages/themes";
afterEach(() => vi.unstubAllGlobals());
describe("Smart Pages editor validation", () => {
  it.each(["ana--silva", "-ana", "ana-", "ana silva", "joão", "ana_silva"])(
    "explains invalid public address %s",
    (slug) => {
      const result = smartPageSlugSchema.safeParse(slug);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0].message).toContain("ana-silva");
    },
  );
  it("preserves supported address normalization", () =>
    expect(smartPageSlugSchema.parse(" Ana-Silva ")).toBe("ana-silva"));
  it("keeps server validation fields separate from the human summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            {
              error: "Verifique os dados informados.",
              code: "INVALID_INPUT",
              fields: [{ field: "slug", message: "Escolha outro endereço." }],
            },
            { status: 400 },
          ),
        ),
    );
    await expect(apiRequest("/api/smart-pages")).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "Verifique os dados informados.",
      fields: [{ field: "slug", message: "Escolha outro endereço." }],
    });
  });
  it("preserves conflict codes for contextual feedback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Endereço em uso.", code: "SLUG_EXISTS" },
            { status: 409 },
          ),
        ),
    );
    await expect(apiRequest("/api/smart-pages")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
  });
  it("provides distinct career and portfolio examples for all professional templates", () => {
    const professional = themes.filter((t) =>
      ["Currículos", "Portfólios"].includes(t.category),
    );
    expect(professional).toHaveLength(6);
    for (const theme of professional) {
      expect(theme.sample?.bio).toBeTruthy();
      expect(theme.sample?.links).toHaveLength(3);
    }
  });
});
