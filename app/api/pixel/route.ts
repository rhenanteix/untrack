import { requireActor } from "@/modules/workspaces/context";
import { listSources } from "@/modules/connect/sources";
import { createPixel } from "@/modules/pixel/service";
import { connectError } from "@/modules/connect/http";
import { enforceSameOrigin } from "@/lib/request-origin";
import { readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function GET(request: Request) {
  try {
    const sources = await listSources(await requireActor(request));
    return Response.json(
      {
        sources: sources.filter(
          (s) => s.trust === "public" && s.key.startsWith("pixel-"),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `pixel-create:${actor.workspaceId}`);
    const source = await createPixel(actor, await readJson(request, 4096));
    return Response.json(
      { source },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
