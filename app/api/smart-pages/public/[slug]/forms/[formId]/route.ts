import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { submitPublicSmartPageForm } from "@/modules/smart-pages/forms";
import { smartPageSlugSchema } from "@/modules/smart-pages/schemas";

type Context = { params: Promise<{ slug: string; formId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const { slug, formId } = await context.params;
    const rateHeaders = await enforceRateLimit(
      request,
      `smart-page-form:${slug}:${formId}`,
    );
    const result = await submitPublicSmartPageForm(
      smartPageSlugSchema.parse(slug),
      formId,
      await readJson(request, 24_000),
      request.headers,
    );
    const { analyticsCookieHeaders, ...payload } = result;
    const response = NextResponse.json(payload, {
      status: 201,
      headers: rateHeaders,
    });
    for (const cookie of analyticsCookieHeaders)
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
