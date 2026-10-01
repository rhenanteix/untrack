import { NextResponse } from "next/server";
import { ApiError, errorResponse } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { appUrl } from "@/lib/app-url";
import {
  requireActor,
  workspaceTransaction,
  audit,
} from "@/modules/workspaces/context";
import { enforceSameOrigin } from "@/lib/request-origin";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const image = await getPrisma().smartPageImage.findUnique({
      where: { id },
      include: {
        page: { select: { status: true, workspaceId: true, avatarUrl: true } },
      },
    });
    if (!image) throw new ApiError(404, "NOT_FOUND", "Imagem não encontrada.");
    const isPublic =
      image.page.status === "published" &&
      image.page.avatarUrl ===
        new URL(`/api/smart-page-images/${id}`, appUrl()).href;
    if (!isPublic) {
      const session = await sessionFromHeaders(request.headers);
      const member =
        session &&
        (await getPrisma().workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: image.page.workspaceId,
              userId: session.user.id,
            },
          },
        }));
      if (!member)
        throw new ApiError(404, "NOT_FOUND", "Imagem não encontrada.");
    }
    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const { id } = await params;
    await workspaceTransaction(actor, "write", async (tx) => {
      const image = await tx.smartPageImage.findFirst({
        where: { id, page: { workspaceId: actor.workspaceId } },
        include: { page: true },
      });
      if (!image)
        throw new ApiError(404, "NOT_FOUND", "Imagem não encontrada.");
      if (
        image.page.avatarUrl ===
        new URL(`/api/smart-page-images/${id}`, appUrl()).href
      )
        throw new ApiError(
          409,
          "IMAGE_IN_USE",
          "Troque ou remova a foto no perfil e salve antes de excluir esta imagem.",
        );
      await tx.smartPageImage.delete({ where: { id } });
      await audit(tx, actor, "smartPage.imageDeleted", image.pageId, {
        imageId: id,
      });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
