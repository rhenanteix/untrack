import { randomBytes } from "node:crypto";
import { Prisma, type ShortLink } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { appUrl, publicLinkUrl } from "@/lib/app-url";
import { slugSchema } from "@/modules/short-links/schemas";

export function serializeLink(
  link: ShortLink & { _count?: { clicks: number } },
) {
  return {
    id: link.id,
    slug: link.slug,
    title: link.title,
    description: link.description,
    destinationUrl: link.destinationUrl,
    isActive: link.isActive,
    createdAt: link.createdAt.toISOString(),
    shortUrl: publicLinkUrl(link.slug),
    shareUrl: publicLinkUrl(link.slug, true),
    clicks: link._count?.clicks ?? 0,
  };
}

export async function createShortLink(
  userId: string,
  input: { url: string; title: string; description: string },
) {
  const destination = new URL(input.url);
  if (
    destination.origin === appUrl().origin &&
    /^\/(s|l)\//.test(destination.pathname)
  ) {
    throw new ApiError(
      400,
      "NESTED_SHORT_LINK",
      "Use o endereço de destino original, não outro link curto desta aplicação.",
    );
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await getPrisma().shortLink.create({
        data: {
          userId,
          slug: randomBytes(8).toString("base64url").slice(0, 10),
          destinationUrl: destination.href,
          title: input.title,
          description: input.description,
        },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ))
        throw error;
    }
  }
  throw new ApiError(
    503,
    "SLUG_UNAVAILABLE",
    "Não foi possível gerar o link agora. Tente novamente.",
  );
}

export async function ownedLink(id: string, userId: string) {
  const link = await getPrisma().shortLink.findFirst({
    where: { id, userId },
    include: { _count: { select: { clicks: true } } },
  });
  if (!link) throw new ApiError(404, "LINK_NOT_FOUND", "Link não encontrado.");
  return link;
}

export async function publicLink(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  return getPrisma().shortLink.findFirst({ where: { slug, isActive: true } });
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
