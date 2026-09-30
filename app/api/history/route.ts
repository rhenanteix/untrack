import { NextResponse } from "next/server";
import { requireActor, workspaceTransaction, reserveQuota, audit } from "@/modules/workspaces/context";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/prisma";
import { historyImportSchema } from "@/modules/short-links/schemas";
import { pageNumber, PAGE_SIZE } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const page = pageNumber(request);
    const items = await getPrisma().linkHistory.findMany({
      where: { workspaceId: actor.workspaceId },
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
    const actor = await requireActor(request);
    await enforceRateLimit(request, `history:${actor.userId}`);
    const input = historyImportSchema.parse(await readJson(request));
    const result = await workspaceTransaction(actor, "write", async (tx, plan) => {
      const existing = await tx.linkHistory.findMany({ where: { workspaceId: actor.workspaceId, userId: actor.userId, importKey: { in: input.items.map((item) => item.id) } }, select: { importKey: true } });
      const keys = new Set(existing.map((item) => item.importKey));
      const fresh = input.items.filter((item) => { if (keys.has(item.id)) return false; keys.add(item.id); return true; });
      await reserveQuota(tx, actor.workspaceId, plan, "history", fresh.length);
      const result = await tx.linkHistory.createMany({ data: fresh.map((item) => ({ workspaceId: actor.workspaceId, userId: actor.userId, importKey: item.id, originalUrl: item.originalUrl, resultUrl: item.cleanUrl, kind: "clean", createdAt: new Date(item.createdAt) })) });
      await audit(tx, actor, "history.imported", actor.workspaceId, { count: result.count });
      return result;
    });
    return NextResponse.json({ imported: result.count });
  } catch (error) {
    return errorResponse(error);
  }
}
