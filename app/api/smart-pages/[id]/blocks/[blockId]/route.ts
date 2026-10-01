import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  deleteSmartPageBlock,
  updateSmartPageBlock,
} from "@/modules/smart-pages/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string; blockId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-pages:${actor.userId}`);
    const { id, blockId } = await context.params;
    return NextResponse.json(
      await updateSmartPageBlock(actor, id, blockId, await readJson(request)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-pages:${actor.userId}`);
    const { id, blockId } = await context.params;
    await deleteSmartPageBlock(actor, id, blockId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
