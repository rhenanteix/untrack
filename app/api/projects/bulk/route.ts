import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { changeProjectsStatusBulk } from "@/modules/projects/service";
import { requireActor } from "@/modules/workspaces/context";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `workspace:${actor.workspaceId}:${actor.userId}`,
    );
    return NextResponse.json(
      await changeProjectsStatusBulk(actor, await readJson(request)),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}