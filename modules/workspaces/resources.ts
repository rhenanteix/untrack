import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
import { audit, assertReferences, releaseQuota, reserveQuota, workspaceTransaction, type Actor } from "./context";
import { assertPermission, PLAN_LIMITS, type Resource } from "./policy";
import { builderSchema, buildGovernedUrl, governanceConflicts, governanceSchema } from "@/modules/untrack-utm/engine";
const nameSchema = z.string().trim().min(1).max(120);
const idSchema = z.string().min(1).max(200);
const memberSchema = z.object({ email: z.email().toLowerCase(), role: z.enum(["owner", "admin", "editor", "viewer"]) }).strict();
export async function listResources(actor: Actor, module: string, search: string, page: number) {
  const db = getPrisma(), workspaceId = actor.workspaceId;
  const where = { workspaceId };
  const nameFilter = search ? { contains: search.slice(0, 120), mode: "insensitive" as const } : undefined;
  const paging = { skip: (page - 1) * 30, take: 31 };
  let items: unknown[];
  switch (module) {
    case "clients": items = await db.client.findMany({ where: { ...where, name: nameFilter }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "campaigns": items = await db.campaign.findMany({ where: { ...where, name: nameFilter }, include: { client: true }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "members": items = await db.workspaceMember.findMany({ where, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" }, ...paging }); break;
    case "templates": items = await db.utmTemplate.findMany({ where: { ...where, name: nameFilter }, orderBy: [{ favorite: "desc" }, { createdAt: "desc" }], ...paging }); break;
    case "utm": items = await db.utmLink.findMany({ where: { ...where, ...(search ? { OR: [{ name: nameFilter }, { resultUrl: nameFilter }] } : {}) }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "links": items = await db.shortLink.findMany({ where: { ...where, distribution: "digital", ...(search ? { OR: [{ title: nameFilter }, { slug: nameFilter }, { destinationUrl: nameFilter }, { tags: { has: search } }, { folder: { name: nameFilter } }] } : {}) }, include: { _count: { select: { clicks: true } }, folder: true }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "folders": items = await db.linkFolder.findMany({ where, orderBy: { name: "asc" }, ...paging }); break;
    case "qrs": items = await db.qrAsset.findMany({ where: { ...where, name: nameFilter }, include: { redirect: { select: { isActive: true, expiresAt: true, _count: { select: { clicks: true } } } } }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "domains": assertPermission(actor.role, "manage"); items = await db.customDomain.findMany({ where, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "audit": assertPermission(actor.role, "manage"); items = await db.auditLog.findMany({ where: { ...where, ...(search ? { entityId: search } : {}) }, orderBy: { createdAt: "desc" }, ...paging }); break;
    case "governance": return { governance: (await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).governance };
    case "usage": { const [workspace, access] = await Promise.all([db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { usage: true } }), getAccountAccessForUser(actor.userId)]); return { plan: access.effectivePlan, limits: PLAN_LIMITS[access.effectivePlan], usage: workspace.usage, downgradePolicy: "Ativos existentes e redirects continuam funcionando. Novas criações acima da cota ou recursos não incluídos ficam bloqueados; edições e exclusões continuam disponíveis." }; }
    default: throw new ApiError(404, "MODULE_NOT_FOUND", "Módulo não encontrado.");
  }
  return { items: items.slice(0, 30), page, hasMore: items.length > 30 };
}
export async function mutateResource(actor: Actor, module: string, raw: unknown, method: "POST" | "PATCH" | "DELETE") {
  const envelope = z.object({ id: idSchema.optional(), data: z.unknown().optional() }).strict().parse(raw);
  const id = method !== "POST" ? idSchema.parse(envelope.id) : undefined;
  return workspaceTransaction(actor, ["members", "governance"].includes(module) ? "manage" : "write", async (tx, access) => {
    const workspaceId = actor.workspaceId;
    if (module === "members") {
      const current = await tx.workspaceMember.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId: actor.userId } } });
      if (method === "POST") {
        const input = memberSchema.parse(envelope.data);
        if (input.role === "owner" || input.role === "admin") assertPermission(current.role, "owner");
        const user = await tx.user.findUnique({ where: { email: input.email } });
        if (!user) throw new ApiError(404, "USER_NOT_FOUND", "A pessoa precisa criar uma conta antes de ser adicionada.");
        if (await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } })) throw new ApiError(409, "ALREADY_MEMBER", "Usuário já é membro.");
        await reserveQuota(tx, workspaceId, access, "members");
        const member = await tx.workspaceMember.create({ data: { workspaceId, userId: user.id, role: input.role } });
        await audit(tx, actor, "member.added", user.id, { role: input.role }); return member;
      }
      const member = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: id! } } });
      if (!member) throw new ApiError(404, "MEMBER_NOT_FOUND", "Membro não encontrado.");
      const role = method === "PATCH" ? z.object({ role: memberSchema.shape.role }).strict().parse(envelope.data).role : null;
      if (["owner", "admin"].includes(member.role) || role === "owner" || role === "admin") assertPermission(current.role, "owner");
      if (member.role === "owner" && role !== "owner" && await tx.workspaceMember.count({ where: { workspaceId, role: "owner" } }) <= 1) throw new ApiError(409, "LAST_OWNER", "O workspace precisa manter ao menos um owner.");
      if (method === "DELETE") { await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: id! } } }); await releaseQuota(tx, workspaceId, "members"); }
      else await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: id! } }, data: { role: role! } });
      await audit(tx, actor, `member.${method === "DELETE" ? "removed" : "roleChanged"}`, id!, { before: member.role, after: role }); return { ok: true };
    }
    if (module === "governance") {
      if (method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Use POST para salvar governança.");
      const rules = governanceSchema.parse(envelope.data), conflicts = governanceConflicts(rules);
      if (conflicts.length) throw new ApiError(422, "CONFLICTING_RULES", conflicts.join(" "));
      const before = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      await tx.workspace.update({ where: { id: workspaceId }, data: { governance: rules } });
      await audit(tx, actor, "governance.updated", workspaceId, { before: before.governance, after: rules }); return { governance: rules };
    }
    if (module === "templates") {
      const before = id ? await tx.utmTemplate.findFirst({ where: { id, workspaceId } }) : null;
      if (id && !before) throw new ApiError(404, "NOT_FOUND", "Template não encontrado.");
      if (method === "DELETE") { await tx.utmTemplate.delete({ where: { id } }); await releaseQuota(tx, workspaceId, "templates"); await audit(tx, actor, "template.deleted", id!); return { ok: true }; }
      const input = z.object({ name: nameSchema, values: builderSchema, favorite: z.boolean().default(false) }).strict().parse(envelope.data);
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      const result = buildGovernedUrl(input.values, workspace.governance);
      if (result.errors.length) throw new ApiError(422, "GOVERNANCE_ERROR", result.errors.map((e) => `${e.field}: ${e.message}`).join(" "));
      if (!id) await reserveQuota(tx, workspaceId, access, "templates");
      const saved = id ? await tx.utmTemplate.update({ where: { id }, data: input }) : await tx.utmTemplate.create({ data: { ...input, workspaceId } });
      await audit(tx, actor, `template.${id ? "updated" : "created"}`, saved.id, { before, after: input }); return { template: saved, warnings: result.warnings, corrections: result.corrections };
    }
    if (!["clients", "campaigns", "folders"].includes(module)) throw new ApiError(404, "MODULE_NOT_FOUND", "Operação não disponível.");
    const before = id ? module === "clients" ? await tx.client.findFirst({ where: { id, workspaceId } }) : module === "campaigns" ? await tx.campaign.findFirst({ where: { id, workspaceId } }) : await tx.linkFolder.findFirst({ where: { id, workspaceId } }) : null;
    if (id && !before) throw new ApiError(404, "NOT_FOUND", "Registro não encontrado.");
    const resource = module === "folders" ? null : module as Resource;
    if (method === "DELETE") {
      if (module === "clients") await tx.client.delete({ where: { id } }); else if (module === "campaigns") await tx.campaign.delete({ where: { id } }); else await tx.linkFolder.delete({ where: { id } });
      if (resource) await releaseQuota(tx, workspaceId, resource);
      await audit(tx, actor, `${module}.deleted`, id!, before); return { ok: true };
    }
    const isCampaign = module === "campaigns";
    const input = isCampaign ? z.object({ name: nameSchema, description: z.string().max(2000).optional(), objective: z.string().max(1000).optional(), clientId: z.string().nullable().optional(), responsibleId: z.string().nullable().optional(), status: z.enum(["draft", "scheduled", "active", "paused", "completed"]).default("draft") }).strict().parse(envelope.data) : z.object({ name: nameSchema }).strict().parse(envelope.data);
    if (isCampaign && "clientId" in input) await assertReferences(tx, workspaceId, { clientId: typeof (input as { clientId?: string | null }).clientId === "string" ? (input as { clientId?: string | null }).clientId! : null });
    if (!id && resource) await reserveQuota(tx, workspaceId, access, resource);
    const base = { ...input, workspaceId } as { name: string; workspaceId: string };
    const data = isCampaign ? { ...base, description: (input as { description?: string }).description ?? "", objective: (input as { objective?: string }).objective ?? "" } : base;
    const saved = module === "clients" ? id ? await tx.client.update({ where: { id }, data }) : await tx.client.create({ data }) : module === "campaigns" ? id ? await tx.campaign.update({ where: { id }, data }) : await tx.campaign.create({ data }) : id ? await tx.linkFolder.update({ where: { id }, data }) : await tx.linkFolder.create({ data });
    await audit(tx, actor, `${module}.${id ? "updated" : "created"}`, saved.id, { before, after: input }); return saved;
  });
}
