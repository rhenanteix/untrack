import { type ShortLink } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { appUrl, publicLinkUrl } from "@/lib/app-url";

export function serializeLink(
  link: ShortLink & { _count?: { clicks: number } },
) {
  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    tags: link.tags,
    folderId: link.folderId,
    destinationUrl: link.destinationUrl,
    isActive: link.isActive,
    createdAt: link.createdAt.toISOString(),
    shortUrl: link.domainKey === "platform" ? publicLinkUrl(link.slug) : `https://${link.domainKey}/s/${link.slug}`,
    shareUrl: publicLinkUrl(link.slug, true),
    clicks: link._count?.clicks ?? 0,
  };
}

export async function publicLink(slug: string, hostname = appUrl().hostname, distribution = "digital") {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(slug)) return null;
  let domainKey = "platform";
  if (hostname !== appUrl().hostname) {
    const domain = await getPrisma().customDomain.findUnique({ where: { hostname } });
    if (!domain || domain.status !== "active") return null;
    domainKey = hostname;
  }
  return getPrisma().shortLink.findFirst({ where: { domainKey, slug, distribution, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
}

export async function linkMetrics(linkId: string) {
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const since = new Date(today.getTime() - 29 * 86_400_000);
  const where = { linkId, day: { gte: since } };
  const db = getPrisma();
  const [total, days, referrers, devices] = await Promise.all([
    db.linkClick.count({ where: { linkId } }),
    db.linkClick.groupBy({
      by: ["day"],
      where,
      _count: { _all: true },
      orderBy: { day: "asc" },
    }),
    db.linkClick.groupBy({
      by: ["referrer"],
      where,
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
    db.linkClick.groupBy({
      by: ["device"],
      where,
      _count: { _all: true },
      orderBy: { _count: { device: "desc" } },
    }),
  ]);
  const counts = new Map(
    days.map((day) => [day.day.toISOString().slice(0, 10), day._count._all]),
  );
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(since.getTime() + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, clicks: counts.get(date) ?? 0 };
  });
  return {
    total,
    last30Days: daily.reduce((sum, d) => sum + d.clicks, 0),
    daily,
    referrers: referrers.map((r) => ({
      name: r.referrer,
      clicks: r._count._all,
    })),
    devices: devices.map((d) => ({ name: d.device, clicks: d._count._all })),
  };
}
