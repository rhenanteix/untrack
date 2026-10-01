import { withAnonymousUse } from "@/lib/anonymous-use";
import { after, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import { analyzeUrl } from "@/modules/links/clean-url";
import { analyzeInputSchema } from "@/modules/links/schemas";
import { saveCloudHistory } from "@/lib/cloud-history";

async function handlePost(request: Request) {
  try {
    const rateHeaders = await enforceRateLimit(request, "links-analyze");
    const input = analyzeInputSchema.parse(await readJson(request));
    const result = analyzeUrl(input.url, input.categories);
    const historySaved = await saveCloudHistory(
      request,
      input.url,
      result.cleanUrl,
      "clean",
    );

    after(() =>
      track("link_analyzed", {
        trackers: result.statistics.trackingParameters,
      }),
    );
    return NextResponse.json(
      { ...result, historySaved },
      { headers: rateHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) { return withAnonymousUse(request, () => handlePost(request)); }
