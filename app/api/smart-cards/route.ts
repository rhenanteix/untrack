import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { pageNumber } from "@/lib/pagination";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { createSmartCard, listSmartCards } from "@/modules/smart-cards/service";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(
      await listSmartCards(
        actor,
        pageNumber(request),
        new URL(request.url).searchParams.get("search") ?? "",
      ),
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
      `smart-cards:${actor.userId}`,
    );
    return NextResponse.json(
      await createSmartCard(actor, await readJson(request)),
      {
        status: 201,
        headers,
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
