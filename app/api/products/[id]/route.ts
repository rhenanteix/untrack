import { NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { getProduct, updateProduct } from "@/modules/products/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return NextResponse.json(await getProduct(actor, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `products:${actor.workspaceId}:${actor.userId}`,
    );
    const { id } = await context.params;
    return NextResponse.json(
      await updateProduct(actor, id, await readJson(request)),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}