import { describe, expect, it } from "vitest";
import { themes, themeIds, readableInk } from "@/modules/smart-pages/themes";
import {
  smartPageThemeSchema,
  smartPageUpdateSchema,
} from "@/modules/smart-pages/schemas";

describe("Smart Page template catalog", () => {
  it("accepts every catalog model and keeps identifiers unique", () => {
    expect(new Set(themes.map((t) => t.id)).size).toBe(themeIds.length);
    for (const theme of themes)
      expect(smartPageThemeSchema.parse({ preset: theme.id }).preset).toBe(
        theme.id,
      );
  });
  it("preserves legacy themes and customization on updates", () => {
    for (const preset of [
      "minimal",
      "creator",
      "business",
      "dark",
      "editorial",
      "bold",
    ]) {
      const theme = {
        preset,
        background: "#fefefe",
        textColor: "#123456",
        buttonColor: "#ffffff",
        buttonRadius: 12,
      };
      expect(smartPageUpdateSchema.parse({ theme })).toEqual({ theme });
    }
  });
  it("rejects CSS injection, unknown templates and invalid radii", () => {
    for (const theme of [
      { preset: "missing" },
      { background: "url(https://example.com)" },
      { buttonRadius: 29 },
      { buttonRadius: -1 },
      { textColor: "red;display:none" },
    ])
      expect(smartPageThemeSchema.safeParse(theme).success).toBe(false);
  });
  it("selects contrasting button labels", () => {
    expect(readableInk("#ffffff")).toBe("#111111");
    expect(readableInk("#000000")).toBe("#ffffff");
    expect(readableInk("#dcf5a4")).toBe("#111111");
  });
});
