import { NextResponse } from "next/server";
import { requireActor, workspaceTransaction, releaseQuota, audit } from "@/modules/workspaces/context";
import { ApiError, errorResponse } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const { id } = await context.params;
    await workspaceTransaction(actor, "write", async (tx) => {
      const result = await tx.linkHistory.deleteMany({ where: { id, workspaceId: actor.workspaceId } });
      if (!result.count) throw new ApiError(404, "HISTORY_NOT_FOUND", "Registro não encontrado.");
      await releaseQuota(tx, actor.workspaceId, "history");
      await audit(tx, actor, "history.deleted", id);
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
