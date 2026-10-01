import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";

const reservedSlugs = new Set(["new", "api", "admin"]);

export const smartPageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(60)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras minúsculas, números e hífens.",
  )
  .refine((value) => !reservedSlugs.has(value), "Slug reservado.");

export const smartPageStatusSchema = z.enum(["draft", "published"]);

export const smartPageInputSchema = z
  .object({
    slug: smartPageSlugSchema,
    title: z.string().trim().min(1, "Informe um título.").max(120),
    description: z.string().trim().max(500).default(""),
    avatarUrl: webUrlSchema.nullable().optional(),
  })
  .strict();

export const smartPageUpdateSchema = smartPageInputSchema
  .omit({ slug: true })
  .extend({
    slug: smartPageSlugSchema.optional(),
    avatarUrl: webUrlSchema.nullable().optional(),
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
