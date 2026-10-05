import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  createAudienceSegment,
  listAudienceSegments,
} from "@/modules/audience/service";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(await listAudienceSegments(actor), {
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
    await enforceRateLimit(request, `audience-segments:${actor.userId}`);
    return NextResponse.json(
      await createAudienceSegment(actor, await readJson(request)),
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}