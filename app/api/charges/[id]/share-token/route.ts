import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { generateChargeShareToken } from "@/modules/charges/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(
      request,
      `charges:${actor.workspaceId}:${actor.userId}`,
    );
    const { id } = await context.params;
    return NextResponse.json(
      await generateChargeShareToken(actor, id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
