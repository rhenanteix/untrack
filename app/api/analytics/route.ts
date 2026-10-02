import { after, NextResponse } from "next/server";
import { z } from "zod";
import {
  CLIENT_ANALYTICS_EVENTS,
  isAnalyticsPath,
} from "@/lib/analytics-events";
import { track } from "@/lib/analytics";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sessionFromHeaders } from "@/lib/session";

const contextSchema = z
  .object({
    product: z.string().max(80).optional(),
    category: z.string().max(80).optional(),
    source: z.string().max(80).optional(),
    location: z.string().max(80).optional(),
  })
  .strict();

const eventSchema = z
  .object({
    event: z.enum(CLIENT_ANALYTICS_EVENTS),
    path: z.string().max(128),
    context: contextSchema.optional(),
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
    const session = await sessionFromHeaders(request.headers);
    after(() =>
      track(input.event, {
        path: input.path,
        authenticated: Boolean(session),
        ...input.context,
      }),
    );
    return new NextResponse(null, { status: 204, headers: rateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
