import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSmartPageTemplateForPreview } from "@/modules/smart-pages/template-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await enforceRateLimit(request, "smart-page-template-preview");
    const { id } = await context.params;

    const template = await getSmartPageTemplateForPreview(id);

    if (!template) {
      return NextResponse.json(
        { error: "Template não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json(template, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
