import { requireActor } from "@/modules/workspaces/context";
import { pixelStatus } from "@/modules/pixel/service";
import { connectError } from "@/modules/connect/http";
export async function GET(
  request: Request,
  context: { params: Promise<{ siteId: string }> },
) {
  try {
    const actor = await requireActor(request);
    const { siteId } = await context.params;
    const test = new URL(request.url).searchParams.get("test") ?? undefined;
    return Response.json(await pixelStatus(actor, siteId, test), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return connectError(error);
  }
}
