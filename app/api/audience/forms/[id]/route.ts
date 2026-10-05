import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { getSmartPageFormOverview } from "@/modules/smart-pages/forms";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return NextResponse.json(await getSmartPageFormOverview(actor, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
