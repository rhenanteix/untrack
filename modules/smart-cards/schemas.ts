import { z } from "zod";
import {
  normalizeSocialUrl,
  socialProviderIds,
} from "@/modules/social-providers";
import { webUrlSchema } from "@/modules/validation/url-validation";

const reservedSlugs = new Set(["api", "admin", "c", "new"]);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,24}$/, "Informe um telefone válido.");
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const smartCardSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use pelo menos 3 caracteres no endereço.")
  .max(60, "Use no máximo 60 caracteres no endereço.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letras de a a z, números e hífens entre palavras.",
  )
  .refine(
    (value) => !reservedSlugs.has(value),
    "Este endereço é reservado pelo sistema.",
  );

export const smartCardThemeSchema = z
  .object({
    preset: z
      .enum(["minimal", "professional", "creator", "dark", "bold", "corporate"])
      .default("professional"),
    background: colorSchema.optional(),
    backgroundSecondary: colorSchema.optional(),
    backgroundImageUrl: webUrlSchema.optional(),
    textColor: colorSchema.optional(),
    buttonColor: colorSchema.optional(),
    buttonTextColor: colorSchema.optional(),
    buttonRadius: z.number().int().min(0).max(24).optional(),
    avatarShape: z.enum(["circle", "rounded", "square"]).optional(),
    font: z.enum(["sans", "serif", "mono"]).optional(),
  })
  .strict();

export const defaultSmartCardTheme = {
  preset: "professional" as const,
};

const fieldKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-zA-Z0-9_]*$/, "Use uma chave simples para o campo.");

export const smartCardContactFieldSchema = z
  .object({
    key: fieldKeySchema,
    label: z.string().trim().min(1).max(80),
    type: z.enum(["text", "email", "tel", "select"]).default("text"),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.type === "select" && field.options.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Campos de seleção precisam de pelo menos duas opções.",
      });
    }
    if (field.type !== "select" && field.options.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["options"],
        message: "Opções só são aceitas em campos de seleção.",
      });
    }
  });

export const defaultSmartCardContactForm = {
  fields: [
    {
      key: "firstName",
      label: "Nome",
      type: "text" as const,
      required: true,
      options: [],
    },
    {
      key: "email",
      label: "E-mail",
      type: "email" as const,
      required: true,
      options: [],
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      type: "tel" as const,
      required: false,
      options: [],
    },
  ],
  publicDetails: {
    phone: true,
    whatsapp: true,
    email: true,
    website: true,
  },
  intent: {
    enabled: true,
    label: "Como posso ajudar?",
    options: [
      "Conhecer produto",
      "Solicitar orçamento",
      "Parceria",
      "Networking",
    ],
  },
  primaryCta: "share_contact" as const,
};

export const smartCardContactFormSchema = z
  .object({
    fields: z.array(smartCardContactFieldSchema).min(1).max(10),
    publicDetails: z
      .object({
        phone: z.boolean().default(true),
        whatsapp: z.boolean().default(true),
        email: z.boolean().default(true),
        website: z.boolean().default(true),
      })
      .strict()
      .default(defaultSmartCardContactForm.publicDetails),
    intent: z
      .object({
        enabled: z.boolean().default(true),
        label: z.string().trim().min(1).max(120).default("Como posso ajudar?"),
        options: z.array(z.string().trim().min(1).max(80)).min(2).max(12),
      })
      .strict(),
    primaryCta: z
      .enum(["save_contact", "share_contact", "first_action"])
      .default("share_contact"),
  })
  .strict()
  .superRefine((form, context) => {
    if (
      new Set(form.fields.map((field) => field.key)).size !== form.fields.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Cada campo deve ter uma chave única.",
      });
    }
  });

const actionUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine(
    (value) =>
      value.startsWith("/") ||
      value.startsWith("mailto:") ||
      value.startsWith("tel:") ||
      webUrlSchema.safeParse(value).success,
    "Informe uma URL, telefone, e-mail ou caminho válido.",
  );

export const smartCardActionInputSchema = z
  .object({
    type: z.enum([
      "website",
      "whatsapp",
      "email",
      "phone",
      "calendar",
      "smartPage",
      "custom",
    ]),
    label: z.string().trim().min(1).max(80),
    url: actionUrlSchema,
    visible: z.boolean().default(true),
    analyticsEnabled: z.boolean().default(true),
  })
  .strict();

const nullableUrlSchema = webUrlSchema.nullable().optional();
const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const smartCardContactPointSchema = z
  .object({
    type: z.enum(["phone", "email"]),
    value: z.string().trim().min(1).max(254),
    label: z.string().trim().max(40).optional(),
  })
  .strict()
  .superRefine((point, context) => {
    const valid =
      point.type === "phone"
        ? phoneSchema.safeParse(point.value).success
        : z.string().email().safeParse(point.value).success;
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message:
          point.type === "phone"
            ? "Informe um telefone válido."
            : "Informe um e-mail válido.",
      });
    }
  });

export const smartCardSocialLinkSchema = z
  .object({
    providerId: z.enum(socialProviderIds),
    url: z.string().trim().min(1).max(4096),
    label: z.string().trim().max(80).optional(),
  })
  .strict()
  .superRefine((link, context) => {
    if (!normalizeSocialUrl(link.providerId, link.url)) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Informe um endereço válido para esta rede.",
      });
    }
  })
  .transform((link) => ({
    ...link,
    url: normalizeSocialUrl(link.providerId, link.url) ?? link.url,
  }));

export const smartCardSocialLinksSchema = z
  .array(smartCardSocialLinkSchema)
  .max(20);

export const smartCardInputSchema = z
  .object({
    slug: smartCardSlugSchema,
    firstName: z.string().trim().min(1, "Informe o nome.").max(80),
    lastName: z.string().trim().max(80).default(""),
    headline: z.string().trim().max(160).default(""),
    company: z.string().trim().max(120).default(""),
    bio: z.string().trim().max(500).default(""),
    avatarUrl: nullableUrlSchema,
    logoUrl: nullableUrlSchema,
    phone: phoneSchema.nullable().optional(),
    whatsapp: phoneSchema.nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    websiteUrl: nullableUrlSchema,
    location: nullableText(160),
    contactPoints: z.array(smartCardContactPointSchema).max(8).default([]),
    socialLinks: smartCardSocialLinksSchema.default([]),
    theme: smartCardThemeSchema.default(defaultSmartCardTheme),
    contactForm: smartCardContactFormSchema.default(
      defaultSmartCardContactForm,
    ),
    privacyPolicyUrl: nullableUrlSchema,
    campaignId: z.string().min(1).max(200).nullable().optional(),
    actions: z.array(smartCardActionInputSchema).max(20).default([]),
  })
  .strict();

export const smartCardUpdateSchema = smartCardInputSchema.partial().strict();

export const smartCardCaptureSchema = z
  .object({
    values: z.record(z.string().max(40), z.string().trim().max(500)),
    intent: z.string().trim().max(160).optional(),
    source: z.string().trim().min(1).max(80).default("direct"),
    sourceLabel: z.string().trim().max(120).optional(),
    visitorId: z.string().uuid(),
    sessionId: z.string().uuid().optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    consent: z.literal(true),
  })
  .strict();

export const smartCardEventSchema = z
  .object({
    event: z.enum([
      "card_view",
      "card_share",
      "qr_scan",
      "nfc_open",
      "apple_wallet_add_click",
      "google_wallet_add_click",
      "contact_save",
      "contact_form_open",
      "contact_exchange_open",
      "contact_exchange_submit",
      "link_click",
      "social_click",
      "whatsapp_click",
      "booking_click",
    ]),
    slug: smartCardSlugSchema,
    eventId: z.string().uuid().optional(),
    visitorId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    actionId: z.string().min(1).max(200).optional(),
    providerId: z.enum(socialProviderIds).optional(),
    contactId: z.string().min(1).max(200).optional(),
    source: z.string().trim().min(1).max(80).default("direct"),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      ["link_click", "whatsapp_click", "booking_click"].includes(input.event) &&
      !input.actionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["actionId"],
        message: "Informe a ação do cartão.",
      });
    }
    if (input.event === "social_click" && !input.providerId) {
      context.addIssue({
        code: "custom",
        path: ["providerId"],
        message: "Informe a rede social acessada.",
      });
    }
  });

export type SmartCardInput = z.infer<typeof smartCardInputSchema>;
export type SmartCardActionInput = z.infer<typeof smartCardActionInputSchema>;
export type SmartCardContactForm = z.infer<typeof smartCardContactFormSchema>;
