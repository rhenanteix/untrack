import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  requireActor,
  workspaceTransaction,
  audit,
} from "@/modules/workspaces/context";
import { requirePremium } from "@/modules/billing/plans";
import { optimizeImage, readImageBody } from "@/modules/smart-pages/images";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-page-upload:${actor.userId}`);
    const { id } = await params;
    const bytes = await optimizeImage(await readImageBody(request));
    const image = await workspaceTransaction(
      actor,
      "write",
      async (tx, plan) => {
        requirePremium(plan);
        const page = await tx.smartPage.findFirst({
          where: { id, workspaceId: actor.workspaceId },
        });
        if (!page)
          throw new ApiError(404, "NOT_FOUND", "Página não encontrada.");
        const count = await tx.smartPageImage.count({ where: { pageId: id } });
        if (count >= 10)
          throw new ApiError(
            409,
            "IMAGE_LIMIT",
            "Esta página atingiu 10 imagens. Remova imagens não utilizadas antes de enviar outra.",
          );
        const created = await tx.smartPageImage.create({
          data: { pageId: id, data: bytes },
          select: { id: true },
        });
        await audit(tx, actor, "smartPage.imageUploaded", id, {
          imageId: created.id,
        });
        return created;
      },
    );
    return NextResponse.json(
      {
        id: image.id,
        url: new URL(`/api/smart-page-images/${image.id}`, appUrl()).href,
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { id } = await params;
    const { getPrisma } = await import("@/lib/prisma");
    const page = await getPrisma().smartPage.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (!page) throw new ApiError(404, "NOT_FOUND", "Página não encontrada.");
    const items = await getPrisma().smartPageImage.findMany({
      where: { pageId: id },
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json(
      {
        items: items.map((image) => ({
          ...image,
          url: new URL(`/api/smart-page-images/${image.id}`, appUrl()).href,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
