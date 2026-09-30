import { z } from "zod";
import { TRACKER_CATEGORIES } from "./tracker-categories";
import { webUrlSchema } from "@/modules/validation/url-validation";

export const urlInputSchema = z.object({ url: webUrlSchema }).strict();

export const trackerCategorySchema = z.enum(
  Object.keys(TRACKER_CATEGORIES) as [
    keyof typeof TRACKER_CATEGORIES,
    ...(keyof typeof TRACKER_CATEGORIES)[],
  ],
);

export const analyzeInputSchema = z
  .object({
    url: webUrlSchema,
    categories: z
      .array(trackerCategorySchema)
      .max(Object.keys(TRACKER_CATEGORIES).length)
      .default(
        Object.keys(TRACKER_CATEGORIES) as Array<
          keyof typeof TRACKER_CATEGORIES
        >,
      ),
  })
  .strict();

export type UrlInput = z.infer<typeof urlInputSchema>;
export type AnalyzeInput = z.infer<typeof analyzeInputSchema>;
