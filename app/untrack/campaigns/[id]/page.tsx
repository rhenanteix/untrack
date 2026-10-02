"use client";

import { CampaignDashboard } from "@/components/untrack/campaign-dashboard";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignDashboard params={params} />;
}
