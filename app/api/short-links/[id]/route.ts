import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPrisma } from "@/lib/prisma";
import { ownedLink, serializeLink, linkMetrics } from "@/lib/short-links";
import { updateShortLinkSchema } from "@/modules/short-links/schemas";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const link = await ownedLink(id, user.id);
    const metrics = await linkMetrics(id);
    return NextResponse.json(
      { link: serializeLink(link), metrics },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `short-links:${user.id}`);
    const { id } = await context.params;
    const input = updateShortLinkSchema.parse(await readJson(request));
    await ownedLink(id, user.id);
    const link = await getPrisma().shortLink.update({
      where: { id, userId: user.id },
      data: input,
      include: { _count: { select: { clicks: true } } },
    });
    return NextResponse.json(serializeLink(link));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `short-links:${user.id}`);
    const { id } = await context.params;
    await ownedLink(id, user.id);
    await getPrisma().shortLink.delete({ where: { id, userId: user.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
