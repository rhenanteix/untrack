import { withAnonymousUse } from "@/lib/anonymous-use";
import { after, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import { utmInputSchema } from "@/modules/utm/utm.schemas";
import { generateUtmUrl } from "@/modules/utm/utm.service";
import { saveCloudHistory } from "@/lib/cloud-history";

async function handlePost(request: Request) {
  try {
    const rateHeaders = await enforceRateLimit(request, "utm");
    const input = utmInputSchema.parse(await readJson(request));
    const url = generateUtmUrl(input);
    const historySaved = await saveCloudHistory(request, input.url, url, "utm");
    after(() =>
      track("utm_generated", {
        hasTerm: Boolean(input.term),
        hasContent: Boolean(input.content),
      }),
    );
    return NextResponse.json({ url, historySaved }, { headers: rateHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) { return withAnonymousUse(request, () => handlePost(request)); }
