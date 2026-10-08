import { z } from "zod";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { pageNumber } from "@/lib/pagination";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireActor } from "@/modules/workspaces/context";
import { listSmartPageTemplates } from "@/modules/smart-pages/template-service";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-page-templates:${actor.userId}`);

    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const plan = z
      .enum(["free", "premium", "all"])
      .parse(url.searchParams.get("plan") ?? "all");
    const page = pageNumber(request);

    const result = await listSmartPageTemplates(actor, {
      page,
      search,
      category,
      plan,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
