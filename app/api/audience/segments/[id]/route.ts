import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { deleteAudienceSegment } from "@/modules/audience/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `audience-segments:${actor.userId}`);
    const { id } = await context.params;
    await deleteAudienceSegment(actor, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}