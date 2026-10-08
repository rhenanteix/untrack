import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSmartPageTemplateCategories } from "@/modules/smart-pages/template-service";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "smart-page-template-categories");

    const categories = await getSmartPageTemplateCategories();

    return NextResponse.json(
      { categories },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
