import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ApiError, errorResponse } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { getPrisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    const { id } = await context.params;
    const result = await getPrisma().linkHistory.deleteMany({
      where: { id, userId: user.id },
    });
    if (!result.count)
      throw new ApiError(404, "HISTORY_NOT_FOUND", "Registro não encontrado.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
