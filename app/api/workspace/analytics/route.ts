import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-response";
import { analyticsAssetTypes } from "@/modules/analytics/event-types";
import {
  analyticsAssets,
  analyticsCampaigns,
  analyticsChannels,
  analyticsGoals,
  analyticsJourneys,
  analyticsLocations,
  analyticsOverview,
  analyticsSources,
  analyticsTechnology,
  analyticsTime,
  analyticsTimeseries,
  analyticsUtms,
} from "@/modules/analytics/queries";
import { requireActor } from "@/modules/workspaces/context";

const searchSchema = z.object({
  view: z
    .enum([
      "overview",
      "timeseries",
      "sources",
      "channels",
      "assets",
      "campaigns",
      "goals",
      "utms",
      "locations",
      "technology",
      "time",
      "journeys",
    ])
    .default("overview"),
  period: z.enum(["7d", "30d", "90d"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  assetType: z.enum(analyticsAssetTypes).optional(),
  assetId: z.string().min(1).max(255).optional(),
  campaignId: z.string().min(1).max(255).optional(),
  goalId: z.string().min(1).max(255).optional(),
  source: z.string().trim().min(1).max(253).optional(),
  channel: z
    .enum([
      "direct",
      "organic_search",
      "paid_search",
      "organic_social",
      "paid_social",
      "email",
      "messaging",
      "referral",
      "qr",
      "other",
    ])
    .optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const input = searchSchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      from: input.from,
      to: input.to,
      periodDays: input.period ? Number.parseInt(input.period, 10) : undefined,
      assetType: input.assetType,
      assetId: input.assetId,
      campaignId: input.campaignId,
      goalId: input.goalId,
      source: input.source,
      channel: input.channel,
    };
    const data = await {
      overview: analyticsOverview,
      timeseries: analyticsTimeseries,
      sources: analyticsSources,
      channels: analyticsChannels,
      assets: analyticsAssets,
      campaigns: analyticsCampaigns,
      goals: analyticsGoals,
      utms: analyticsUtms,
      locations: analyticsLocations,
      technology: analyticsTechnology,
      time: analyticsTime,
      journeys: analyticsJourneys,
    }[input.view](actor, filters);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
