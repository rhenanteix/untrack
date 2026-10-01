import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { requireWhatsAppIntelligence } from "@/modules/whatsapp/feature";
import { createWhatsappQr } from "@/modules/whatsapp/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `whatsapp-qr:${actor.workspaceId}:${actor.userId}`);
    const qr = await createWhatsappQr(actor, (await context.params).id);
    return NextResponse.json(qr, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}