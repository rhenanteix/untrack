import {
  libraryFilters,
  dateFilter,
} from "@/modules/workspaces/library-filters";
import { z } from "zod";
import { NextResponse } from "next/server";
import { requireActor } from "@/modules/workspaces/context";
import { createManagedLink } from "@/modules/link-management/service";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { getPrisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/short-links";
import { shortLinkInputSchema } from "@/modules/short-links/schemas";
import { PAGE_SIZE } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const filters = libraryFilters(new URL(request.url));
    const page = filters.page;
    z.enum(["", "active", "inactive", "expired"]).parse(filters.status);
    const now = new Date();
    const items = await getPrisma().shortLink.findMany({
      where: {
        workspaceId: actor.workspaceId,
        distribution: "digital",
        ...(filters.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { slug: { contains: filters.search, mode: "insensitive" } },
                {
                  destinationUrl: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
        ...(filters.status === "active"
          ? {
              isActive: true,
              AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
            }
          : filters.status === "inactive"
            ? { isActive: false }
            : filters.status === "expired"
              ? { expiresAt: { lte: now } }
              : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters.clientId
          ? { campaign: { clientId: filters.clientId } }
          : {}),
        createdAt: dateFilter(filters.from, filters.to),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: {
        _count: { select: { clicks: true } },
        campaign: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });
    return NextResponse.json(
      {
        items: items
          .slice(0, PAGE_SIZE)
          .map((link) => ({
            ...serializeLink(link),
            updatedAt: link.updatedAt.toISOString(),
            campaign: link.campaign,
          })),
        clients: await getPrisma().client.findMany({
          where: { workspaceId: actor.workspaceId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 100,
        }),
        campaigns: await getPrisma().campaign.findMany({
          where: { workspaceId: actor.workspaceId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 100,
        }),
        page,
        hasMore: items.length > PAGE_SIZE,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `short-links:${actor.userId}`,
    );
    const input = shortLinkInputSchema.parse(await readJson(request));
    const link = await createManagedLink(actor, input);
    return NextResponse.json(serializeLink(link), { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
