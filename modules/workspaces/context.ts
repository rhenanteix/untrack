import { Prisma, type WorkspaceRole } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { requireUser } from "@/lib/session";
import {
  getAccountAccess,
  type AccountAccess,
} from "@/modules/billing/account-access";
import {
  assertPermission,
  PLAN_LIMITS,
  type Permission,
  type Resource,
} from "./policy";

export interface Actor {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}
export async function ensurePersonalWorkspace(userId: string) {
  try {
    return await getPrisma().workspace.upsert({
      where: { id: `personal:${userId}` },
      update: {},
      create: {
        id: `personal:${userId}`,
        name: "Meu workspace",
        members: { create: { userId, role: "owner" } },
        usage: { create: { resource: "members", count: 1 } },
      },
    });
  } catch (error) {
    // Nested upserts can race when the layout and API bootstrap concurrently.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await getPrisma().workspace.findUnique({
        where: { id: `personal:${userId}` },
      });
      if (existing) return existing;
    }
    throw error;
  }
}
export async function actorFor(
  userId: string,
  headers: Headers,
): Promise<Actor> {
  const cookie = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("untrack.workspace="))
    ?.slice("untrack.workspace=".length);
  let selectedId: string | undefined;
  try {
    selectedId = cookie ? decodeURIComponent(cookie) : undefined;
  } catch {
    throw new ApiError(
      400,
      "INVALID_WORKSPACE",
      "Seleção de workspace inválida.",
    );
  }
  // Do not disguise DB/schema failures as a bad workspace cookie.
  const workspaceId = selectedId ?? (await ensurePersonalWorkspace(userId)).id;
  const member = await getPrisma().workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member)
    throw new ApiError(
      403,
      "WORKSPACE_FORBIDDEN",
      "Você não participa deste workspace. Selecione outro workspace.",
    );
  return { userId, workspaceId, role: member.role };
}
export async function requireActor(request: Request) {
  const user = await requireUser(request);
  return actorFor(user.id, request.headers);
}

export async function workspaceTransaction<T>(
  actor: Actor,
  permission: Permission,
  work: (
    tx: Prisma.TransactionClient,
    access: AccountAccess,
  ) => Promise<T>,
): Promise<T> {
  return getPrisma().$transaction(
    async (tx) => {
      // Serialize resource, quota and membership changes for this workspace only.
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${actor.workspaceId} FOR UPDATE`;
      const member = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          },
        },
      });
      if (!member)
        throw new ApiError(
          403,
          "WORKSPACE_FORBIDDEN",
          "Associação ao workspace não encontrada.",
        );
      assertPermission(member.role, permission);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId} FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: {
          plan: true,
          trial: {
            select: {
              status: true,
              startedAt: true,
              expiresAt: true,
              usedAt: true,
              cancelledAt: true,
            },
          },
        },
      });
      return work(tx, getAccountAccess(account));
    },
    { maxWait: 15000, timeout: 15000 },
  );
}
export async function reserveQuota(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  access: Pick<AccountAccess, "effectivePlan">,
  resource: Resource,
  quantity = 1,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error("Invalid quota quantity");
  const plan = access.effectivePlan;
  await tx.workspaceUsage.upsert({
    where: { workspaceId_resource: { workspaceId, resource } },
    update: {},
    create: { workspaceId, resource, count: 0 },
  });
  const updated = await tx.workspaceUsage.updateMany({
    where: {
      workspaceId,
      resource,
      count: { lte: PLAN_LIMITS[plan][resource] - quantity },
    },
    data: { count: { increment: quantity } },
  });
  if (!updated.count)
    throw new ApiError(
      409,
      "QUOTA_EXCEEDED",
      `Cota de ${resource} atingida no plano ${plan}. Os ativos existentes continuam funcionando.`,
    );
}
export async function releaseQuota(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  resource: Resource,
  quantity = 1,
) {
  await tx.workspaceUsage.updateMany({
    where: { workspaceId, resource, count: { gte: quantity } },
    data: { count: { decrement: quantity } },
  });
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entityId: string,
  details: unknown = {},
) {
  await tx.auditLog.create({
    data: {
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action,
      entityId,
      details: JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue,
    },
  });
}
export async function assertReferences(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  refs: {
    clientId?: string | null;
    campaignId?: string | null;
    folderId?: string | null;
  },
) {
  for (const [kind, id] of Object.entries(refs)) {
    if (!id) continue;
    const found =
      kind === "clientId"
        ? await tx.client.findFirst({ where: { id, workspaceId } })
        : kind === "campaignId"
          ? await tx.campaign.findFirst({ where: { id, workspaceId } })
          : await tx.linkFolder.findFirst({ where: { id, workspaceId } });
    if (!found)
      throw new ApiError(
        404,
        "REFERENCE_NOT_FOUND",
        "Cliente, campanha ou pasta não pertence ao workspace.",
      );
  }
  if (refs.clientId && refs.campaignId) {
    const campaign = await tx.campaign.findFirst({
      where: { id: refs.campaignId, workspaceId },
    });
    if (campaign?.clientId && campaign.clientId !== refs.clientId)
      throw new ApiError(
        400,
        "CLIENT_CAMPAIGN_MISMATCH",
        "A campanha pertence a outro cliente.",
      );
  }
}
