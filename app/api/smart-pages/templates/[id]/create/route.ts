import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireActor } from "@/modules/workspaces/context";
import { createSmartPageFromTemplate } from "@/modules/smart-pages/template-service";

type Context = { params: Promise<{ id: string }> };

const createSchema = z
  .object({
    slug: z.string().trim().min(3).max(60),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-page-templates:${actor.userId}`);
    const { id } = await context.params;

    const input = createSchema.parse(await readJson(request));

    const page = await createSmartPageFromTemplate(actor, id, input);

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
