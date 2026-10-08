import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireActor } from "@/modules/workspaces/context";
import { getSmartPageTemplate } from "@/modules/smart-pages/template-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-page-templates:${actor.userId}`);
    const { id } = await context.params;

    const template = await getSmartPageTemplate(actor, id);

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
