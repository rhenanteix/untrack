import { z } from "zod";
import { themeIds } from "./themes";
import { webUrlSchema } from "@/modules/validation/url-validation";

const reservedSlugs = new Set(["new", "api", "admin"]);

export const smartPageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres no endereço.")
  .max(60, "Use no máximo 60 caracteres no endereço.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras de a a z, números e hífens entre palavras. Espaços, acentos, símbolos e hífens repetidos não são aceitos. Exemplo: ana-silva.",
  )
  .refine(
    (value) => !reservedSlugs.has(value),
    "Este endereço é reservado pelo sistema. Escolha outro, como ana-silva.",
  );

export const smartPageStatusSchema = z.enum(["draft", "published"]);

export const smartPageThemeSchema = z
  .object({
    preset: z.enum(themeIds).default("minimal"),
    avatarSize: z.number().int().min(48).max(144).optional(),
    titleSize: z.number().int().min(24).max(48).optional(),
    spacing: z.number().int().min(8).max(32).optional(),
    layout: z.enum(["card", "full"]).optional(),
    font: z.enum(["sans", "serif", "mono", "manrope", "georgia", "courier"]).optional(),
    alignment: z.enum(["center", "left"]).optional(),
    avatarShape: z.enum(["circle", "rounded", "square"]).optional(),
    buttonStyle: z.enum(["solid", "outline", "soft"]).optional(),
    photoLayout: z
      .enum(["classic", "hero", "banner", "cutout", "shape"])
      .optional(),
    logoUrl: webUrlSchema.optional(),
    titleStyle: z
      .enum(["classic", "editorial", "bold", "uppercase"])
      .optional(),
    wallpaper: z
      .enum(["fill", "gradient", "blur", "pattern", "image", "video"])
      .optional(),
    backgroundGradient: z
      .enum(["aurora", "sunset", "ocean", "orchid"])
      .optional(),
    backgroundPattern: z.enum(["dots", "grid", "lines", "waves"]).optional(),
    backgroundImageUrl: webUrlSchema.optional(),
    backgroundVideoUrl: webUrlSchema.optional(),
    sections: z
      .array(z.enum(["avatar", "title", "description", "links", "socials"]))
      .length(5)
      .refine(
        (items) => new Set(items).size === 5,
        "Cada seção deve aparecer uma única vez.",
      )
      .optional(),
    hiddenSections: z
      .array(z.enum(["avatar", "description", "socials"]))
      .max(3)
      .refine(
        (items) => new Set(items).size === items.length,
        "Seções repetidas.",
      )
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    textColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    buttonColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    buttonRadius: z.number().int().min(0).max(28).optional(),
  })
  .strict();

export const socialLinksSchema = z
  .array(
    z
      .object({
        network: z.enum([
          "instagram",
          "tiktok",
          "youtube",
          "linkedin",
          "x",
          "facebook",
          "whatsapp",
          "website",
        ]),
        url: webUrlSchema,
      })
      .strict(),
  )
  .max(8)
  .superRefine((links, context) => {
    if (new Set(links.map((link) => link.network)).size !== links.length) {
      context.addIssue({
        code: "custom",
        message: "Cada rede pode ser informada apenas uma vez.",
      });
    }
  });

export const smartPageInputSchema = z
  .object({
    slug: smartPageSlugSchema,
    title: z.string().trim().min(1, "Informe um título.").max(120),
    description: z.string().trim().max(500).default(""),
    avatarUrl: webUrlSchema.nullable().optional(),
    theme: smartPageThemeSchema.default({ preset: "minimal" }),
    socialLinks: socialLinksSchema.default([]),
  })
  .strict();

export const smartPageUpdateSchema = smartPageInputSchema
  .omit({ slug: true })
  .extend({
    slug: smartPageSlugSchema.optional(),
    description: z.string().trim().max(500).optional(),
    avatarUrl: webUrlSchema.nullable().optional(),
    theme: smartPageThemeSchema.optional(),
    socialLinks: socialLinksSchema.optional(),
  })
  .partial()
  .strict();

export const linkBlockSettingsSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(120),
    destinationUrl: webUrlSchema.optional(),
    openInNewTab: z.boolean().default(true),
  })
  .strict();

export const smartPageBlockInputSchema = z
  .object({
    type: z.literal("link"),
    settings: linkBlockSettingsSchema,
    visible: z.boolean().default(true),
    analyticsEnabled: z.boolean().default(true),
    linkId: z.string().min(1).max(200).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.linkId && !value.settings.destinationUrl) {
      context.addIssue({
        code: "custom",
        path: ["settings", "destinationUrl"],
        message: "Informe um destino ou selecione um link gerenciado.",
      });
    }
  });

export type SmartPageInput = z.infer<typeof smartPageInputSchema>;
export type SmartPageUpdate = z.infer<typeof smartPageUpdateSchema>;
export type SmartPageBlockInput = z.infer<typeof smartPageBlockInputSchema>;
