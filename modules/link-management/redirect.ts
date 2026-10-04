import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { ShortLink } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { clickMetadata } from "@/modules/short-links/click-metadata";
import { publicLink } from "@/lib/short-links";
import { track } from "@/lib/analytics";
import {
  extractUtmAttribution,
  resolveAttribution,
  type AttributionInput,
} from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
  type PublicAnalyticsRequestContext,
} from "@/modules/analytics/public-context";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { cachedDestination } from "./cache";

type QrRedirectContext = {
  id: string;
  campaignId: string | null;
  context: string | null;
};

async function recordRedirectAnalytics(
  request: Request,
  link: ShortLink,
  distribution: "digital" | "qr" | "whatsapp",
  tracking: PublicAnalyticsRequestContext,
  attribution: AttributionInput,
  qr: QrRedirectContext | null,
) {
  if (!tracking.trackingAllowed) return;
  await recordAnalyticsEvent({
    name:
      distribution === "qr"
        ? "qr_scan"
        : distribution === "whatsapp"
          ? "whatsapp_click"
          : "link_click",
    workspaceId: link.workspaceId,
    visitorKey: tracking.identity.visitorId,
    sessionKey: tracking.identity.sessionId,
    assetType: qr ? "qr_code" : "link",
    assetId: qr?.id ?? link.id,
    campaignId: qr?.campaignId ?? link.campaignId ?? undefined,
    path: new URL(request.url).pathname,
    destinationUrl: link.destinationUrl,
    attribution,
    metadata: qr?.context ? { qrContext: qr.context } : undefined,
    origin: "server",
    headers: request.headers,
  });
}

export async function drainClickOutbox() {
  return getPrisma().$transaction(async (tx) => {
    const events = await tx.$queryRaw<Array<{ id: string; linkId: string; createdAt: Date; day: Date; referrer: string; device: string }>>`SELECT * FROM "ClickOutbox" ORDER BY "createdAt" LIMIT 500 FOR UPDATE SKIP LOCKED`;
    for (const event of events) {
      if (await tx.shortLink.findUnique({ where: { id: event.linkId }, select: { id: true } })) await tx.linkClick.upsert({ where: { id: event.id }, update: {}, create: event });
    }
    await tx.clickOutbox.deleteMany({ where: { id: { in: events.map((event) => event.id) } } });
    return events.length;
  }, { timeout: 15000 });
}
export async function redirectResponse(request: Request, slug: string, distribution: "digital" | "qr" | "whatsapp", countClick: boolean, unavailableMessage = "Link não encontrado, expirado ou desativado.") {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(slug)) return new Response("Link não encontrado.", { status: 404 });
  const hostname = new URL(request.url).hostname.toLowerCase();
  const domainKey = hostname === appUrl().hostname ? "platform" : hostname;
  const metadata = countClick ? clickMetadata(request.headers) : null;
  let link: ShortLink | null;
  if (metadata) {
    try {
      // Durable enqueue happens in the SAME DB round-trip that resolves the destination.
      // Aggregation runs after the response or by cron, never on the redirect path.
      const rows = await getPrisma().$queryRaw<ShortLink[]>`
        WITH destination AS MATERIALIZED (
          SELECT * FROM "ShortLink" WHERE "domainKey" = ${domainKey} AND "slug" = ${slug}
          AND "distribution" = ${distribution} AND "isActive" = true
          AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP)
          AND (${domainKey} = 'platform' OR EXISTS (SELECT 1 FROM "CustomDomain" WHERE "hostname" = ${hostname} AND "status" = 'active'))
        ), queued AS (
          INSERT INTO "ClickOutbox" ("id", "linkId", "day", "referrer", "device")
          SELECT ${randomUUID()}, "id", ${metadata.day}, ${metadata.referrer}, ${metadata.device} FROM destination RETURNING "id"
        ) SELECT * FROM destination`;
      link = rows[0] ?? null;
      after(async () => { try { await drainClickOutbox(); } catch { console.error("Click outbox pending; cron will retry."); } });
    } catch {
      // Analytics storage failure must not prevent navigation.
      link = await publicLink(slug, hostname, distribution);
    }
  } else link = await publicLink(slug, hostname, distribution);
  if (!link) return new Response(unavailableMessage, { status: 404, headers: { "Cache-Control": "no-store" } });
  const qr =
    countClick && distribution === "qr"
      ? await getPrisma().qrAsset.findFirst({
          where: { redirectId: link.id, workspaceId: link.workspaceId },
          select: { id: true, campaignId: true, context: true },
        }).catch(() => null)
      : null;
    const tracking = countClick
      ? resolvePublicAnalyticsContext(
          request.headers,
          {},
          {
            ...extractUtmAttribution(request.url),
            ...(distribution === "qr"
              ? {
                  knownContext: {
                    source: "qr",
                    medium: "qr",
                    channel: "qr",
                  },
                }
              : {}),
          },
        )
      : undefined;
    const attribution = tracking
      ? { ...tracking.attribution, referrer: request.headers.get("referer") }
      : undefined;
    const resolvedAttribution = attribution
      ? resolveAttribution(attribution)
      : undefined;
    if (tracking && attribution)
    after(() =>
      recordRedirectAnalytics(request, link, distribution, tracking, attribution, qr).catch((error) =>
        console.error("Redirect analytics event was not recorded", error),
      ),
    );
  if (distribution === "whatsapp" && countClick)
    after(async () => {
      await Promise.all([
        track("whatsapp_link_view", { linkId: link.id }),
        track("whatsapp_link_click", { linkId: link.id }),
        track("whatsapp_redirect", { linkId: link.id }),
      ]);
    });
  // Explicit query policy: all incoming query parameters are ignored, including UTMs.
  const destination = await cachedDestination(link);
  const headers = new Headers({ Location: destination, "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  if (tracking && resolvedAttribution)
    for (const cookie of publicAnalyticsContextCookies(
      request.headers,
      tracking,
      resolvedAttribution,
      {
        campaignId: qr?.campaignId ?? link.campaignId ?? undefined,
        qrContext: qr?.context ?? undefined,
      },
    ))
      headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}
