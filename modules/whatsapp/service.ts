import { randomBytes } from "node:crypto";
import type { Prisma, WhatsappLink } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { track } from "@/lib/analytics";
import { getPrisma } from "@/lib/prisma";
import { invalidateLinkCache } from "@/modules/link-management/cache";
import { createQrAsset } from "@/modules/untrack-qr/service";
import { saveUtm } from "@/modules/untrack-utm/service";
import {
  assertReferences,
  audit,
  releaseQuota,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  scoreWhatsAppLink,
  validateWhatsAppMessage,
} from "./domain";
import {
  createWhatsappLinkSchema,
  updateWhatsappLinkSchema,
  type WhatsappTracking,
} from "./schemas";

type WhatsappLinkWithRelations = WhatsappLink & {
  smartLink: { id: string; slug: string; domainKey: string; isActive: boolean; _count: { clicks: number } } | null;
  campaign: { id: string; name: string } | null;
};

function smartLinkUrl(slug: string) {
  return new URL(`/w/${slug}`, appUrl()).href;
}

function trackingEnabled(config: Prisma.JsonValue) {
  return !(
    config &&
    typeof config === "object" &&
    !Array.isArray(config) &&
    "enabled" in config &&
    config.enabled === false
  );
}

function serializeWhatsappLink(link: WhatsappLinkWithRelations) {
  const score = scoreWhatsAppLink({
    phoneNumber: link.phoneNumber,
    message: link.message,
    trackingEnabled: trackingEnabled(link.trackingConfig),
    hasCampaign: Boolean(link.campaignId),
    hasHealthMonitoring: false,
  });
  return {
    id: link.id,
    name: link.name,
    phoneNumber: link.phoneNumber,
    message: link.message,
    whatsappUrl: buildWhatsAppUrl(link.phoneNumber, link.message),
    status: link.status,
    campaign: link.campaign,
    campaignId: link.campaignId,
    trackingConfig: link.trackingConfig,
    smartLink: link.smartLink
      ? {
          id: link.smartLink.id,
          slug: link.smartLink.slug,
          url: smartLinkUrl(link.smartLink.slug),
          clicks: link.smartLink._count.clicks,
          isActive: link.smartLink.isActive,
        }
      : null,
    score,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

async function availableSlug(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = randomBytes(8).toString("base64url").slice(0, 10);
    const existing = await tx.shortLink.findUnique({
      where: { domainKey_slug: { domainKey: "platform", slug } },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new ApiError(409, "WHATSAPP_SLUG_COLLISION", "Não foi possível reservar um link inteligente. Tente novamente.");
}

async function assertProject(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  projectId: string | null | undefined,
) {
  if (!projectId) return;
  const project = await tx.project.findFirst({
    where: { id: projectId, workspaceId, status: "active" },
    select: { id: true },
  });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado ou arquivado neste workspace.");
}

async function assertNoDuplicate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  phoneNumber: string,
  message: string,
  campaignId: string | null | undefined,
  exceptId?: string,
) {
  const existing = await tx.whatsappLink.findFirst({
    where: {
      workspaceId,
      phoneNumber,
      message,
      campaignId: campaignId ?? null,
      status: { not: "ARCHIVED" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing)
    throw new ApiError(
      409,
      "DUPLICATE_WHATSAPP_LINK",
      `Um link semelhante já existe: ${existing.name}.`,
    );
}

function relationInclude() {
  return {
    smartLink: {
      select: {
        id: true,
        slug: true,
        domainKey: true,
        isActive: true,
        _count: { select: { clicks: true } },
      },
    },
    campaign: { select: { id: true, name: true } },
  } as const;
}

export async function listWhatsappLinks(actor: Actor, search = "") {
  const links = await getPrisma().whatsappLink.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phoneNumber: { contains: search.replace(/\D/g, "") } },
              { campaign: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: relationInclude(),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return links.map(serializeWhatsappLink);
}

export async function getWhatsappLink(actor: Actor, id: string) {
  const link = await getPrisma().whatsappLink.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: relationInclude(),
  });
  if (!link) throw new ApiError(404, "WHATSAPP_LINK_NOT_FOUND", "Link do WhatsApp não encontrado.");
  return serializeWhatsappLink(link);
}

export async function createWhatsappLink(actor: Actor, raw: unknown) {
  const input = createWhatsappLinkSchema.parse(raw);
  const phoneNumber = normalizeWhatsAppPhone(input.phoneNumber);
  const message = validateWhatsAppMessage(input.message);
  const link = await workspaceTransaction(actor, "write", async (tx, access) => {
    await assertReferences(tx, actor.workspaceId, { campaignId: input.campaignId });
    await assertProject(tx, actor.workspaceId, input.projectId);
    if (!input.allowDuplicate)
      await assertNoDuplicate(
        tx,
        actor.workspaceId,
        phoneNumber,
        message,
        input.campaignId,
      );
    const slug = await availableSlug(tx);
    await reserveQuota(tx, actor.workspaceId, access, "whatsappLinks");
    await reserveQuota(tx, actor.workspaceId, access, "shortLinks");
    const smartLink = await tx.shortLink.create({
      data: {
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        slug,
        domainKey: "platform",
        distribution: "whatsapp",
        destinationUrl: buildWhatsAppUrl(phoneNumber, message),
        title: input.name,
        description: "WhatsApp Intelligence",
        campaignId: input.campaignId,
        isActive: input.status === "ACTIVE",
      },
    });
    const whatsappLink = await tx.whatsappLink.create({
      data: {
        workspaceId: actor.workspaceId,
        name: input.name,
        phoneNumber,
        message,
        campaignId: input.campaignId,
        smartLinkId: smartLink.id,
        status: input.status,
        trackingConfig: input.trackingConfig,
      },
      include: relationInclude(),
    });
    if (input.projectId)
      await tx.projectResource.create({
        data: {
          workspaceId: actor.workspaceId,
          projectId: input.projectId,
          resourceType: "whatsappLink",
          resourceId: whatsappLink.id,
        },
      });
    await audit(tx, actor, "whatsappLink.created", whatsappLink.id, {
      campaignId: input.campaignId,
      projectId: input.projectId,
      status: input.status,
    });
    return whatsappLink;
  });
  await track("whatsapp_link_created", { workspaceId: actor.workspaceId });
  return serializeWhatsappLink(link);
}

export async function updateWhatsappLink(actor: Actor, id: string, raw: unknown) {
  const input = updateWhatsappLinkSchema.parse(raw);
  const result = await workspaceTransaction(actor, "write", async (tx, access) => {
    const before = await tx.whatsappLink.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      include: { smartLink: true },
    });
    if (!before)
      throw new ApiError(404, "WHATSAPP_LINK_NOT_FOUND", "Link do WhatsApp não encontrado.");
    const phoneNumber = input.phoneNumber
      ? normalizeWhatsAppPhone(input.phoneNumber)
      : before.phoneNumber;
    const message = input.message === undefined
      ? before.message
      : validateWhatsAppMessage(input.message);
    const campaignId = input.campaignId === undefined ? before.campaignId : input.campaignId;
    await assertReferences(tx, actor.workspaceId, { campaignId });
    await assertProject(tx, actor.workspaceId, input.projectId);
    if (input.phoneNumber !== undefined || input.message !== undefined || input.campaignId !== undefined)
      await assertNoDuplicate(tx, actor.workspaceId, phoneNumber, message, campaignId, id);
    const status = input.status ?? before.status;
    if (before.status === "ARCHIVED" && status !== "ARCHIVED")
      await reserveQuota(tx, actor.workspaceId, access, "whatsappLinks");
    if (before.status !== "ARCHIVED" && status === "ARCHIVED")
      await releaseQuota(tx, actor.workspaceId, "whatsappLinks");
    const link = await tx.whatsappLink.update({
      where: { id },
      data: {
        name: input.name,
        phoneNumber,
        message,
        campaignId,
        status,
        trackingConfig: input.trackingConfig,
      },
      include: relationInclude(),
    });
    if (before.smartLinkId)
      await tx.shortLink.update({
        where: { id: before.smartLinkId },
        data: {
          title: input.name,
          destinationUrl: buildWhatsAppUrl(phoneNumber, message),
          campaignId,
          isActive: status === "ACTIVE",
        },
      });
    if (input.projectId !== undefined) {
      await tx.projectResource.deleteMany({
        where: { workspaceId: actor.workspaceId, resourceType: "whatsappLink", resourceId: id },
      });
      if (input.projectId)
        await tx.projectResource.create({
          data: {
            workspaceId: actor.workspaceId,
            projectId: input.projectId,
            resourceType: "whatsappLink",
            resourceId: id,
          },
        });
    }
    await audit(tx, actor, "whatsappLink.updated", id, {
      status,
      campaignId,
    });
    return { link, smartLink: before.smartLink };
  });
  if (result.smartLink)
    await invalidateLinkCache(result.smartLink.domainKey, result.smartLink.slug);
  await track("whatsapp_link_updated", { workspaceId: actor.workspaceId });
  return serializeWhatsappLink(result.link);
}

export async function archiveWhatsappLink(actor: Actor, id: string) {
  const result = await workspaceTransaction(actor, "write", async (tx) => {
    const link = await tx.whatsappLink.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      include: { smartLink: true },
    });
    if (!link)
      throw new ApiError(404, "WHATSAPP_LINK_NOT_FOUND", "Link do WhatsApp não encontrado.");
    if (link.status === "ARCHIVED") return link;
    const archived = await tx.whatsappLink.update({
      where: { id },
      data: { status: "ARCHIVED" },
      include: { smartLink: true },
    });
    if (link.smartLinkId)
      await tx.shortLink.update({ where: { id: link.smartLinkId }, data: { isActive: false } });
    await releaseQuota(tx, actor.workspaceId, "whatsappLinks");
    await audit(tx, actor, "whatsappLink.archived", id);
    return archived;
  });
  if (result.smartLink)
    await invalidateLinkCache(result.smartLink.domainKey, result.smartLink.slug);
  await track("whatsapp_link_archived", { workspaceId: actor.workspaceId });
}

export async function createWhatsappQr(actor: Actor, id: string) {
  const link = await getWhatsappLink(actor, id);
  if (!link.smartLink || link.status !== "ACTIVE")
    throw new ApiError(409, "WHATSAPP_LINK_NOT_ACTIVE", "Ative o link do WhatsApp antes de gerar o QR.");
  const qr = await createQrAsset(actor, {
    name: `${link.name} QR`,
    url: link.smartLink.url,
    mode: "static",
    visual: {},
    campaignId: link.campaignId,
  });
  await track("whatsapp_qr_created", { workspaceId: actor.workspaceId });
  return qr;
}

export async function createWhatsappUtm(actor: Actor, id: string) {
  const link = await getWhatsappLink(actor, id);
  if (!link.smartLink || link.status !== "ACTIVE")
    throw new ApiError(409, "WHATSAPP_LINK_NOT_ACTIVE", "Ative o link do WhatsApp antes de gerar a UTM.");
  const config = trackingValues(link.trackingConfig);
  const campaign = config.campaign ?? link.campaign?.name;
  if (!config.enabled || !config.source || !config.medium || !campaign)
    throw new ApiError(
      422,
      "WHATSAPP_UTM_INCOMPLETE",
      "Informe origem, meio e campanha nas opções de tracking antes de gerar a UTM.",
    );
  return saveUtm(actor, {
    name: `${link.name} UTM`,
    builder: {
      url: link.smartLink.url,
      fields: {
        utm_source: config.source,
        utm_medium: config.medium,
        utm_campaign: campaign,
        ...(config.content ? { utm_content: config.content } : {}),
        ...(config.term ? { utm_term: config.term } : {}),
      },
      custom: [],
      conflicts: {},
      channel: "organic",
    },
    campaignId: link.campaignId,
  });
}

export function whatsappPreview(phoneNumber: string, message: string) {
  return { phoneNumber: normalizeWhatsAppPhone(phoneNumber), url: buildWhatsAppUrl(phoneNumber, message) };
}

export function trackingValues(config: Prisma.JsonValue): WhatsappTracking {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return { enabled: true };
  return config as WhatsappTracking;
}