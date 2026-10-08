import { getPrisma } from "@/lib/prisma";
import {
  recordAnalyticsEvent,
  type RecordAnalyticsEventInput,
} from "@/modules/analytics/service";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
  trustedCampaignContext,
} from "@/modules/analytics/public-context";
import type { z } from "zod";
import { smartCardEventSchema } from "./schemas";

export const publicSmartCardEventNames = [
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
] as const;

export async function recordPublicSmartCardEvent(
  input: z.infer<typeof smartCardEventSchema>,
  headers: Headers,
) {
  const db = getPrisma();
  const card = await db.smartCard.findFirst({
    where: { slug: input.slug, status: "published" },
    select: { id: true, workspaceId: true, campaignId: true },
  });
  if (!card) return { recorded: false, cookieHeaders: [] };

  let action: { id: string; type: string } | null = null;
  if (input.actionId) {
    action = await db.smartCardAction.findFirst({
      where: {
        id: input.actionId,
        smartCardId: card.id,
        visible: true,
        analyticsEnabled: true,
      },
      select: { id: true, type: true },
    });
    if (!action) return { recorded: false, cookieHeaders: [] };
  }
  const context = resolvePublicAnalyticsContext(
    headers,
    { visitorId: input.visitorId, sessionId: input.sessionId },
    {
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      utmTerm: input.utmTerm,
    },
  );
  if (!context.trackingAllowed)
    return { recorded: false, cookieHeaders: [] };
  const attribution = resolveAttribution({
    ...context.attribution,
    referrer: headers.get("referer"),
  });
  const inherited = trustedCampaignContext(headers);
  const inheritedCampaign = inherited.campaignId
    ? await db.campaign.findFirst({
        where: { id: inherited.campaignId, workspaceId: card.workspaceId },
        select: { id: true },
      })
    : null;
  const campaignId = inheritedCampaign?.id ?? card.campaignId ?? undefined;
  const campaignAsset =
    campaignId && inherited.campaignAssetId
      ? await db.campaignAsset.findFirst({
          where: {
            id: inherited.campaignAssetId,
            workspaceId: card.workspaceId,
            campaignId,
          },
          select: { id: true },
        })
      : null;
const name: RecordAnalyticsEventInput["name"] =
    input.event === "card_view" || input.event === "nfc_open"
      ? "smart_card_view"
      : input.event === "card_share"
        ? "share_details_open"
        : input.event === "qr_scan"
          ? "qr_scan"
            : input.event === "apple_wallet_add_click"
              ? "apple_wallet_add_click"
              : input.event === "google_wallet_add_click"
                ? "google_wallet_add_click"
            : input.event === "contact_save"
              ? "save_contact_click"
              : input.event === "contact_form_open"
                ? "form_view"
                : input.event === "contact_exchange_open"
                  ? "contact_exchange_open"
                  : input.event === "contact_exchange_submit"
                    ? "contact_exchange_submit"
                    : input.event === "whatsapp_click"
                      ? "whatsapp_click"
                      : input.event === "social_click"
                        ? "social_click"
                        : input.event === "booking_click"
                          ? "button_click"
                          : action?.type === "website"
                            ? "website_click"
                            : "link_click";
  const result = await recordAnalyticsEvent({
    name,
    eventId: input.eventId,
    workspaceId: card.workspaceId,
    visitorKey: context.identity.visitorId,
    sessionKey: context.identity.sessionId,
    assetType: "smart_card",
    assetId: card.id,
    elementType: action ? "action" : input.event === "social_click" ? "social_link" : undefined,
    elementId: action?.id ?? input.providerId,
    campaignId,
    campaignAssetId: campaignAsset?.id,
    smartCardId: card.id,
    smartCardActionId: action?.id,
    path: `/c/${input.slug}`,
    attribution: context.attribution,
    origin: "client",
    headers,
  });
  if (input.contactId) {
    const exchange = await db.smartCardContactExchange.findFirst({
      where: { smartCardId: card.id, contactId: input.contactId },
      select: { contactId: true },
    });
    if (exchange) {
      const timelineName =
        input.event === "card_view"
          ? "card_viewed"
          : input.event === "link_click"
            ? "link_clicked"
            : input.event === "whatsapp_click"
              ? "whatsapp_clicked"
              : input.event === "booking_click"
                ? "booking_clicked"
                : input.event === "contact_exchange_open"
                  ? "contact_exchange_opened"
                  : input.event === "contact_exchange_submit"
                    ? "contact_exchange_submitted"
                    : input.event;
      await db.audienceContactEvent.create({
        data: {
          workspaceId: card.workspaceId,
          contactId: exchange.contactId,
          name: timelineName,
          metadata: {
            smartCardId: card.id,
            actionId: action?.id ?? null,
            source: input.source,
          },
        },
      });
    }
  }
  return {
    recorded: result.recorded || result.duplicate,
    cookieHeaders: publicAnalyticsContextCookies(headers, context, attribution, {
      campaignId,
      campaignAssetId: campaignAsset?.id,
      qrContext: inherited.qrContext,
    }),
  };
}
