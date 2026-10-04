import type { Plan } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { PLAN_LIMITS, type Resource } from "@/modules/workspaces/policy";
import type { AccountAccess } from "./account-access";

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
  "goals",
] as const;

export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];
export type UsageMetric =
  | "links"
  | "smartPages"
  | "smartCards"
  | "qrCodes"
  | "campaigns"
  | "audienceContacts"
  | "goals";

const usageResources: Record<UsageMetric, Resource> = {
  links: "shortLinks",
  smartPages: "smartPages",
  smartCards: "smartCards",
  qrCodes: "qrCodes",
  campaigns: "campaigns",
  audienceContacts: "audienceContacts",
  goals: "goals",
};

const planEntitlements: Record<
  Plan,
  { analyticsHistoryDays: number; features: Record<PremiumFeature, boolean> }
> = {
  free: {
    analyticsHistoryDays: 7,
    features: {
      ...Object.fromEntries(PREMIUM_FEATURES.map((feature) => [feature, false])),
      goals: true,
    } as Record<PremiumFeature, boolean>,
  },
  premium: {
    analyticsHistoryDays: 365,
    features: Object.fromEntries(PREMIUM_FEATURES.map((feature) => [feature, true])) as Record<PremiumFeature, boolean>,
  },
};

export function canUse(
  access: Pick<AccountAccess, "effectivePlan">,
  feature: PremiumFeature,
) {
  return planEntitlements[access.effectivePlan].features[feature];
}

export function getLimit(
  access: Pick<AccountAccess, "effectivePlan">,
  metric: UsageMetric,
) {
  return PLAN_LIMITS[access.effectivePlan][usageResources[metric]];
}

export function getAnalyticsHistoryDays(
  access: Pick<AccountAccess, "effectivePlan">,
) {
  return planEntitlements[access.effectivePlan].analyticsHistoryDays;
}

export function hasReachedLimit(
  access: Pick<AccountAccess, "effectivePlan">,
  metric: UsageMetric,
  usage: Pick<WorkspaceUsage, UsageMetric>,
) {
  return usage[metric] >= getLimit(access, metric);
}

export type WorkspaceUsage = Record<UsageMetric, number>;

export async function getUsage(workspaceId: string): Promise<WorkspaceUsage> {
  const db = getPrisma();
  const [links, smartPages, smartCards, qrCodes, campaigns, audienceContacts, goals] =
    await Promise.all([
      db.shortLink.count({ where: { workspaceId } }),
      db.smartPage.count({ where: { workspaceId } }),
      db.smartCard.count({ where: { workspaceId } }),
      db.qrAsset.count({ where: { workspaceId } }),
      db.campaign.count({ where: { workspaceId } }),
      db.audienceContact.count({ where: { workspaceId } }),
      db.analyticsGoal.count({
        where: { workspaceId, status: { not: "ARCHIVED" } },
      }),
    ]);
  return { links, smartPages, smartCards, qrCodes, campaigns, audienceContacts, goals };
}