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
  updateCampaignSchema,
  createChannelSchema,
  updateChannelSchema,
  checklistItemSchema,
  type CreateCampaignInput,
  type UpdateCampaignInput,
  type CreateChannelInput,
  type UpdateChannelInput,
  type ChecklistItemInput,
} from "./schemas";
import {
  reserveQuota,
  releaseQuota,
  audit,
} from "@/modules/workspaces/context";
import type { Plan } from "@prisma/client";

export async function listCampaigns(
  actor: Actor,
  filters: z.infer<typeof libraryFilterSchema>,
) {
  const items = await getPrisma().campaign.findMany({
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
      _count: { select: { shortLinks: true, channels: true } },
    },
  });
  return {
    campaigns: items.slice(0, PAGE_SIZE),
    page: filters.page,
    hasMore: items.length > PAGE_SIZE,
    clients: await getPrisma().client.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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
      channels: true,
      checklistItems: { orderBy: { createdAt: "asc" } },
      approvals: {
        include: { approver: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!campaign)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  return campaign;
}

export async function createCampaign(actor: Actor, input: CreateCampaignInput) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await reserveQuota(tx, actor.workspaceId, "free" as Plan, "campaigns");
    const data = createCampaignSchema.parse(input);
    const campaign = await tx.campaign.create({
      data: { ...data, workspaceId: actor.workspaceId },
      include: { client: true, responsible: true },
    });
    await audit(tx, actor, "campaign.create", campaign.id, {
      name: campaign.name,
    });
    return campaign;
  });
}

export async function updateCampaign(
  actor: Actor,
  id: string,
  input: UpdateCampaignInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId: actor.workspaceId },
  });
  if (!existing)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const data = updateCampaignSchema.parse(input);
  const campaign = await prisma.campaign.update({
    where: { id },
    data,
    include: { client: true, responsible: true },
  });
  await audit(prisma, actor, "campaign.update", campaign.id, data);
  return campaign;
}

export async function deleteCampaign(actor: Actor, id: string) {
  const prisma = getPrisma();
  const existing = await prisma.campaign.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: { channels: true },
  });
  if (!existing)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  await prisma.campaign.delete({ where: { id } });
  await releaseQuota(prisma, actor.workspaceId, "campaigns");
  await audit(prisma, actor, "campaign.delete", id, { name: existing.name });
}

export async function createChannel(
  actor: Actor,
  campaignId: string,
  input: CreateChannelInput,
) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: actor.workspaceId },
  });
  if (!campaign)
    throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campanha não encontrada.");
  const data = createChannelSchema.parse(input);
  const channel = await prisma.campaignChannel.create({
    data: { ...data, workspaceId: actor.workspaceId, campaignId },
  });
  await audit(prisma, actor, "channel.create", channel.id, {
    campaignId,
    name: channel.name,
  });
  return channel;
}

export async function updateChannel(
  actor: Actor,
  campaignId: string,
  channelId: string,
  input: UpdateChannelInput,
) {
  const prisma = getPrisma();
  const existing = await prisma.campaignChannel.findFirst({
    where: { id: channelId, campaignId, workspaceId: actor.workspaceId },
  });
  if (!existing)
    throw new ApiError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado.");
  const data = updateChannelSchema.parse(input);
  const channel = await prisma.campaignChannel.update({
    where: { id: channelId },
    data,
  });
  await audit(prisma, actor, "channel.update", channelId, {
    campaignId,
    name: channel.name,
  });
  return channel;
}

export async function deleteChannel(
  actor: Actor,
  campaignId: string,
  channelId: string,
) {
  const prisma = getPrisma();
  const existing = await prisma.campaignChannel.findFirst({
    where: { id: channelId, campaignId, workspaceId: actor.workspaceId },
  });
  if (!existing)
    throw new ApiError(404, "CHANNEL_NOT_FOUND", "Canal não encontrado.");
  await prisma.campaignChannel.delete({ where: { id: channelId } });
  await audit(prisma, actor, "channel.delete", channelId, { campaignId });
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
