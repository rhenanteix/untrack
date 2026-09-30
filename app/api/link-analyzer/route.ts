import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { analyzeLink } from "@/modules/link-analyzer/analyze";
import { analyzeLinkSchema } from "@/modules/link-analyzer/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const headers = await enforceRateLimit(request, "link-analyzer");
    const { url } = analyzeLinkSchema.parse(await readJson(request));
    const analysis = await analyzeLink(url);
    return NextResponse.json(
      { analysis },
      { headers: { ...headers, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
