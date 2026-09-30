import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { analyzeLinkSchema } from "@/modules/link-analyzer/schemas";
import { checkLinkHealth } from "@/modules/link-health/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const headers = await enforceRateLimit(request, "link-health");
    const { url } = analyzeLinkSchema.parse(await readJson(request));
    const health = await checkLinkHealth(url);
    return NextResponse.json(
      { health },
      { headers: { ...headers, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
