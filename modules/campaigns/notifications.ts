import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import type { NotificationAdapter } from "./schemas";

export interface NotificationPayload {
  workspaceId: string;
  incidentId?: string;
  adapter: NotificationAdapter;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export async function sendNotification(actor: Actor, payload: NotificationPayload) {
  const prisma = getPrisma();
  const delivery = await prisma.notificationDelivery.create({
    data: {
      workspaceId: actor.workspaceId,
      incidentId: payload.incidentId,
      adapter: payload.adapter,
      status: "pending",
      payload: { title: payload.title, body: payload.body, data: JSON.parse(JSON.stringify(payload.data)) } as Prisma.InputJsonValue,
    },
  });
  try {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "sent", sentAt: new Date() },
    });
    return delivery;
  } catch (error) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", response: { error: (error as Error).message } },
    });
    throw new ApiError(500, "NOTIFICATION_FAILED", "Falha ao enviar notificação.");
  }
}

export async function testNotification(actor: Actor, adapter: NotificationAdapter) {
  return sendNotification(actor, {
    workspaceId: actor.workspaceId,
    adapter,
    title: "Teste de integração Untrack",
    body: "Esta é uma mensagem de teste para validar a integração.",
    data: { test: true },
  });
}

export async function listDeliveries(actor: Actor, incidentId?: string) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = { workspaceId: actor.workspaceId };
  if (incidentId) where.incidentId = incidentId;
  return prisma.notificationDelivery.findMany({ where, orderBy: { createdAt: "desc" } });
}
