import { NextResponse } from "next/server";
import { requireActor } from "@/modules/workspaces/context";
import { createManagedLink } from "@/modules/link-management/service";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { getPrisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/short-links";
import { shortLinkInputSchema } from "@/modules/short-links/schemas";
import { pageNumber, PAGE_SIZE } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const page = pageNumber(request);
    const items = await getPrisma().shortLink.findMany({
      where: { workspaceId: actor.workspaceId, distribution: "digital" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      include: { _count: { select: { clicks: true } } },
    });
    return NextResponse.json(
      {
        items: items.slice(0, PAGE_SIZE).map(serializeLink),
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
    const headers = await enforceRateLimit(request, `short-links:${actor.userId}`);
    const input = shortLinkInputSchema.parse(await readJson(request));
    const link = await createManagedLink(actor, input);
    return NextResponse.json(serializeLink(link), { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
