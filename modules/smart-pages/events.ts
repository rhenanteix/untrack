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

export const publicSmartPageEventNames = [
  "smart_page_view",
  "smart_block_view",
  "form_view",
  "smart_block_clicked",
  "link_in_bio_product_view",
  "link_in_bio_product_click",
  "social_click",
] as const;

export type PublicSmartPageEventName =
  (typeof publicSmartPageEventNames)[number];

export async function recordPublicSmartPageEvent(
  input: {
    event: PublicSmartPageEventName;
    eventId?: string;
    slug: string;
    visitorId?: string;
    sessionId?: string;
    blockId?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  },
  headers: Headers,
) {
  const db = getPrisma();
  const page = await db.smartPage.findFirst({
    where: { slug: input.slug, status: "published" },
    select: { id: true, workspaceId: true },
  });
  if (!page) return { recorded: false, cookieHeaders: [] };

  const isBlockEvent =
    input.event !== "smart_page_view" && input.event !== "social_click";
  const isProductEvent = input.event.startsWith("link_in_bio_product_");
  let block: {
    id: string;
    type: string;
    link: { campaignId: string | null; destinationUrl: string } | null;
  } | null = null;
  if (isBlockEvent) {
    if (!input.blockId) return { recorded: false, cookieHeaders: [] };
    block = await db.smartPageBlock.findFirst({
      where: {
        id: input.blockId,
        smartPageId: page.id,
        visible: true,
        analyticsEnabled: true,
        ...(isProductEvent ? { type: "product" } : {}),
        ...(input.event === "form_view" ? { type: "form" } : {}),
      },
      select: {
        id: true,
        type: true,
        link: { select: { campaignId: true, destinationUrl: true } },
      },
    });
    if (!block) return { recorded: false, cookieHeaders: [] };
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
  if (!context.trackingAllowed) return { recorded: false, cookieHeaders: [] };
  const attribution = resolveAttribution({
    ...context.attribution,
    referrer: headers.get("referer"),
  });
  const inherited = trustedCampaignContext(headers);
  const campaign = inherited.campaignId
    ? await db.campaign.findFirst({
        where: { id: inherited.campaignId, workspaceId: page.workspaceId },
        select: { id: true },
      })
    : null;
  const campaignAsset =
    campaign && inherited.campaignAssetId
      ? await db.campaignAsset.findFirst({
          where: {
            id: inherited.campaignAssetId,
            workspaceId: page.workspaceId,
            campaignId: campaign.id,
          },
          select: { id: true },
        })
      : null;
  const destinationIsWhatsApp = Boolean(
    block?.link?.destinationUrl &&
    /^https:\/\/(?:wa\.me|(?:api\.|web\.)?whatsapp\.com)\//i.test(
      block.link.destinationUrl,
    ),
  );
  const name: RecordAnalyticsEventInput["name"] =
    input.event === "smart_page_view"
      ? "smart_page_view"
      : input.event === "form_view"
        ? "form_view"
        : input.event === "link_in_bio_product_view"
          ? "product_view"
          : input.event === "link_in_bio_product_click"
            ? "product_click"
            : input.event === "smart_block_clicked"
              ? block?.type === "whatsapp" || destinationIsWhatsApp
                ? "whatsapp_click"
                : block?.type === "link"
                  ? "link_click"
                  : "button_click"
              : input.event === "social_click"
                ? "social_click"
                : "block_view";
  const result = await recordAnalyticsEvent({
    name,
    eventId: input.eventId,
    workspaceId: page.workspaceId,
    visitorKey: context.identity.visitorId,
    sessionKey: context.identity.sessionId,
    assetType: "smart_page",
    assetId: page.id,
    elementType: block
      ? "block"
      : input.event === "social_click"
        ? "social"
        : undefined,
    elementId:
      block?.id ?? (input.event === "social_click" ? input.blockId : undefined),
    campaignId: campaign?.id ?? block?.link?.campaignId ?? undefined,
    campaignAssetId: campaignAsset?.id,
    smartPageId: page.id,
    smartPageBlockId: block?.id,
    path: `/${input.slug}`,
    attribution: context.attribution,
    origin: "client",
    headers,
  });
  return {
    recorded: result.recorded || result.duplicate,
    cookieHeaders: publicAnalyticsContextCookies(
      headers,
      context,
      attribution,
      {
        campaignId: campaign?.id ?? block?.link?.campaignId ?? undefined,
        campaignAssetId: campaignAsset?.id,
        qrContext: inherited.qrContext,
      },
    ),
  };
}
