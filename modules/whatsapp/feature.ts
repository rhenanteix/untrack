import { ApiError } from "@/lib/api-response";

export function isWhatsAppIntelligenceEnabled() {
  return process.env.WHATSAPP_INTELLIGENCE !== "false";
}

export function requireWhatsAppIntelligence() {
  if (!isWhatsAppIntelligenceEnabled())
    throw new ApiError(404, "WHATSAPP_INTELLIGENCE_DISABLED", "WhatsApp Intelligence não está habilitado neste ambiente.");
}