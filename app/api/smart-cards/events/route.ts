import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { recordPublicSmartCardEvent } from "@/modules/smart-cards/events";
import { smartCardEventSchema } from "@/modules/smart-cards/schemas";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const headers = await enforceRateLimit(request, "smart-card-events");
    await recordPublicSmartCardEvent(
      smartCardEventSchema.parse(await readJson(request)),
      request.headers,
    );
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
