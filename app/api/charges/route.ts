import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { pageNumber } from "@/lib/pagination";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { createCharge, listCharges } from "@/modules/charges/service";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    return NextResponse.json(
      await listCharges(actor, pageNumber(request), status ?? undefined),
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
    const headers = await enforceRateLimit(
      request,
      `charges:${actor.workspaceId}:${actor.userId}`,
    );
    return NextResponse.json(
      await createCharge(actor, await readJson(request)),
      { status: 201, headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
