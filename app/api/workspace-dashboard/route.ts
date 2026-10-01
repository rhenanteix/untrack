import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { requireActor } from "@/modules/workspaces/context";
import { workspaceDashboard } from "@/modules/workspace-intelligence/dashboard";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(await workspaceDashboard(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}