import { createHash } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { clickMetadata } from "@/modules/short-links/click-metadata";
import type { z } from "zod";
import { smartCardEventSchema } from "./schemas";

export const publicSmartCardEventNames = [
  "card_view",
  "card_share",
  "qr_scan",
  "nfc_open",
  "contact_save",
  "contact_form_open",
  "link_click",
  "whatsapp_click",
  "booking_click",
] as const;

function visitorHash(visitorId: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET não está configurado.");
  return createHash("sha256").update(`${secret}:${visitorId}`).digest("hex");
}

export async function recordPublicSmartCardEvent(
  input: z.infer<typeof smartCardEventSchema>,
  headers: Headers,
) {
  const visit = clickMetadata(headers);
  if (!visit) return false;

  const db = getPrisma();
  const card = await db.smartCard.findFirst({
    where: { slug: input.slug, status: "published" },
    select: { id: true, workspaceId: true },
  });
  if (!card) return false;

  let actionId: string | null = null;
  if (input.actionId) {
    const action = await db.smartCardAction.findFirst({
      where: {
        id: input.actionId,
        smartCardId: card.id,
        visible: true,
        analyticsEnabled: true,
      },
      select: { id: true },
    });
    if (!action) return false;
    actionId = action.id;
  }

  await db.analyticsEvent.create({
    data: {
      name: input.event,
      metadata: { path: `/c/${input.slug}`, source: input.source },
      workspaceId: card.workspaceId,
      smartCardId: card.id,
      smartCardActionId: actionId,
      day: visit.day,
      visitorHash: visitorHash(input.visitorId),
      referrer: visit.referrer,
      device: visit.device,
    },
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
                : input.event;
      await db.audienceContactEvent.create({
        data: {
          workspaceId: card.workspaceId,
          contactId: exchange.contactId,
          name: timelineName,
          metadata: {
            smartCardId: card.id,
            actionId,
            source: input.source,
          },
        },
      });
    }
  }
  return true;
}
