import { after, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { universalEventNames } from "@/modules/analytics/event-types";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { reportAnalyticsHealth } from "@/modules/analytics/health";

const inputSchema = z
  .object({
    event: z.enum(universalEventNames),
    eventId: z.string().uuid(),
    visitorId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    path: z.string().startsWith("/").max(2048),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const headers = await enforceRateLimit(request, "events");
    const input = inputSchema.parse(await readJson(request));
    after(() =>
      recordAnalyticsEvent({
        name: input.event,
        eventId: input.eventId,
        visitorKey: input.visitorId,
        sessionKey: input.sessionId,
        path: input.path,
        attribution: input,
        origin: "client",
        headers: request.headers,
      }).catch((error) => console.error("Analytics event was not recorded", error)),
    );
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    reportAnalyticsHealth("events_rejected");
    return errorResponse(error);
  }
}