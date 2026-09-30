import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { ApiError, errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { actorFor, ensurePersonalWorkspace } from "@/modules/workspaces/context";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await ensurePersonalWorkspace(user.id);
    const items = await getPrisma().workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { id: true, name: true, plan: true } } }, orderBy: { createdAt: "asc" } });
    let activeId: string | null = null;
    try { activeId = (await actorFor(user.id, request.headers)).workspaceId; } catch { /* Removed membership: allow selecting a remaining workspace. */ }
    return NextResponse.json({ items, activeId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `workspaces:${user.id}`);
    const input = z.discriminatedUnion("action", [z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(120) }).strict(), z.object({ action: z.literal("select"), workspaceId: z.string().min(1) }).strict()]).parse(await readJson(request));
    let workspaceId: string;
    if (input.action === "select") {
      if (!await getPrisma().workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: user.id } } })) throw new ApiError(403, "WORKSPACE_FORBIDDEN", "Você não participa desse workspace.");
      workspaceId = input.workspaceId;
    } else {
      workspaceId = randomUUID();
      await getPrisma().$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        if (await tx.workspaceMember.count({ where: { userId: user.id, role: "owner" } }) >= 10) throw new ApiError(409, "WORKSPACE_LIMIT", "Limite de 10 workspaces próprios atingido.");
        await tx.workspace.create({ data: { id: workspaceId, name: input.name, members: { create: { userId: user.id, role: "owner" } }, usage: { create: { resource: "members", count: 1 } }, audits: { create: { actorId: user.id, action: "workspace.created", entityId: workspaceId, details: { name: input.name } } } } });
      });
    }
    const response = NextResponse.json({ workspaceId }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set("untrack.workspace", workspaceId, { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) { return errorResponse(error); }
}
