export const WHATSAPP_MESSAGE_MAX_LENGTH = 4096;

export const WHATSAPP_MESSAGE_VARIABLES = [
  "campaign",
  "source",
  "product",
  "cta",
] as const;

export type WhatsAppMessageVariable =
  (typeof WHATSAPP_MESSAGE_VARIABLES)[number];

export type WhatsAppMessageVariables = Partial<
  Record<WhatsAppMessageVariable, string>
>;

export class WhatsAppInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppInputError";
  }
}

export function normalizeWhatsAppPhone(value: string): string {
  const input = value.trim();
  if (!input) throw new WhatsAppInputError("Informe um número de WhatsApp.");
  if (!/^\+?[0-9\s().-]+$/.test(input))
    throw new WhatsAppInputError("Use apenas código do país e números.");

  const phoneNumber = input.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(phoneNumber))
    throw new WhatsAppInputError(
      "Informe um número com código do país entre 8 e 15 dígitos.",
    );

  return phoneNumber;
}

export function validateWhatsAppMessage(message: string): string {
  if (message.length > WHATSAPP_MESSAGE_MAX_LENGTH)
    throw new WhatsAppInputError(
      `A mensagem deve ter no máximo ${WHATSAPP_MESSAGE_MAX_LENGTH} caracteres.`,
    );
  return message;
}

export function buildWhatsAppUrl(phoneNumber: string, message = ""): string {
  const phone = normalizeWhatsAppPhone(phoneNumber);
  const validatedMessage = validateWhatsAppMessage(message);
  const url = new URL(`https://wa.me/${phone}`);
  if (validatedMessage) url.searchParams.set("text", validatedMessage);
  return url.toString();
}

export function resolveWhatsAppMessage(
  template: string,
  values: WhatsAppMessageVariables,
): string {
  return validateWhatsAppMessage(
    template.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (placeholder, variable) => {
      if (!WHATSAPP_MESSAGE_VARIABLES.includes(variable as WhatsAppMessageVariable))
        return placeholder;
      return values[variable as WhatsAppMessageVariable] ?? placeholder;
    }),
  );
}

export interface WhatsAppLinkScoreInput {
  hasCampaign: boolean;
  hasHealthMonitoring: boolean;
  trackingEnabled: boolean;
  message: string;
  phoneNumber: string;
}

export interface WhatsAppLinkScore {
  score: number;
  checks: Array<{ label: string; configured: boolean; points: number }>;
}

export function scoreWhatsAppLink(
  input: WhatsAppLinkScoreInput,
): WhatsAppLinkScore {
  const checks = [
    {
      label: "Destination configured",
      configured: Boolean(normalizeWhatsAppPhone(input.phoneNumber)),
      points: 30,
    },
    {
      label: "Message configured",
      configured: Boolean(input.message.trim()),
      points: 20,
    },
    { label: "Tracking enabled", configured: input.trackingEnabled, points: 20 },
    { label: "Campaign connected", configured: input.hasCampaign, points: 15 },
    {
      label: "Monitoring enabled",
      configured: input.hasHealthMonitoring,
      points: 15,
    },
  ];
  return {
    score: checks.reduce(
      (total, check) => total + (check.configured ? check.points : 0),
      0,
    ),
    checks,
  };
}