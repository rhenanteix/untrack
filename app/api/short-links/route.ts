import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { getPrisma } from "@/lib/prisma";
import { createShortLink, serializeLink } from "@/lib/short-links";
import { shortLinkInputSchema } from "@/modules/short-links/schemas";
import { pageNumber, PAGE_SIZE } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const page = pageNumber(request);
    const items = await getPrisma().shortLink.findMany({
      where: { userId: user.id },
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
    const user = await requireUser(request);
    const headers = await enforceRateLimit(request, `short-links:${user.id}`);
    const input = shortLinkInputSchema.parse(await readJson(request));
    const link = await createShortLink(user.id, input);
    return NextResponse.json(serializeLink(link), { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
