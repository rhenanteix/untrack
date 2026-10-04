import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireUser } from "@/lib/session";
import { startTrial } from "@/modules/billing/trial-service";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `trial:${user.id}`);
    const access = await startTrial(user.id);
    return NextResponse.json(
      { access },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}