import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";

export const productTypeSchema = z.enum([
  "physical",
  "digital",
  "course",
  "booking",
  "session",
  "mentorship",
  "coaching",
  "bundle",
  "event",
  "subscription",
]);

export const productStatusSchema = z.enum(["draft", "active", "archived"]);

export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres no endereço do produto.")
  .max(140, "Use no máximo 140 caracteres no endereço do produto.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras de a a z, números e hífens entre palavras.",
  );

const productDateSchema = z.coerce.date().nullable().optional();

const productFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Informe um nome.").max(120),
    slug: productSlugSchema,
    description: z.string().trim().max(5000).default(""),
    type: productTypeSchema,
    status: productStatusSchema.default("draft"),
    priceInCents: z.number().int().min(0).max(999_999_999),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Informe uma moeda ISO 4217 válida.")
      .default("BRL"),
    images: z.array(webUrlSchema).max(8).default([]),
    metadata: z.record(z.string().max(80), z.unknown()).default({}),
    visible: z.boolean().default(true),
    startAt: productDateSchema,
    endAt: productDateSchema,
  })
  .strict();

function validateAvailabilityWindow(
  product: { startAt?: Date | null; endAt?: Date | null },
  context: z.RefinementCtx,
) {
  if (product.startAt && product.endAt && product.endAt <= product.startAt) {
    context.addIssue({
      code: "custom",
      path: ["endAt"],
      message: "O fim da visibilidade deve ser posterior ao início.",
    });
  }
}

export const productInputSchema = productFieldsSchema.superRefine(
  validateAvailabilityWindow,
);

export const productUpdateSchema = productFieldsSchema
  .partial()
  .strict()
  .superRefine(validateAvailabilityWindow);

export const productBlockSettingsSchema = z
  .object({
    buttonLabel: z.string().trim().min(1).max(40).default("Ver produto"),
  })
  .strict();

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;