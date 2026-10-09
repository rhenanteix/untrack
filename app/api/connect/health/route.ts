import { requireActor } from "@/modules/workspaces/context";
import { sourceHealth } from "@/modules/connect/operations";
import { connectError } from "@/modules/connect/http";
export async function GET(request: Request) {
  try {
    return Response.json(await sourceHealth(await requireActor(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return connectError(error);
  }
}
