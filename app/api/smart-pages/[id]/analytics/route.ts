import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import { requireActor } from "@/modules/workspaces/context";
import { smartPageMetrics } from "@/modules/smart-pages/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const days = z.coerce
      .number()
      .int()
      .min(1)
      .max(90)
      .parse(new URL(request.url).searchParams.get("days") ?? 30);
    return NextResponse.json(await smartPageMetrics(actor, id, days), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
