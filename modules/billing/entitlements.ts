import type { Plan } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { PLAN_LIMITS, type Resource } from "@/modules/workspaces/policy";

export const PREMIUM_FEATURES = [
  "advancedAnalytics",
  "advancedSEO",
  "customDomain",
  "removeBranding",
  "advancedThemes",
  "advancedCustomization",
  "advancedQR",
  "dataExport",
  "trackingPixels",
  "webhooks",
  "advancedGoals",
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];
export type UsageMetric =
  | "links"
  | "smartPages"
  | "smartCards"
  | "qrCodes"
  | "campaigns"
  | "audienceContacts";

const usageResources: Record<UsageMetric, Resource> = {
  links: "shortLinks",
  smartPages: "smartPages",
  smartCards: "smartCards",
  qrCodes: "qrCodes",
  campaigns: "campaigns",
  audienceContacts: "audienceContacts",
};

const planEntitlements: Record<
  Plan,
  { analyticsHistoryDays: number; features: Record<PremiumFeature, boolean> }
> = {
  free: {
    analyticsHistoryDays: 7,
    features: Object.fromEntries(PREMIUM_FEATURES.map((feature) => [feature, false])) as Record<PremiumFeature, boolean>,
  },
  premium: {
    analyticsHistoryDays: 365,
    features: Object.fromEntries(PREMIUM_FEATURES.map((feature) => [feature, true])) as Record<PremiumFeature, boolean>,
  },
};

export function canUse(plan: Plan, feature: PremiumFeature) {
  return planEntitlements[plan].features[feature];
}

export function getLimit(plan: Plan, metric: UsageMetric) {
  return PLAN_LIMITS[plan][usageResources[metric]];
}

export function getAnalyticsHistoryDays(plan: Plan) {
  return planEntitlements[plan].analyticsHistoryDays;
}

export function hasReachedLimit(
  plan: Plan,
  metric: UsageMetric,
  usage: Pick<WorkspaceUsage, UsageMetric>,
) {
  return usage[metric] >= getLimit(plan, metric);
}

export type WorkspaceUsage = Record<UsageMetric, number>;

export async function getUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const db = getPrisma();
  const [links, smartPages, smartCards, qrCodes, campaigns, audienceContacts] =
    await Promise.all([
      db.shortLink.count({ where: { workspaceId } }),
      db.smartPage.count({ where: { workspaceId } }),
      db.smartCard.count({ where: { workspaceId } }),
      db.qrAsset.count({ where: { workspaceId } }),
      db.campaign.count({ where: { workspaceId } }),
      db.audienceContact.count({ where: { workspaceId } }),
    ]);
  return { links, smartPages, smartCards, qrCodes, campaigns, audienceContacts };
}