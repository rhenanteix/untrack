import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { createProject, listProjects } from "@/modules/projects/service";
import { projectListQuerySchema } from "@/modules/projects/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const query = projectListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(await listProjects(actor, query), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `workspace:${actor.workspaceId}:${actor.userId}`,
    );
    const project = await createProject(actor, await readJson(request));
    return NextResponse.json(project, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}