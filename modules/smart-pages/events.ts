import { getPrisma } from "@/lib/prisma";
import {
  recordAnalyticsEvent,
  type RecordAnalyticsEventInput,
} from "@/modules/analytics/service";

export const publicSmartPageEventNames = [
  "smart_page_view",
  "smart_block_view",
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
  },
  headers: Headers,
) {
  const db = getPrisma();
  const page = await db.smartPage.findFirst({
    where: { slug: input.slug, status: "published" },
    select: { id: true, workspaceId: true },
  });
  if (!page) return false;

  const isBlockEvent = input.event !== "smart_page_view" && input.event !== "social_click";
  const isProductEvent = input.event.startsWith("link_in_bio_product_");
  let block: {
    id: string;
    type: string;
    link: { campaignId: string | null } | null;
  } | null = null;
  if (isBlockEvent) {
    if (!input.blockId) return false;
    block = await db.smartPageBlock.findFirst({
      where: {
        id: input.blockId,
        smartPageId: page.id,
        visible: true,
        analyticsEnabled: true,
        ...(isProductEvent ? { type: "product" } : {}),
      },
      select: { id: true, type: true, link: { select: { campaignId: true } } },
    });
    if (!block) return false;
  }
  const name: RecordAnalyticsEventInput["name"] =
    input.event === "smart_page_view"
      ? "smart_page_view"
      : input.event === "link_in_bio_product_view"
        ? "product_view"
        : input.event === "link_in_bio_product_click"
          ? "product_click"
          : input.event === "smart_block_clicked"
            ? block?.type === "link"
              ? "link_click"
              : "button_click"
            : input.event === "social_click"
              ? "social_click"
              : "block_view";
  const result = await recordAnalyticsEvent({
    name,
    eventId: input.eventId,
    workspaceId: page.workspaceId,
    visitorKey: input.visitorId,
    sessionKey: input.sessionId,
    assetType: "smart_page",
    assetId: page.id,
    elementType: block ? "block" : input.event === "social_click" ? "social" : undefined,
    elementId: block?.id ?? (input.event === "social_click" ? input.blockId : undefined),
    campaignId: block?.link?.campaignId ?? undefined,
    smartPageId: page.id,
    smartPageBlockId: block?.id,
    path: `/${input.slug}`,
    origin: "client",
    headers,
  });
  return result.recorded || result.duplicate;
}
