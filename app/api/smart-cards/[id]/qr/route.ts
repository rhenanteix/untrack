import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { exportQr } from "@/modules/untrack-qr/render";
import { ensureSmartCardQr, getSmartCard } from "@/modules/smart-cards/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-cards:${actor.userId}`);
    const { id } = await context.params;
    return NextResponse.json(await ensureSmartCardQr(actor, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const format = z
      .enum(["png", "svg", "pdf"])
      .default("png")
      .parse(new URL(request.url).searchParams.get("format") ?? "png");
    const card = await getSmartCard(actor, id);
    if (!card.qrAsset)
      return NextResponse.json(
        {
          code: "SMART_CARD_QR_NOT_FOUND",
          message: "Gere o QR do cartão primeiro.",
        },
        { status: 404 },
      );
    const exported = await exportQr(
      card.qrAsset.encodedUrl,
      card.qrAsset.visual,
      format,
    );
    return new NextResponse(Uint8Array.from(exported.bytes), {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${card.slug}-qr.${format}"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
