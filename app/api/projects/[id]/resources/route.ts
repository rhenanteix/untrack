import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import {
  addProjectResource,
  projectResources,
  removeProjectResource,
} from "@/modules/workspace-intelligence/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return NextResponse.json({ items: await projectResources(actor, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

async function mutate(request: Request, context: Context, method: "POST" | "DELETE") {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const { id } = await context.params;
    const raw = await readJson(request);
    return NextResponse.json(
      method === "POST"
        ? await addProjectResource(actor, id, raw)
        : await removeProjectResource(actor, id, raw),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = (request: Request, context: Context) => mutate(request, context, "POST");
export const DELETE = (request: Request, context: Context) => mutate(request, context, "DELETE");