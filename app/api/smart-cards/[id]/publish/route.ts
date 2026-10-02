import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { setSmartCardPublished } from "@/modules/smart-cards/service";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-cards:${actor.userId}`);
    const { id } = await context.params;
    const { published } = z
      .object({ published: z.boolean() })
      .strict()
      .parse(await readJson(request));
    return NextResponse.json(
      await setSmartCardPublished(actor, id, published),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
