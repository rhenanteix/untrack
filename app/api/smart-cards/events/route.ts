import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { recordPublicSmartCardEvent } from "@/modules/smart-cards/events";
import { smartCardEventSchema } from "@/modules/smart-cards/schemas";
import { reportAnalyticsHealth } from "@/modules/analytics/health";

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const rateHeaders = await enforceRateLimit(request, "smart-card-events");
    const result = await recordPublicSmartCardEvent(
      smartCardEventSchema.parse(await readJson(request)),
      request.headers,
    );
    const response = new NextResponse(null, { status: 204, headers: rateHeaders });
    for (const cookie of result.cookieHeaders)
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    reportAnalyticsHealth("events_rejected");
    return errorResponse(error);
  }
}
