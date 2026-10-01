import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import {
  addCollectionResource,
  removeCollectionResource,
  reorderCollectionResources,
} from "@/modules/workspace-intelligence/service";

type Context = { params: Promise<{ id: string }> };

async function mutate(request: Request, context: Context, method: "POST" | "PATCH" | "DELETE") {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const { id } = await context.params;
    const raw = await readJson(request);
    const result =
      method === "POST"
        ? await addCollectionResource(actor, id, raw)
        : method === "PATCH"
          ? await reorderCollectionResources(actor, id, raw)
          : await removeCollectionResource(actor, id, z.object({ itemId: z.string() }).strict().parse(raw).itemId);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = (request: Request, context: Context) => mutate(request, context, "POST");
export const PATCH = (request: Request, context: Context) => mutate(request, context, "PATCH");
export const DELETE = (request: Request, context: Context) => mutate(request, context, "DELETE");