import { z } from "zod";
import { requireActor } from "@/modules/workspaces/context";
import { listReceipts } from "@/modules/connect/operations";
import { connectError } from "@/modules/connect/http";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const params = new URL(request.url).searchParams;
    const sourceId = z
      .string()
      .min(1)
      .max(128)
      .parse(params.get("source_connection_id"));
    const cursor = z
      .string()
      .uuid()
      .optional()
      .parse(params.get("cursor") ?? undefined);
    const items = await listReceipts(actor, sourceId, cursor);
    return Response.json(
      { items, nextCursor: items.length === 100 ? items.at(-1)!.id : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return connectError(error);
  }
}
