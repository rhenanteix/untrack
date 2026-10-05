import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { listSmartPageFormOverviews } from "@/modules/smart-pages/forms";
import { requireActor } from "@/modules/workspaces/context";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(await listSmartPageFormOverviews(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
