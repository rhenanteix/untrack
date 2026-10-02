import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import { analyticsAssetTypes } from "@/modules/analytics/event-types";
import {
  analyticsAssets,
  analyticsChannels,
  analyticsJourneys,
  analyticsLocations,
  analyticsOverview,
  analyticsSources,
  analyticsTechnology,
  analyticsTime,
  analyticsTimeseries,
} from "@/modules/analytics/queries";
import { requireActor } from "@/modules/workspaces/context";

const searchSchema = z.object({
  view: z.enum(["overview", "timeseries", "sources", "channels", "assets", "locations", "technology", "time", "journeys"]).default("overview"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  assetType: z.enum(analyticsAssetTypes).optional(),
  assetId: z.string().min(1).max(255).optional(),
  campaignId: z.string().min(1).max(255).optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const input = searchSchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      from: input.from,
      to: input.to,
      assetType: input.assetType,
      assetId: input.assetId,
      campaignId: input.campaignId,
    };
    const data = await {
      overview: analyticsOverview,
      timeseries: analyticsTimeseries,
      sources: analyticsSources,
      channels: analyticsChannels,
      assets: analyticsAssets,
      locations: analyticsLocations,
      technology: analyticsTechnology,
      time: analyticsTime,
      journeys: analyticsJourneys,
    }[input.view](actor, filters);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}