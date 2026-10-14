import { z } from "zod";

export const chargeStatusSchema = z.enum([
  "draft",
  "pending",
  "paid",
  "expired",
  "cancelled",
  "refunded",
]);

export const chargeCurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Informe uma moeda ISO 4217 válida.")
  .default("BRL");

export const chargeDateSchema = z.coerce.date().nullable().optional();

const chargeBaseSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição.")
    .max(500, "Use no máximo 500 caracteres."),
  amountInCents: z
    .number()
    .int("Use um valor inteiro em centavos.")
    .min(0, "O valor não pode ser negativo.")
    .max(99_999_999, "Valor muito alto."),
  currency: chargeCurrencySchema,
  customerId: z.string().nullable().optional(),
  dueAt: chargeDateSchema,
  offerId: z.string().nullable().optional(),
  metadata: z.record(z.string().max(80), z.unknown()).default({}),
});

export const chargeDraftUpdateSchema = chargeBaseSchema
  .partial()
  .strict()
  .superRefine((data, ctx) => {
    if (data.amountInCents !== undefined && data.amountInCents < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountInCents"],
        message: "O valor não pode ser negativo.",
      });
    }
    if (data.currency !== undefined && data.currency !== "BRL") {
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Apenas BRL é suportado.",
      });
    }
  });

export const chargeInputSchema = chargeBaseSchema
  .extend({
    status: chargeStatusSchema.default("draft"),
  })
  .superRefine((data, ctx) => {
    if (data.amountInCents < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amountInCents"],
        message: "O valor não pode ser negativo.",
      });
    }
  });

export const chargeUpdateSchema = chargeDraftUpdateSchema;

export const chargeActivateSchema = z.object({}).strict();

export const chargeCancelSchema = z
  .object({
    reason: z.string().trim().max(500).default(""),
  })
  .strict();

export const CHARGE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending", "cancelled"],
  pending: ["paid", "expired", "cancelled"],
  paid: ["refunded"],
  expired: [],
  cancelled: [],
  refunded: [],
};

export type ChargeStatus = z.infer<typeof chargeStatusSchema>;
export type ChargeInput = z.infer<typeof chargeInputSchema>;
export type ChargeUpdate = z.infer<typeof chargeUpdateSchema>;
export type ChargeCancel = z.infer<typeof chargeCancelSchema>;
