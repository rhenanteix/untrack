import { requireActor } from "@/modules/workspaces/context";
import { assertQrOwnership } from "@/modules/untrack-qr/service";
import { exportQr } from "@/modules/untrack-qr/render";
import { errorResponse } from "@/lib/api-response";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request), { id } = await context.params;
    const qr = await assertQrOwnership(actor, id);
    const format = z.enum(["png", "svg", "pdf"]).parse(new URL(request.url).searchParams.get("format") ?? "png");
    const output = await exportQr(qr.encodedUrl, qr.visual, format);
    return new Response(new Uint8Array(output.bytes), { headers: { "Content-Type": output.contentType, "Content-Disposition": `attachment; filename="untrack-qr.${format}"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
