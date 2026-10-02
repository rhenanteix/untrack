import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { captureSmartCardContact } from "@/modules/smart-cards/service";
import { smartCardSlugSchema } from "@/modules/smart-cards/schemas";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const { slug } = await context.params;
    const headers = await enforceRateLimit(
      request,
      `smart-card-contact:${slug}`,
    );
    return NextResponse.json(
      await captureSmartCardContact(
        smartCardSlugSchema.parse(slug),
        await readJson(request),
        request.headers,
      ),
      { status: 201, headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
