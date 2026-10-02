import {
  libraryFilterSchema,
  dateFilter,
} from "@/modules/workspaces/library-filters";
import { PAGE_SIZE } from "@/lib/pagination";
import type { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import {
  createCampaignSchema,
  campaignBuilderSchema,
  updateCampaignSchema,
  createChannelSchema,
  updateChannelSchema,
  checklistItemSchema,
  type CreateCampaignInput,
  type CampaignBuilderInput,
  type CreateCampaignAssetInput,
  type UpdateCampaignInput,
  type CreateChannelInput,
  type UpdateChannelInput,
  type ChecklistItemInput,
} from "./schemas";
import {
  reserveQuota,
  releaseQuota,
  audit,
  assertReferences,
  workspaceTransaction,
} from "@/modules/workspaces/context";
import { generateUtmUrl } from "@/modules/utm/utm.service";
import { createManagedLink } from "@/modules/link-management/service";
import { createQrAsset } from "@/modules/untrack-qr/service";
import { createWhatsappLink } from "@/modules/whatsapp/service";
import { publicLinkUrl } from "@/lib/app-url";

function trackingValue(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "untrack"
  );
}

function automaticTracking(
  campaignName: string,
  channel: { name: string; type: string },
  overrides: {
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
  } = {},
) {
  return {
    utmSource: overrides.utmSource || trackingValue(channel.name),
    utmMedium: overrides.utmMedium || trackingValue(channel.type),
    utmCampaign: overrides.utmCampaign || trackingValue(campaignName),
    utmTerm: overrides.utmTerm || null,
    utmContent: overrides.utmContent || trackingValue(channel.name),
  };
}

function trackedDestination(
  destinationUrl: string,
  tracking: ReturnType<typeof automaticTracking>,
) {
  return generateUtmUrl({
    url: destinationUrl,
    source: tracking.utmSource,
    medium: tracking.utmMedium,
    campaign: tracking.utmCampaign,
    term: tracking.utmTerm ?? "",
    content: tracking.utmContent ?? "",
  });
}

async function assertCampaignInputReferences(
  tx: Parameters<Parameters<typeof workspaceTransaction>[2]>[0],
  workspaceId: string,
  input: {
    clientId?: string | null;
    responsibleId?: string | null;
    primaryDestinationType?: string | null;
    primaryDestinationId?: string | null;
  },
) {
  await assertReferences(tx, workspaceId, { clientId: input.clientId });
  if (input.responsibleId) {
    const member = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: input.responsibleId,
        },
      },
      select: { userId: true },
    });
    if (!member)
      throw new ApiError(
        422,
        "RESPONSIBLE_NOT_IN_WORKSPACE",
        "O responsável precisa participar deste workspace.",
      );
  }
  if (!input.primaryDestinationId) return;

  const where = { id: input.primaryDestinationId, workspaceId };
  const resource =
    input.primaryDestinationType === "smart_page"
      ? await tx.smartPage.findFirst({ where, select: { id: true } })
      : input.primaryDestinationType === "product"
        ? await tx.product.findFirst({ where, select: { id: true } })
        : input.primaryDestinationType === "whatsapp"
          ? await tx.whatsappLink.findFirst({ where, select: { id: true } })
          : { id: input.primaryDestinationId };
  if (!resource)
    throw new ApiError(
      404,
      "DESTINATION_NOT_FOUND",
      "O destino selecionado não pertence a este workspace.",
    );
}

async function assertChannelResources(
  tx: Parameters<Parameters<typeof workspaceTransaction>[2]>[0],
  workspaceId: string,
  input: {
    shortLinkId?: string | null;
    qrId?: string | null;
    templateId?: string | null;
  },
) {
  const [link, qr, template] = await Promise.all([
    input.shortLinkId
      ? tx.shortLink.findFirst({
          where: { id: input.shortLinkId, workspaceId },
          select: { id: true },
        })
      : null,
    input.qrId
      ? tx.qrAsset.findFirst({
          where: { id: input.qrId, workspaceId },
          select: { id: true },
        })
      : null,
    input.templateId
      ? tx.utmTemplate.findFirst({
          where: { id: input.templateId, workspaceId },
          select: { id: true },
        })
      : null,
  ]);
  if (
    (input.shortLinkId && !link) ||
    (input.qrId && !qr) ||
    (input.templateId && !template)
  )
    throw new ApiError(
      404,
      "CHANNEL_RESOURCE_NOT_FOUND",
      "O recurso associado ao canal não pertence a este workspace.",
    );
}

export async function listCampaigns(
  actor: Actor,
  filters: z.infer<typeof libraryFilterSchema>,
) {
  const prisma = getPrisma();
  const items = await prisma.campaign.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? { name: { contains: filters.search, mode: "insensitive" } }
        : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      createdAt: dateFilter(filters.from, filters.to),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (filters.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      client: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      _count: { select: { shortLinks: true, channels: true, assets: true } },
    },
  });
  const visibleCampaigns = items.slice(0, PAGE_SIZE);
  const campaignIds = visibleCampaigns.map((campaign) => campaign.id);
  const periodStart = new Date(Date.now() - 30 * 86_400_000);
  const [links, statusCounts, needsAttention, periodClicks] = await Promise.all(
    [
      prisma.shortLink.findMany({
        where: {
          workspaceId: actor.workspaceId,
          campaignId: { in: campaignIds },
        },
        select: {
          campaignId: true,
          _count: { select: { clicks: true } },
        },
      }),
      prisma.campaign.groupBy({
        by: ["status"],
        where: { workspaceId: actor.workspaceId },
        _count: { _all: true },
      }),
      prisma.campaignIncident.count({
        where: {
          workspaceId: actor.workspaceId,
          status: { in: ["open", "confirmed"] },
        },
      }),
      prisma.linkClick.count({
        where: {
          createdAt: { gte: periodStart },
          link: { workspaceId: actor.workspaceId, campaignId: { not: null } },
        },
      }),
    ],
  );
  const clicksByCampaign = new Map<string, number>();
  for (const link of links) {
    if (!link.campaignId) continue;
    clicksByCampaign.set(
      link.campaignId,
      (clicksByCampaign.get(link.campaignId) ?? 0) + link._count.clicks,
    );
  }
  const byStatus = new Map(
    statusCounts.map((item) => [item.status, item._count._all]),
  );
  return {
    campaigns: visibleCampaigns.map((campaign) => ({
      ...campaign,
      clicks: clicksByCampaign.get(campaign.id) ?? 0,
    })),
    page: filters.page,
    hasMore: items.length > PAGE_SIZE,
    summary: {
      active: byStatus.get("active") ?? 0,
      draft: byStatus.get("draft") ?? 0,
      needsAttention,
      periodClicks,
    },
    clients: await getPrisma().client.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    members: await getPrisma().workspaceMember.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
      take: 100,
    }),
    smartPages: await getPrisma().smartPage.findMany({
      where: { workspaceId: actor.workspaceId, status: "published" },
      select: { id: true, title: true, slug: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  };
}

export async function getCampaign(actor: Actor, id: string) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: {
      client: true,
      responsible: true,
      channels: {
        include: {
          assets: {
            include: {
              link: {
                select: {
                  id: true,
                  slug: true,
                  domainKey: true,
                  isActive: true,
                  _count: { select: { clicks: true } },
                },
              },
              qr: {
                select: {
                  id: true,
                  encodedUrl: true,
                  mode: true,
                  redirectId: true,
                },
              },
              whatsappLink: {
                select: {
                  id: true,
                  phoneNumber: true,
                  message: true,
                  smartLink: {
                    select: {
                      id: true,
                      slug: true,
                      domainKey: true,
                      isActive: true,
                      _count: { select: { clicks: true } },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      checklistItems: { orderBy: { createdAt: "asc" } },
      monitoringChecks: {
        orderBy: { checkedAt: "desc" },
        take: 30,
      },
      incidents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      approvals: {
        include: { approver: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!campaign)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const [clicks, clickDays, activities] = await Promise.all([
    prisma.linkClick.count({
      where: { link: { campaignId: id, workspaceId: actor.workspaceId } },
    }),
    prisma.linkClick.groupBy({
      by: ["day"],
      where: { link: { campaignId: id, workspaceId: actor.workspaceId } },
      _count: { _all: true },
      orderBy: { day: "asc" },
      take: 30,
    }),
    prisma.auditLog.findMany({
      where: { workspaceId: actor.workspaceId, entityId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const activityActors = await prisma.user.findMany({
    where: { id: { in: activities.map((activity) => activity.actorId) } },
    select: { id: true, name: true },
  });
  const actorNames = new Map(
    activityActors.map((user) => [user.id, user.name]),
  );
  const channels = campaign.channels.map((channel) => ({
    ...channel,
    assets: channel.assets.map((asset) => {
      const link = asset.link ?? asset.whatsappLink?.smartLink ?? null;
      return {
        ...asset,
        clicks: link?._count.clicks ?? 0,
        distributionUrl: link
          ? link.domainKey === "platform"
            ? publicLinkUrl(link.slug)
            : `https://${link.domainKey}/s/${link.slug}`
          : (asset.qr?.encodedUrl ?? null),
      };
    }),
  }));
  return {
    ...campaign,
    channels,
    metrics: {
      clicks,
      daily: clickDays.map((day) => ({
        date: day.day.toISOString().slice(0, 10),
        clicks: day._count._all,
      })),
    },
    activities: activities.map((activity) => ({
      ...activity,
      actor: { name: actorNames.get(activity.actorId) ?? "Membro removido" },
    })),
  };
}

export async function createCampaign(actor: Actor, input: CreateCampaignInput) {
  const campaign = await workspaceTransaction(actor, "write", async (tx, plan) => {
    const data = createCampaignSchema.parse(input);
    await assertCampaignInputReferences(tx, actor.workspaceId, data);
    await reserveQuota(tx, actor.workspaceId, plan, "campaigns");
    const campaign = await tx.campaign.create({
      data: { ...data, workspaceId: actor.workspaceId },
      include: { client: true, responsible: true },
    });
    await audit(tx, actor, "campaign.create", campaign.id, {
      name: campaign.name,
    });
    return campaign;
  });
  const { track } = await import("@/lib/analytics");
  await track("campaign_created", { workspaceId: actor.workspaceId });
  return campaign;
}

export async function createCampaignFromBuilder(
  actor: Actor,
  raw: CampaignBuilderInput,
) {
  const input = campaignBuilderSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    await assertCampaignInputReferences(tx, actor.workspaceId, input);
    await reserveQuota(tx, actor.workspaceId, plan, "campaigns");
    const campaign = await tx.campaign.create({
      data: {
        workspaceId: actor.workspaceId,
        name: input.name,
        description: input.description,
        clientId: input.clientId,
        responsibleId: input.responsibleId,
        objective: input.objectiveDescription,
        objectiveType: input.objectiveType,
        primaryDestinationType: input.primaryDestinationType,
        primaryDestinationId: input.primaryDestinationId,
        primaryDestinationUrl: input.primaryDestinationUrl,
        startDate: input.startDate,
        endDate: input.endDate,
        channels: {
          create: input.channels.map((channel) => {
            const tracking = automaticTracking(input.name, channel);
            return {
              workspaceId: actor.workspaceId,
              name: channel.name,
              type: channel.type,
              destinationUrl: trackedDestination(
                input.primaryDestinationUrl,
                tracking,
              ),
              ...tracking,
            };
          }),
        },
      },
      include: { client: true, responsible: true, channels: true },
    });
    await audit(tx, actor, "campaign.created", campaign.id, {
      name: campaign.name,
      objectiveType: campaign.objectiveType,
      channels: campaign.channels.length,
    });
    return campaign;
  });
}

export async function updateCampaign(
  actor: Actor,
  id: string,
  input: UpdateCampaignInput,
) {
  const data = updateCampaignSchema.parse(input);
  return workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.campaign.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!existing)
      throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    await assertCampaignInputReferences(tx, actor.workspaceId, {
      clientId: data.clientId === undefined ? existing.clientId : data.clientId,
      responsibleId:
        data.responsibleId === undefined
          ? existing.responsibleId
          : data.responsibleId,
      primaryDestinationType:
        data.primaryDestinationType === undefined
          ? existing.primaryDestinationType
          : data.primaryDestinationType,
      primaryDestinationId:
        data.primaryDestinationId === undefined
          ? existing.primaryDestinationId
          : data.primaryDestinationId,
    });
    const campaign = await tx.campaign.update({
      where: { id },
      data,
      include: { client: true, responsible: true },
    });
    await audit(tx, actor, "campaign.updated", campaign.id, data);
    return campaign;
  });
}

export async function deleteCampaign(actor: Actor, id: string) {
  await workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.campaign.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      include: { channels: true },
    });
    if (!existing)
      throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    await tx.campaign.delete({ where: { id } });
    await releaseQuota(tx, actor.workspaceId, "campaigns");
    await audit(tx, actor, "campaign.deleted", id, { name: existing.name });
  });
}

export async function createChannel(
  actor: Actor,
  campaignId: string,
  input: CreateChannelInput,
) {
  const data = createChannelSchema.parse(input);
  return workspaceTransaction(actor, "write", async (tx) => {
    const campaign = await tx.campaign.findFirst({
      where: { id: campaignId, workspaceId: actor.workspaceId },
    });
    if (!campaign)
      throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
    await assertChannelResources(tx, actor.workspaceId, data);
    const tracking = automaticTracking(campaign.name, data, data);
    const channel = await tx.campaignChannel.create({
      data: {
        ...data,
        ...tracking,
        destinationUrl: trackedDestination(data.destinationUrl, tracking),
        workspaceId: actor.workspaceId,
        campaignId,
      },
    });
    await audit(tx, actor, "campaign.channel.created", campaignId, {
      channelId: channel.id,
      name: channel.name,
    });
    return channel;
  });
}

export async function updateChannel(
  actor: Actor,
  campaignId: string,
  channelId: string,
  input: UpdateChannelInput,
) {
  const data = updateChannelSchema.parse(input);
  return workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.campaignChannel.findFirst({
      where: { id: channelId, campaignId, workspaceId: actor.workspaceId },
      include: { campaign: { select: { name: true } } },
    });
    if (!existing)
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado.");
    await assertChannelResources(tx, actor.workspaceId, data);
    const tracking = automaticTracking(
      existing.campaign.name,
      { name: data.name ?? existing.name, type: data.type ?? existing.type },
      {
        utmSource: data.utmSource ?? existing.utmSource,
        utmMedium: data.utmMedium ?? existing.utmMedium,
        utmCampaign: data.utmCampaign ?? existing.utmCampaign,
        utmTerm: data.utmTerm ?? existing.utmTerm,
        utmContent: data.utmContent ?? existing.utmContent,
      },
    );
    const channel = await tx.campaignChannel.update({
      where: { id: channelId },
      data: {
        ...data,
        ...tracking,
        ...(data.destinationUrl
          ? {
              destinationUrl: trackedDestination(data.destinationUrl, tracking),
            }
          : {}),
      },
    });
    await audit(tx, actor, "campaign.channel.updated", campaignId, {
      channelId,
      name: channel.name,
    });
    return channel;
  });
}

export async function deleteChannel(
  actor: Actor,
  campaignId: string,
  channelId: string,
) {
  await workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.campaignChannel.findFirst({
      where: { id: channelId, campaignId, workspaceId: actor.workspaceId },
    });
    if (!existing)
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado.");
    await tx.campaignChannel.delete({ where: { id: channelId } });
    await audit(tx, actor, "campaign.channel.deleted", campaignId, {
      channelId,
      name: existing.name,
    });
  });
}

export async function createCampaignAsset(
  actor: Actor,
  campaignId: string,
  raw: CreateCampaignAssetInput,
) {
  const input = (await import("./schemas")).createCampaignAssetSchema.parse(
    raw,
  );
  const context = await getPrisma().campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
    include: {
      channels: { where: { id: input.channelId }, take: 1 },
    },
  });
  if (!context)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const channel = context.channels[0];
  if (!channel)
    throw new ApiError(
      404,
      "CHANNEL_NOT_FOUND",
      "O ponto de distribuição precisa pertencer a um canal da campanha.",
    );

  const tracking = automaticTracking(context.name, channel, input);
  const destinationUrl = input.destinationUrl
    ? trackedDestination(input.destinationUrl, tracking)
    : context.primaryDestinationUrl
      ? trackedDestination(context.primaryDestinationUrl, tracking)
      : null;
  if (input.mode !== "whatsapp" && !destinationUrl)
    throw new ApiError(
      422,
      "DESTINATION_REQUIRED",
      "Defina o destino principal da campanha ou informe outro destino.",
    );

  let linkId: string | null = null;
  let qrId: string | null = null;
  let whatsappLinkId: string | null = null;
  let distributionUrl: string | null = null;

  if (input.mode === "link") {
    const link = await createManagedLink(actor, {
      url: destinationUrl!,
      title: input.name,
      description: `Ponto de distribuição de ${context.name}`,
      tags: [],
      campaignId,
    });
    linkId = link.id;
    distributionUrl = publicLinkUrl(link.slug);
  } else if (input.mode === "qr") {
    const result = await createQrAsset(actor, {
      name: input.name,
      url: destinationUrl!,
      mode: "dynamic",
      visual: {},
      campaignId,
    });
    linkId = result.qr.redirectId;
    qrId = result.qr.id;
    distributionUrl = result.qr.encodedUrl;
  } else {
    const link = await createWhatsappLink(actor, {
      name: input.name,
      phoneNumber: input.phoneNumber,
      message: input.message,
      campaignId,
      status: "ACTIVE",
      trackingConfig: {
        enabled: true,
        source: tracking.utmSource,
        medium: tracking.utmMedium,
        campaign: tracking.utmCampaign,
        term: tracking.utmTerm ?? undefined,
        content: tracking.utmContent ?? undefined,
      },
    });
    whatsappLinkId = link.id;
    linkId = link.smartLink?.id ?? null;
    distributionUrl = link.smartLink?.url ?? null;
  }

  const asset = await workspaceTransaction(actor, "write", async (tx) => {
    const activeChannel = await tx.campaignChannel.findFirst({
      where: { id: channel.id, campaignId, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (!activeChannel)
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado.");
    const asset = await tx.campaignAsset.create({
      data: {
        workspaceId: actor.workspaceId,
        campaignId,
        channelId: channel.id,
        name: input.name,
        assetType: input.assetType,
        destinationType:
          input.destinationType ?? context.primaryDestinationType ?? "url",
        destinationId: input.destinationId ?? context.primaryDestinationId,
        destinationUrl,
        linkId,
        qrId,
        whatsappLinkId,
        metadata: { mode: input.mode, tracking },
      },
    });
    await audit(tx, actor, "campaign.asset.created", campaignId, {
      assetId: asset.id,
      channelId: channel.id,
      name: asset.name,
      assetType: asset.assetType,
    });
    return asset;
  });
  return { asset, distributionUrl };
}

export async function setChecklist(
  actor: Actor,
  campaignId: string,
  items: ChecklistItemInput[],
) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
  });
  if (!campaign)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const parsed = items.map((item) => checklistItemSchema.parse(item));
  await prisma.campaignChecklist.deleteMany({
    where: { campaignId, workspaceId: actor.workspaceId },
  });
  const created = await prisma.campaignChecklist.createMany({
    data: parsed.map((item) => ({
      ...item,
      campaignId,
      workspaceId: actor.workspaceId,
    })),
  });
  await audit(prisma, actor, "checklist.set", campaignId, {
    count: created.count,
  });
  return prisma.campaignChecklist.findMany({
    where: { campaignId, workspaceId: actor.workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateChecklistItem(
  actor: Actor,
  campaignId: string,
  itemId: string,
  patch: Partial<ChecklistItemInput>,
) {
  const prisma = getPrisma();
  const existing = await prisma.campaignChecklist.findFirst({
    where: { id: itemId, campaignId, workspaceId: actor.workspaceId },
  });
  if (!existing)
    throw new ApiError(
      404,
      "CHECKLIST_ITEM_NOT_FOUND",
      "Item do checklist não encontrado.",
    );
  const item = await prisma.campaignChecklist.update({
    where: { id: itemId },
    data: { ...patch, checkedAt: patch.status ? new Date() : null },
  });
  await audit(prisma, actor, "checklist.update", itemId, {
    campaignId,
    status: item.status,
  });
  return item;
}

export async function approveCampaign(
  actor: Actor,
  campaignId: string,
  action: "approved" | "rejected",
  notes: string,
) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
  });
  if (!campaign)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new ApiError(
      400,
      "CAMPAIGN_NOT_APPROVABLE",
      "Apenas campanhas em rascunho ou agendadas podem ser aprovadas.",
    );
  }
  const approval = await prisma.campaignApproval.create({
    data: {
      workspaceId: actor.workspaceId,
      campaignId,
      approverId: actor.userId,
      action,
      notes,
    },
    include: { approver: true },
  });
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      approvalStatus: action === "approved" ? "approved" : "rejected",
      approvedAt: action === "approved" ? new Date() : null,
      approvedById: action === "approved" ? actor.userId : null,
      status: action === "approved" ? "scheduled" : "draft",
    },
  });
  await audit(prisma, actor, "campaign.approve", campaignId, { action, notes });
  return { approval, campaign: updated };
}
