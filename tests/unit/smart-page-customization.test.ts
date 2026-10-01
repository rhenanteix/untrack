import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImage, MAX_IMAGE_BYTES } from "@/modules/smart-pages/images";
import { smartPageThemeSchema } from "@/modules/smart-pages/schemas";
import {
  requireSmartPages,
  SMART_PAGES_PRODUCT,
} from "@/modules/billing/plans";
describe("Smart Page customization", () => {
  it("round trips all supported settings", () => {
    const theme = {
      preset: "minimal",
      layout: "card",
      font: "serif",
      alignment: "left",
      avatarShape: "square",
      buttonStyle: "outline",
      photoLayout: "hero",
      logoUrl: "https://cdn.example/logo.webp",
      titleStyle: "editorial",
      wallpaper: "image",
      backgroundImageUrl: "https://cdn.example/wallpaper.webp",
      sections: ["title", "avatar", "links", "description", "socials"],
      hiddenSections: ["description"],
      buttonRadius: 20,
    };
    expect(smartPageThemeSchema.parse(theme)).toEqual(theme);
  });
  it("rejects missing and duplicated sections", () => {
    for (const sections of [
      ["title"],
      ["title", "title", "links", "description", "socials"],
    ])
      expect(smartPageThemeSchema.safeParse({ sections }).success).toBe(false);
  });
  it("does not accept CSS or hidden mandatory content", () => {
    expect(smartPageThemeSchema.safeParse({ font: "url(evil)" }).success).toBe(
      false,
    );
    expect(
      smartPageThemeSchema.safeParse({ hiddenSections: ["links"] }).success,
    ).toBe(false);
    expect(
      smartPageThemeSchema.safeParse({
        backgroundImageUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      smartPageThemeSchema.safeParse({ wallpaper: "remote-css" }).success,
    ).toBe(false);
  });
  it("accepts safe external image and video wallpapers", () => {
    expect(
      smartPageThemeSchema.parse({
        wallpaper: "image",
        backgroundImageUrl: "https://cdn.example/wallpaper.webp",
      }),
    ).toMatchObject({ wallpaper: "image" });
    expect(
      smartPageThemeSchema.parse({
        wallpaper: "video",
        backgroundVideoUrl: "https://cdn.example/wallpaper.mp4",
      }),
    ).toMatchObject({ wallpaper: "video" });
  });
  it("requires paid entitlement without enabling charges", () => {
    expect(() => requireSmartPages("free")).toThrow();
    expect(() => requireSmartPages("pro")).not.toThrow();
    expect(SMART_PAGES_PRODUCT).toMatchObject({
      priceInCents: 4590,
      checkoutEnabled: false,
    });
  });
  it("reencodes uploaded images and bounds dimensions", async () => {
    const original = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    const output = await optimizeImage(original);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(800);
    expect(meta.exif).toBeUndefined();
  });
  it("rejects SVG, malformed and oversized uploads", async () => {
    await expect(
      optimizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(optimizeImage(Buffer.from("hello"))).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
    await expect(
      optimizeImage(Buffer.alloc(MAX_IMAGE_BYTES + 1)),
    ).rejects.toMatchObject({ status: 413 });
  });
});
