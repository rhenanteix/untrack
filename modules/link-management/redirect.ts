import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { ShortLink } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { clickMetadata } from "@/modules/short-links/click-metadata";
import { publicLink } from "@/lib/short-links";
import { cachedDestination } from "./cache";

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
export async function redirectResponse(request: Request, slug: string, distribution: "digital" | "qr", countClick: boolean) {
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
  if (!link) return new Response("Link não encontrado, expirado ou desativado.", { status: 404, headers: { "Cache-Control": "no-store" } });
  // Explicit query policy: all incoming query parameters are ignored, including UTMs.
  const destination = await cachedDestination(link);
  return new Response(null, { status: 302, headers: { Location: destination, "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
}
