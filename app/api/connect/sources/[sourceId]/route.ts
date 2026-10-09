import { z } from "zod";
import { requireActor } from "@/modules/workspaces/context";
import { setSourceEnabled } from "@/modules/connect/operations";
import { connectError } from "@/modules/connect/http";
import { enforceSameOrigin } from "@/lib/request-origin";
import { readJson } from "@/lib/api-response";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const { sourceId } = await context.params;
    const input = z
      .object({ enabled: z.boolean() })
      .strict()
      .parse(await readJson(request, 1024));
    return Response.json(
      await setSourceEnabled(actor, sourceId, input.enabled),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
