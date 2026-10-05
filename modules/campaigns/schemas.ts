import { z } from "zod";

export const campaignStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "archived",
]);

export const channelTypeSchema = z.enum([
  "social",
  "email",
  "paid",
  "organic",
  "qr",
  "link",
  "whatsapp",
  "partner",
  "offline",
  "other",
]);

export const campaignObjectiveTypeSchema = z.enum([
  "sales",
  "leads",
  "traffic",
  "registrations",
  "event",
  "whatsapp",
  "engagement",
  "awareness",
  "other",
]);

export const destinationTypeSchema = z.enum([
  "url",
  "smart_page",
  "whatsapp",
  "product",
  "landing_page",
  "other",
]);

export const monitorStatusSchema = z.enum([
  "up",
  "down",
  "degraded",
  "unknown",
]);

export const incidentStatusSchema = z.enum([
  "open",
  "confirmed",
  "recovered",
  "ignored",
]);

export const incidentSeveritySchema = z.enum(["info", "warning", "critical"]);

export const checklistStatusSchema = z.enum([
  "pending",
  "approved",
  "blocked",
  "warning",
]);

export const checklistSeveritySchema = z.enum(["info", "warning", "blocker"]);

export const approvalActionSchema = z.enum(["approved", "rejected"]);

export const notificationAdapterSchema = z.enum([
  "email",
  "webhook",
  "slack",
  "teams",
]);

export const deliveryStatusSchema = z.enum([
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(120),
  description: z.string().max(2000).optional().default(""),
  clientId: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  objective: z.string().max(1000).optional().default(""),
  objectiveType: campaignObjectiveTypeSchema.optional().nullable(),
  primaryGoalId: z.string().max(255).optional().nullable(),
  primaryDestinationType: destinationTypeSchema.optional().nullable(),
  primaryDestinationId: z.string().max(255).optional().nullable(),
  primaryDestinationUrl: z.string().url().max(4096).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: campaignStatusSchema.default("draft"),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignBuilderSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(120),
    description: z.string().trim().max(2000).default(""),
    clientId: z.string().optional().nullable(),
    responsibleId: z.string().optional().nullable(),
    objectiveType: campaignObjectiveTypeSchema,
    objectiveDescription: z.string().trim().max(1000).default(""),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    primaryDestinationType: destinationTypeSchema,
    primaryDestinationId: z.string().max(255).optional().nullable(),
    primaryDestinationUrl: z.string().url().max(4096),
    channels: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          type: channelTypeSchema,
        }),
      )
      .max(20)
      .default([]),
  })
  .superRefine((input, context) => {
    if (input.endDate && input.startDate && input.endDate < input.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "A data final deve ser posterior à data inicial.",
      });
    }
  });

export const campaignResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  clientId: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  objective: z.string(),
  primaryGoalId: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  status: campaignStatusSchema,
  approvalStatus: z.string().optional().nullable(),
  approvedAt: z.coerce.date().optional().nullable(),
  approvedById: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(120),
  type: channelTypeSchema,
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  utmTerm: z.string().max(120).optional().nullable(),
  utmContent: z.string().max(120).optional().nullable(),
  destinationUrl: z.string().url().max(4096),
  shortLinkId: z.string().optional().nullable(),
  qrId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  monitorEnabled: z.boolean().default(false),
  monitorFrequencyMinutes: z.number().int().positive().default(60),
  monitorPaused: z.boolean().default(false),
  alternativeDestinationUrl: z.string().url().max(4096).optional().nullable(),
  autoRedirectOnIncident: z.boolean().default(false),
});

export const updateChannelSchema = createChannelSchema.partial();

export const campaignAssetModeSchema = z.enum(["link", "qr", "whatsapp"]);

export const createCampaignAssetSchema = z
  .object({
    channelId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    assetType: z.string().trim().min(1).max(80),
    mode: campaignAssetModeSchema,
    destinationType: destinationTypeSchema.optional(),
    destinationId: z.string().max(255).optional().nullable(),
    destinationUrl: z.string().url().max(4096).optional(),
    phoneNumber: z.string().trim().min(1).max(80).optional(),
    message: z.string().max(4096).optional().default(""),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
  })
  .superRefine((input, context) => {
    if (input.mode !== "whatsapp" && !input.destinationUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationUrl"],
        message: "Informe o destino deste ponto de distribuição.",
      });
    }
    if (input.mode === "whatsapp" && !input.phoneNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phoneNumber"],
        message: "Informe o número do WhatsApp.",
      });
    }
  });

export const channelResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  name: z.string(),
  type: channelTypeSchema,
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  destinationUrl: z.string(),
  shortLinkId: z.string().optional().nullable(),
  qrId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  monitorEnabled: z.boolean(),
  monitorFrequencyMinutes: z.number(),
  monitorPaused: z.boolean(),
  alternativeDestinationUrl: z.string().optional().nullable(),
  autoRedirectOnIncident: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const checklistItemSchema = z.object({
  category: z.string().max(60),
  label: z.string().max(200),
  status: checklistStatusSchema.default("pending"),
  severity: checklistSeveritySchema.default("warning"),
  details: z.string().max(2000).optional().default(""),
  channelId: z.string().optional().nullable(),
});

export const checklistItemResponseSchema = checklistItemSchema.extend({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  checkedAt: z.coerce.date().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const monitorCheckResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  channelId: z.string().optional().nullable(),
  url: z.string(),
  httpStatus: z.number().optional().nullable(),
  responseTimeMs: z.number().optional().nullable(),
  finalUrl: z.string().optional().nullable(),
  redirectChain: z.any(),
  connectionError: z.string().optional().nullable(),
  certExpiresAt: z.coerce.date().optional().nullable(),
  certIssuer: z.string().optional().nullable(),
  status: monitorStatusSchema,
  checkedAt: z.coerce.date(),
});

export const incidentResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  channelId: z.string().optional().nullable(),
  code: z.string(),
  message: z.string(),
  status: incidentStatusSchema,
  severity: incidentSeveritySchema,
  confirmed: z.boolean(),
  dedupeKey: z.string(),
  cooldownUntil: z.coerce.date().optional().nullable(),
  recoveredAt: z.coerce.date().optional().nullable(),
  metadata: z.any(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const approvalResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  campaignId: z.string(),
  approverId: z.string(),
  action: z.string(),
  notes: z.string(),
  createdAt: z.coerce.date(),
});

export const campaignKitInputSchema = z.object({
  destination: z.string().url(),
  channels: z.array(
    z.object({ type: channelTypeSchema, name: z.string().max(120) }),
  ),
  namingPattern: z.string().max(200).optional().default(""),
  campaignName: z.string().max(120).optional(),
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
});

export const campaignKitProposalSchema = z.object({
  channels: z.array(
    z.object({
      name: z.string(),
      type: channelTypeSchema,
      destinationUrl: z.string(),
      utmSource: z.string().optional().nullable(),
      utmMedium: z.string().optional().nullable(),
      utmCampaign: z.string().optional().nullable(),
      utmTerm: z.string().optional().nullable(),
      utmContent: z.string().optional().nullable(),
      shortLinkSlug: z.string().optional().nullable(),
      qrToken: z.string().optional().nullable(),
    }),
  ),
});

export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type ChannelType = z.infer<typeof channelTypeSchema>;
export type CampaignObjectiveType = z.infer<typeof campaignObjectiveTypeSchema>;
export type DestinationType = z.infer<typeof destinationTypeSchema>;
export type MonitorStatus = z.infer<typeof monitorStatusSchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type ChecklistStatus = z.infer<typeof checklistStatusSchema>;
export type ChecklistSeverity = z.infer<typeof checklistSeveritySchema>;
export type ApprovalAction = z.infer<typeof approvalActionSchema>;
export type NotificationAdapter = z.infer<typeof notificationAdapterSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignBuilderInput = z.infer<typeof campaignBuilderSchema>;
export type CampaignResponse = z.infer<typeof campaignResponseSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type CreateCampaignAssetInput = z.infer<
  typeof createCampaignAssetSchema
>;
export type ChannelResponse = z.infer<typeof channelResponseSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type ChecklistItemResponse = z.infer<typeof checklistItemResponseSchema>;
export type MonitorCheckResponse = z.infer<typeof monitorCheckResponseSchema>;
export type IncidentResponse = z.infer<typeof incidentResponseSchema>;
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;
export type CampaignKitInput = z.infer<typeof campaignKitInputSchema>;
export type CampaignKitProposal = z.infer<typeof campaignKitProposalSchema>;
