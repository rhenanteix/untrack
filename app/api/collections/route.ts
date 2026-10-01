import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { createCollection, listCollections } from "@/modules/workspace-intelligence/service";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    return NextResponse.json(
      { items: await listCollections(actor, projectId) },
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
    const headers = await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    return NextResponse.json(await createCollection(actor, await readJson(request)), { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}