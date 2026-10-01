import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { createTag, listTags } from "@/modules/workspace-intelligence/service";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const tags = await listTags(
      actor,
      url.searchParams.get("search") ?? "",
      url.searchParams.get("archived") === "true",
    );
    return NextResponse.json({ tags }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const tag = await createTag(actor, await readJson(request));
    return NextResponse.json(tag, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}