import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { requireWhatsAppIntelligence } from "@/modules/whatsapp/feature";
import { getWhatsappLink } from "@/modules/whatsapp/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    await enforceRateLimit(request, `whatsapp:${actor.workspaceId}:${actor.userId}`);
    const link = await getWhatsappLink(actor, (await context.params).id);
    return NextResponse.json({ phoneNumber: link.phoneNumber, url: link.whatsappUrl });
  } catch (error) {
    return errorResponse(error);
  }
}