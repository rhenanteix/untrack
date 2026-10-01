import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import {
  listFavorites,
  listRecent,
  recordRecent,
  resourceTags,
  setResourceTags,
  toggleFavorite,
  workspaceResources,
} from "@/modules/workspace-intelligence/service";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const action = new URL(request.url).searchParams.get("action") ?? "options";
    const body =
      action === "favorites"
        ? { items: await listFavorites(actor) }
        : action === "recent"
          ? { items: await listRecent(actor) }
          : action === "tags"
            ? {
                tags: await resourceTags(actor, {
                  resourceType: new URL(request.url).searchParams.get("resourceType"),
                  resourceId: new URL(request.url).searchParams.get("resourceId"),
                }),
              }
            : { items: await workspaceResources(actor) };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const raw = await readJson(request);
    const action = z.object({ action: z.enum(["favorite", "recent", "set-tags"]) }).passthrough().parse(raw);
    const result =
      action.action === "favorite"
        ? await toggleFavorite(actor, raw)
        : action.action === "recent"
          ? await recordRecent(actor, raw)
          : await setResourceTags(actor, raw, raw);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}