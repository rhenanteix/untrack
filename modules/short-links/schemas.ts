import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";

export const shortLinkInputSchema = z
  .object({
    url: webUrlSchema,
    title: z.string().trim().max(120).default(""),
    description: z.string().trim().max(500).default(""),
  })
  .strict();

export const updateShortLinkSchema = z
  .object({ isActive: z.boolean() })
  .strict();
export const slugSchema = z.string().regex(/^[A-Za-z0-9_-]{10}$/);

export const historyImportSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            originalUrl: webUrlSchema,
            cleanUrl: webUrlSchema,
            createdAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
