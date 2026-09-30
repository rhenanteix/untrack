import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";

const campaignValue = z.string().trim().min(1, "Informe um valor.").max(200);

export const utmInputSchema = z
  .object({
    url: webUrlSchema,
    source: campaignValue,
    medium: campaignValue,
    campaign: campaignValue,
    term: z.string().trim().max(200).optional(),
    content: z.string().trim().max(200).optional(),
  })
  .strict();

export type UtmInput = z.infer<typeof utmInputSchema>;
