import { getPrisma } from "@/lib/prisma";
import type { Actor } from "@/modules/workspaces/context";
import { listFavorites, listRecent, projectResources } from "./service";

const DAY = 24 * 60 * 60 * 1000;

export async function workspaceDashboard(actor: Actor) {
  const db = getPrisma();
  const since = new Date(Date.now() - 30 * DAY);
  const [
    links,
    projects,
    campaigns,
    pages,
    linkClicks,
    pageViews,
    pageClicks,
    incidents,
    monitoredCampaigns,
    activity,
    topProjects,
    linksWithoutCampaign,
    campaignsWithoutQr,
    unmonitoredCampaigns,
    emptyProjects,
    favorites,
    recent,
  ] = await Promise.all([
    db.shortLink.count({ where: { workspaceId: actor.workspaceId, distribution: "digital" } }),
    db.project.count({ where: { workspaceId: actor.workspaceId, status: "active" } }),
    db.campaign.count({ where: { workspaceId: actor.workspaceId } }),
    db.smartPage.count({ where: { workspaceId: actor.workspaceId } }),
    db.linkClick.count({ where: { link: { workspaceId: actor.workspaceId }, createdAt: { gte: since } } }),
    db.analyticsEvent.count({ where: { workspaceId: actor.workspaceId, name: "smart_page_view", occurredAt: { gte: since } } }),
    db.analyticsEvent.count({ where: { workspaceId: actor.workspaceId, name: "smart_block_clicked", occurredAt: { gte: since } } }),
    db.campaignIncident.findMany({
      where: { workspaceId: actor.workspaceId, confirmed: true, status: { in: ["open", "confirmed"] } },
      select: { id: true, severity: true, message: true, campaign: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.campaignMonitorCheck.findMany({
      where: { workspaceId: actor.workspaceId },
      distinct: ["campaignId"],
      orderBy: { checkedAt: "desc" },
      select: { campaignId: true, status: true },
    }),
    db.auditLog.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.project.findMany({
      where: { workspaceId: actor.workspaceId, status: "active" },
      include: { _count: { select: { resources: true } } },
      orderBy: { resources: { _count: "desc" } },
      take: 3,
    }),
    db.shortLink.count({ where: { workspaceId: actor.workspaceId, distribution: "digital", campaignId: null } }),
    db.campaign.count({ where: { workspaceId: actor.workspaceId, qrs: { none: {} } } }),
    db.campaign.count({ where: { workspaceId: actor.workspaceId, channels: { none: { monitorEnabled: true } } } }),
    db.project.count({ where: { workspaceId: actor.workspaceId, status: "active", resources: { none: {} } } }),
    listFavorites(actor),
    listRecent(actor),
  ]);
  const critical = incidents.filter((item) => item.severity === "critical").length;
  const warnings = incidents.length - critical;
  const monitored = monitoredCampaigns.length;
  const healthy = monitoredCampaigns.filter((item) => item.status === "up").length;
  const opportunities = [
    linksWithoutCampaign
      ? { id: "assign-context", count: linksWithoutCampaign, label: "links sem contexto de campanha", action: "Organizar links", href: "/untrack/short-links" }
      : null,
    campaignsWithoutQr
      ? { id: "campaign-qr", count: campaignsWithoutQr, label: "campanhas sem QR Code", action: "Criar QR", href: "/untrack/qr" }
      : null,
    unmonitoredCampaigns
      ? { id: "monitor", count: unmonitoredCampaigns, label: "campanhas sem monitoramento", action: "Abrir campanhas", href: "/untrack/campaigns" }
      : null,
    emptyProjects
      ? { id: "project-resources", count: emptyProjects, label: "projetos aguardando recursos", action: "Ver projetos", href: "/untrack/projects" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => !!item);
  return {
    totals: { links, projects, campaigns, pages, linkClicks, pageViews, pageClicks },
    health: { monitored, healthy, warnings, critical, incidents },
    topProjects,
    opportunities,
    activity,
    favorites,
    recent,
  };
}

export async function projectExport(actor: Actor, projectId: string) {
  return projectResources(actor, projectId);
}

export async function projectInsights(actor: Actor, projectId: string) {
  const resources = await projectResources(actor, projectId);
  const db = getPrisma();
  const since = new Date(Date.now() - 30 * DAY);
  const ids = (resourceType: string) =>
    resources
      .filter((resource) => resource.resourceType === resourceType)
      .map((resource) => resource.id);
  const linkIds = ids("shortLink");
  const pageIds = ids("smartPage");
  const campaignIds = ids("campaign");
  const [linkClicks, pageViews, pageClicks, checks, incidents, activity] =
    await Promise.all([
      linkIds.length
        ? db.linkClick.count({
            where: { linkId: { in: linkIds }, createdAt: { gte: since } },
          })
        : 0,
      pageIds.length
        ? db.analyticsEvent.count({
            where: {
              workspaceId: actor.workspaceId,
              smartPageId: { in: pageIds },
              name: "smart_page_view",
              occurredAt: { gte: since },
            },
          })
        : 0,
      pageIds.length
        ? db.analyticsEvent.count({
            where: {
              workspaceId: actor.workspaceId,
              smartPageId: { in: pageIds },
              name: "smart_block_clicked",
              occurredAt: { gte: since },
            },
          })
        : 0,
      campaignIds.length
        ? db.campaignMonitorCheck.findMany({
            where: {
              workspaceId: actor.workspaceId,
              campaignId: { in: campaignIds },
            },
            orderBy: { checkedAt: "desc" },
            select: { campaignId: true, status: true },
          })
        : [],
      campaignIds.length
        ? db.campaignIncident.findMany({
            where: {
              workspaceId: actor.workspaceId,
              campaignId: { in: campaignIds },
              confirmed: true,
              status: { in: ["open", "confirmed"] },
            },
            select: { id: true, severity: true, message: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
          })
        : [],
      db.auditLog.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, action: true, entityId: true, details: true, createdAt: true },
      }),
    ]);
  const latestChecks = new Map<string, string>();
  for (const check of checks) {
    if (!latestChecks.has(check.campaignId)) latestChecks.set(check.campaignId, check.status);
  }
  const health = {
    monitored: latestChecks.size,
    healthy: [...latestChecks.values()].filter((status) => status === "up").length,
    warnings: incidents.filter((incident) => incident.severity !== "critical").length,
    critical: incidents.filter((incident) => incident.severity === "critical").length,
    incidents,
  };
  const activityForProject = activity.filter((entry) => {
    if (entry.entityId === projectId) return true;
    return (
      typeof entry.details === "object" &&
      entry.details !== null &&
      !Array.isArray(entry.details) &&
      (entry.details as { projectId?: unknown }).projectId === projectId
    );
  });
  const resourceCounts = Object.fromEntries(
    ["shortLink", "smartPage", "campaign", "utmLink", "qrAsset"].map((resourceType) => [
      resourceType,
      resources.filter((resource) => resource.resourceType === resourceType).length,
    ]),
  );
  return {
    resourceCounts,
    analytics: { linkClicks, pageViews, pageClicks, since },
    health,
    activity: activityForProject.slice(0, 8),
  };
}