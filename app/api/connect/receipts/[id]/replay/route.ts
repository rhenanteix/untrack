import { requireActor } from "@/modules/workspaces/context";
import { replayDeadLetter } from "@/modules/connect/queue";
import { connectError } from "@/modules/connect/http";
import { enforceSameOrigin } from "@/lib/request-origin";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    return Response.json(
      await replayDeadLetter(actor, (await context.params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
