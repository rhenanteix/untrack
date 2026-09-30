import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { audit } from "@/modules/workspaces/context";
import { Prisma } from "@prisma/client";
import type { IncidentSeverity } from "./schemas";

export async function createIncident(
  actor: Actor,
  campaignId: string,
  channelId: string | undefined,
  code: string,
  message: string,
  severity: IncidentSeverity = "warning",
  metadata: Record<string, unknown> = {},
) {
  const prisma = getPrisma();
  const dedupeKey = `${campaignId}:${channelId ?? "global"}:${code}`;
  const existing = await prisma.campaignIncident.findFirst({
    where: {
      workspaceId: actor.workspaceId,
      campaignId,
      channelId: channelId ?? undefined,
      dedupeKey,
      status: { in: ["open", "confirmed"] },
      cooldownUntil: { gt: new Date() },
    },
  });
  if (existing) return existing;

  const incident = await prisma.campaignIncident.create({
    data: {
      workspaceId: actor.workspaceId,
      campaignId,
      channelId: channelId ?? undefined,
      code,
      message,
      status: "open",
      severity,
      confirmed: false,
      dedupeKey,
      cooldownUntil: new Date(Date.now() + 5 * 60 * 1000),
      metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue,
    },
  });
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "incident.create", incident.id, { code, message, severity });
  });
  return incident;
}

export async function confirmIncident(actor: Actor, incidentId: string) {
  const prisma = getPrisma();
  const existing = await prisma.campaignIncident.findFirst({
    where: { id: incidentId, workspaceId: actor.workspaceId },
  });
  if (!existing) throw new ApiError(404, "INCIDENT_NOT_FOUND", "Incidente não encontrado.");
  const incident = await prisma.campaignIncident.update({
    where: { id: incidentId },
    data: { confirmed: true, status: "confirmed", updatedAt: new Date() },
  });
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "incident.confirm", incidentId, { code: incident.code });
  });
  return incident;
}

export async function recoverIncident(actor: Actor, incidentId: string) {
  const prisma = getPrisma();
  const existing = await prisma.campaignIncident.findFirst({
    where: { id: incidentId, workspaceId: actor.workspaceId },
  });
  if (!existing) throw new ApiError(404, "INCIDENT_NOT_FOUND", "Incidente não encontrado.");
  const incident = await prisma.campaignIncident.update({
    where: { id: incidentId },
    data: { status: "recovered", recoveredAt: new Date(), updatedAt: new Date() },
  });
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "incident.recover", incidentId, { code: incident.code });
  });
  return incident;
}

export async function listIncidents(actor: Actor, campaignId?: string, channelId?: string) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { workspaceId: actor.workspaceId };
  if (campaignId) where.campaignId = campaignId;
  if (channelId) where.channelId = channelId;
  return prisma.campaignIncident.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { campaign: true, channel: true },
  });
}

export async function getIncident(actor: Actor, incidentId: string) {
  const prisma = getPrisma();
  const incident = await prisma.campaignIncident.findFirst({
    where: { id: incidentId, workspaceId: actor.workspaceId },
    include: { campaign: true, channel: true },
  });
  if (!incident) throw new ApiError(404, "INCIDENT_NOT_FOUND", "Incidente não encontrado.");
  return incident;
}
