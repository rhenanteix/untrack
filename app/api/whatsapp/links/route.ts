import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { requireWhatsAppIntelligence } from "@/modules/whatsapp/feature";
import { createWhatsappLink, listWhatsappLinks } from "@/modules/whatsapp/service";

export async function GET(request: Request) {
  try {
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    const search = new URL(request.url).searchParams.get("search") ?? "";
    return NextResponse.json(
      { items: await listWhatsappLinks(actor, search) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    requireWhatsAppIntelligence();
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(request, `whatsapp:${actor.workspaceId}:${actor.userId}`);
    const link = await createWhatsappLink(actor, await readJson(request));
    return NextResponse.json(link, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}