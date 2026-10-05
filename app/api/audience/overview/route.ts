import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import {
  getAudienceOverview,
  parseAudienceContactFilters,
} from "@/modules/audience/service";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(
      await getAudienceOverview(
        actor,
        parseAudienceContactFilters(
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}