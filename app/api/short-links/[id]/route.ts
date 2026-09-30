import { NextResponse } from "next/server";
import { requireActor } from "@/modules/workspaces/context";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { serializeLink, linkMetrics } from "@/lib/short-links";
import { workspaceLink, updateManagedLink, deleteManagedLink } from "@/modules/link-management/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request), { id } = await context.params;
    const link = await workspaceLink(actor, id);
    return NextResponse.json({ link: serializeLink(link), metrics: await linkMetrics(id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request), { id } = await context.params;
    await enforceRateLimit(request, `short-links:${actor.userId}`);
    return NextResponse.json(serializeLink(await updateManagedLink(actor, id, await readJson(request))), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request), { id } = await context.params;
    await enforceRateLimit(request, `short-links:${actor.userId}`);
    await deleteManagedLink(actor, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
