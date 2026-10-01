import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import {
  archiveProject,
  getProject,
  restoreProject,
  updateProject,
} from "@/modules/projects/service";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return NextResponse.json(await getProject(actor, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `workspace:${actor.workspaceId}:${actor.userId}`,
    );
    const { id } = await context.params;
    const raw = await readJson(request);
    const action = z
      .object({ action: z.enum(["archive", "restore"]) })
      .strict()
      .safeParse(raw);
    const project = action.success
      ? action.data.action === "archive"
        ? await archiveProject(actor, id)
        : await restoreProject(actor, id)
      : await updateProject(actor, id, raw);
    return NextResponse.json(project, {
      headers: { ...headers, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}