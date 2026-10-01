import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const qrInputSchema = z
  .object({
    url: webUrlSchema,
    format: z.enum(["dataUrl", "png"]).default("dataUrl"),
    width: z.number().int().min(128).max(1_024).default(512),
    margin: z.number().int().min(0).max(10).default(2),
    errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("M"),
    foreground: colorSchema.default("#172A3A"),
    background: colorSchema.default("#FFFFFF"),
    frame: z.enum(["none", "rounded", "scan"]).default("none"),
    frameText: z.string().trim().max(40).default("ESCANEIE"),
  })
  .strict();

export type QrInput = z.infer<typeof qrInputSchema>;
export type QrFormat = QrInput["format"];
