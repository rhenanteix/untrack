import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import {
  analyticsAssetTypes,
  analyticsChannels,
} from "@/modules/analytics/event-types";
import { analyticsConversions } from "@/modules/analytics/queries";
import { requireActor } from "@/modules/workspaces/context";

const searchSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  goalId: z.string().min(1).max(255).optional(),
  campaignId: z.string().min(1).max(255).optional(),
  assetType: z.enum(analyticsAssetTypes).optional(),
  assetId: z.string().min(1).max(255).optional(),
  source: z.string().trim().min(1).max(253).optional(),
  channel: z.enum(analyticsChannels).optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const input = searchSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return NextResponse.json(await analyticsConversions(actor, input), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
