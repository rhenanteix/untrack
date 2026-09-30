import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  ANALYTICS_PATHS,
  CLIENT_ANALYTICS_EVENTS,
} from "@/lib/analytics-events";
import { track } from "@/lib/analytics";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

const eventSchema = z
  .object({
    event: z.enum(CLIENT_ANALYTICS_EVENTS),
    path: z.enum(ANALYTICS_PATHS),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const rateHeaders = await enforceRateLimit(request, "analytics");
    const input = eventSchema.parse(await readJson(request));
    after(() => track(input.event, { path: input.path }));
    return new NextResponse(null, { status: 204, headers: rateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
