import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { clickMetadata } from "@/modules/short-links/click-metadata";

export const publicSmartPageEventNames = [
  "smart_page_view",
  "smart_block_view",
  "smart_block_clicked",
  "link_in_bio_product_view",
  "link_in_bio_product_click",
] as const;

export type PublicSmartPageEventName =
  (typeof publicSmartPageEventNames)[number];

function visitorHash(visitorId: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET não está configurado.");
  return createHash("sha256").update(`${secret}:${visitorId}`).digest("hex");
}

export async function recordPublicSmartPageEvent(
  input: {
    event: PublicSmartPageEventName;
    slug: string;
    visitorId: string;
    blockId?: string;
  },
  headers: Headers,
) {
  const visit = clickMetadata(headers);
  if (!visit) return false;

  const db = getPrisma();
  const page = await db.smartPage.findFirst({
    where: { slug: input.slug, status: "published" },
    select: { id: true, workspaceId: true },
  });
  if (!page) return false;

  const isBlockEvent = input.event !== "smart_page_view";
  const isProductEvent = input.event.startsWith("link_in_bio_product_");
  let blockId: string | null = null;
  if (isBlockEvent) {
    if (!input.blockId) return false;
    const block = await db.smartPageBlock.findFirst({
      where: {
        id: input.blockId,
        smartPageId: page.id,
        visible: true,
        analyticsEnabled: true,
        ...(isProductEvent ? { type: "product" } : {}),
      },
      select: { id: true },
    });
    if (!block) return false;
    blockId = block.id;
  }

  const eventData = {
    metadata: { path: `/${input.slug}` },
    workspaceId: page.workspaceId,
    smartPageId: page.id,
    smartPageBlockId: blockId,
    day: visit.day,
    visitorHash: visitorHash(input.visitorId),
    referrer: visit.referrer,
    device: visit.device,
  };
  const firstEvent =
    input.event === "smart_page_view"
      ? "first_page_view"
      : input.event === "smart_block_clicked" ||
          input.event === "link_in_bio_product_click"
        ? "first_click"
        : null;
  await db.$transaction(async (tx) => {
    if (firstEvent)
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${page.workspaceId} FOR UPDATE`;
    await tx.analyticsEvent.create({ data: { name: input.event, ...eventData } });
    if (!firstEvent) return;
    const priorEvents = await tx.analyticsEvent.count({
      where: { workspaceId: page.workspaceId, name: firstEvent },
    });
    if (!priorEvents)
      await tx.analyticsEvent.create({ data: { name: firstEvent, ...eventData } });
  });
  return true;
}
