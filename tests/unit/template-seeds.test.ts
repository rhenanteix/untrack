import { describe, expect, it } from "vitest";
import templates from "../../prisma/seeds/templates.json";
import {
  smartPageInputSchema,
  smartPageBlockInputSchema,
} from "@/modules/smart-pages/schemas";
import {
  ANALYTICS_EVENTS,
  CLIENT_ANALYTICS_EVENTS,
} from "@/lib/analytics-events";

describe("template seed catalog", () => {
  it("provides unique, valid free and premium templates without workspace references", () => {
    expect(new Set(templates.map((t) => t.slug)).size).toBe(templates.length);
    expect(new Set(templates.map((t) => t.plan))).toEqual(
      new Set(["free", "premium"]),
    );
    for (const template of templates) {
      expect(
        smartPageInputSchema.safeParse({
          slug: template.slug,
          title: template.name,
          description: template.description,
          theme: template.theme,
          socialLinks: template.socialLinks,
        }).success,
      ).toBe(true);
      for (const block of template.blocks)
        expect(smartPageBlockInputSchema.safeParse(block).success).toBe(true);
    }
  });
  it("allows gallery interactions but reserves creation events for the server", () => {
    for (const event of ANALYTICS_EVENTS.filter((e) =>
      e.startsWith("template_"),
    ))
      expect(CLIENT_ANALYTICS_EVENTS).toContain(event);
    expect(CLIENT_ANALYTICS_EVENTS).not.toContain(
      "smart_page_created_from_template",
    );
  });
});
