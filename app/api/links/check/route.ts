import { after, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkUrl } from "@/lib/safe-url-check";
import { urlInputSchema } from "@/modules/links/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = performance.now();
  try {
    const rateHeaders = await enforceRateLimit(request, "links-check");
    const input = urlInputSchema.parse(await readJson(request));
    const result = await checkUrl(input.url);
    const responseTime = Math.round(performance.now() - startedAt);
    after(() =>
      track("url_check_completed", {
        reachable: result.reachable,
        status: result.status,
      }),
    );
    return NextResponse.json(
      {
        reachable: result.reachable,
        statusCode: result.status,
        responseTime,
        finalUrl: result.finalUrl,
        contentType: result.contentType,
        redirects: result.redirects,
        method: result.method,
      },
      { headers: rateHeaders },
    );
  } catch (error) {
    return errorResponse(error, {
      reachable: false,
      statusCode: null,
      responseTime: Math.round(performance.now() - startedAt),
    });
  }
}
