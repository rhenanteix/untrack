import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  addAudienceContactTag,
  removeAudienceContactTag,
} from "@/modules/audience/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `audience-tags:${actor.userId}`);
    const { id } = await context.params;
    return NextResponse.json(
      await addAudienceContactTag(actor, id, await readJson(request)),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `audience-tags:${actor.userId}`);
    const { id } = await context.params;
    await removeAudienceContactTag(
      actor,
      id,
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}