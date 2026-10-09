import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { workspaceTransaction, type Actor } from "@/modules/workspaces/context";
import type { Permission } from "@/modules/workspaces/policy";

export function connectWorkspace<T>(
  actor: Actor,
  permission: Permission,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return workspaceTransaction(actor, permission, async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.workspace_id', ${actor.workspaceId}, true)`;
    return work(tx);
  });
}

/** Server-only boundary for credential resolution and the authenticated queue worker. */
export function connectSystem<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.connect_worker', 'on', true)`;
      return work(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
