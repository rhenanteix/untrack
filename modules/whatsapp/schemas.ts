import { z } from "zod";
import { WHATSAPP_MESSAGE_MAX_LENGTH } from "./domain";

export const whatsappLinkStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);

export const whatsappTrackingSchema = z
  .object({
    enabled: z.boolean().default(true),
    source: z.string().trim().max(120).optional(),
    medium: z.string().trim().max(120).optional(),
    campaign: z.string().trim().max(120).optional(),
    content: z.string().trim().max(120).optional(),
    term: z.string().trim().max(120).optional(),
  })
  .strict();

const identifierSchema = z.string().trim().min(1).max(200);

export const createWhatsappLinkSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(120),
    phoneNumber: z.string().trim().min(1).max(80),
    message: z.string().max(WHATSAPP_MESSAGE_MAX_LENGTH).default(""),
    campaignId: identifierSchema.nullable().optional(),
    projectId: identifierSchema.nullable().optional(),
    status: whatsappLinkStatusSchema.default("ACTIVE"),
    trackingConfig: whatsappTrackingSchema.default({ enabled: true }),
    allowDuplicate: z.boolean().default(false),
  })
  .strict();

export const updateWhatsappLinkSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(120).optional(),
    phoneNumber: z.string().trim().min(1).max(80).optional(),
    message: z.string().max(WHATSAPP_MESSAGE_MAX_LENGTH).optional(),
    campaignId: identifierSchema.nullable().optional(),
    projectId: identifierSchema.nullable().optional(),
    status: whatsappLinkStatusSchema.optional(),
    trackingConfig: whatsappTrackingSchema.optional(),
  })
  .strict();

export type WhatsappTracking = z.infer<typeof whatsappTrackingSchema>;
export type CreateWhatsappLinkInput = z.infer<typeof createWhatsappLinkSchema>;
export type UpdateWhatsappLinkInput = z.infer<typeof updateWhatsappLinkSchema>;