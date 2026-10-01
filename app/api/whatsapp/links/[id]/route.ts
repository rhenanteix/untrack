import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { requireWhatsAppIntelligence } from "@/modules/whatsapp/feature";
import { archiveWhatsappLink, getWhatsappLink, updateWhatsappLink } from "@/modules/whatsapp/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    return NextResponse.json(
      await getWhatsappLink(actor, (await context.params).id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `whatsapp:${actor.workspaceId}:${actor.userId}`);
    const link = await updateWhatsappLink(actor, (await context.params).id, await readJson(request));
    return NextResponse.json(link, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `whatsapp:${actor.workspaceId}:${actor.userId}`);
    await archiveWhatsappLink(actor, (await context.params).id);
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    return errorResponse(error);
  }
}