import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  addSmartPageBlock,
  reorderSmartPageBlocks,
} from "@/modules/smart-pages/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-pages:${actor.userId}`);
    const { id } = await context.params;
    return NextResponse.json(
      await addSmartPageBlock(actor, id, await readJson(request)),
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-pages:${actor.userId}`);
    const { id } = await context.params;
    const { blockIds } = z
      .object({ blockIds: z.array(z.string().min(1)).max(100) })
      .strict()
      .parse(await readJson(request));
    await reorderSmartPageBlocks(actor, id, blockIds);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
