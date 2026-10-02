import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { pageNumber } from "@/lib/pagination";
import { listAudienceContacts } from "@/modules/audience/service";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(
      await listAudienceContacts(
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
