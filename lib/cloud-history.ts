import { sessionFromHeaders } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/request-origin";
import { actorFor, audit, reserveQuota, workspaceTransaction } from "@/modules/workspaces/context";
export async function saveCloudHistory(request: Request, originalUrl: string, resultUrl: string, kind: "clean" | "utm" | "qr") {
  const session = await sessionFromHeaders(request.headers);
  if (!session) return false;
  enforceSameOrigin(request);
  const actor = await actorFor(session.user.id, request.headers);
  if (actor.role === "viewer") return false;
  await workspaceTransaction(actor, "write", async (tx, plan) => {
    await reserveQuota(tx, actor.workspaceId, plan, "history");
    const history = await tx.linkHistory.create({ data: { userId: actor.userId, workspaceId: actor.workspaceId, originalUrl, resultUrl, kind } });
    await audit(tx, actor, "history.created", history.id, { kind });
  });
  return true;
}
