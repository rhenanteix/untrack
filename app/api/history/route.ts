import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/prisma";
import { historyImportSchema } from "@/modules/short-links/schemas";
import { pageNumber, PAGE_SIZE } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const page = pageNumber(request);
    const items = await getPrisma().linkHistory.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        originalUrl: true,
        resultUrl: true,
        kind: true,
        createdAt: true,
      },
    });
    return NextResponse.json(
      {
        items: items.slice(0, PAGE_SIZE),
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
    await enforceRateLimit(request, `history:${user.id}`);
    const input = historyImportSchema.parse(await readJson(request));
    const result = await getPrisma().linkHistory.createMany({
      data: input.items.map((item) => ({
        userId: user.id,
        importKey: item.id,
        originalUrl: item.originalUrl,
        resultUrl: item.cleanUrl,
        kind: "clean",
        createdAt: new Date(item.createdAt),
      })),
      skipDuplicates: true,
    });
    return NextResponse.json({ imported: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
