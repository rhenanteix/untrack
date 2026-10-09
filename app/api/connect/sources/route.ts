import { requireActor } from "@/modules/workspaces/context";
import { listSources } from "@/modules/connect/sources";
import { connectError } from "@/modules/connect/http";
export async function GET(request: Request) {
  try {
    return Response.json(
      { sources: await listSources(await requireActor(request)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
