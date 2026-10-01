import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  CLIENT_ANALYTICS_EVENTS,
  isAnalyticsPath,
} from "@/lib/analytics-events";
import { track } from "@/lib/analytics";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";

const eventSchema = z
  .object({
    event: z.enum(CLIENT_ANALYTICS_EVENTS),
    path: z.string().max(128),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const rateHeaders = await enforceRateLimit(request, "analytics");
    const input = eventSchema.parse(await readJson(request));
    if (!isAnalyticsPath(input.path))
      return NextResponse.json(
        { error: "Caminho não permitido." },
        { status: 400 },
      );
    after(() => track(input.event, { path: input.path }));
    return new NextResponse(null, { status: 204, headers: rateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
