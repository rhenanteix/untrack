import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { requireActor } from "@/modules/workspaces/context";
import { searchQuerySchema } from "@/modules/workspace-intelligence/schemas";
import { searchWorkspace } from "@/modules/workspace-intelligence/service";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const query = searchQuerySchema.parse({ query: new URL(request.url).searchParams.get("query") ?? "" });
    return NextResponse.json(
      { items: await searchWorkspace(actor, query.query) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}