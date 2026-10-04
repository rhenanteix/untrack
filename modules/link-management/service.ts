import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { track } from "@/lib/analytics";
import { getPrisma } from "@/lib/prisma";
import { assertReferences, audit, releaseQuota, reserveQuota, workspaceTransaction, type Actor } from "@/modules/workspaces/context";
import { managedLinkSchema, managedUpdateSchema } from "./schemas";
import { invalidateLinkCache } from "./cache";
export async function createManagedLink(actor: Actor, raw: unknown) {
  const input = managedLinkSchema.parse(raw);
  if (new URL(input.url).origin === appUrl().origin && /^\/(s|l|q)\//.test(new URL(input.url).pathname)) throw new ApiError(400, "NESTED_SHORT_LINK", "Use o destino original, não outro redirect da aplicação.");
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) throw new ApiError(400, "INVALID_EXPIRATION", "A expiração deve estar no futuro.");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const link = await workspaceTransaction(actor, "write", async (tx, access) => {
        await assertReferences(tx, actor.workspaceId, { folderId: input.folderId, campaignId: input.campaignId });
        const domain = input.domainId ? await tx.customDomain.findFirst({ where: { id: input.domainId, workspaceId: actor.workspaceId, status: "active" } }) : null;
        if (input.domainId && !domain) throw new ApiError(422, "DOMAIN_NOT_ACTIVE", "Domínio não está ativo neste workspace.");
        await reserveQuota(tx, actor.workspaceId, access, "shortLinks");
        const link = await tx.shortLink.create({ data: { userId: actor.userId, workspaceId: actor.workspaceId, slug: input.slug ?? randomBytes(8).toString("base64url").slice(0, 10), domainKey: domain?.hostname ?? "platform", destinationUrl: input.url, title: input.title, description: input.description, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, tags: input.tags, folderId: input.folderId, campaignId: input.campaignId } });
        await audit(tx, actor, "shortLink.created", link.id, { destinationUrl: link.destinationUrl, slug: link.slug });
        return link;
      });
      await track("link_created", { workspaceId: actor.workspaceId });
      return link;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      if (input.slug) throw new ApiError(409, "SLUG_EXISTS", "Este slug já existe nesse domínio.");
    }
  }
  throw new ApiError(409, "SLUG_COLLISION", "Não foi possível gerar um slug. Tente novamente.");
}
export async function updateManagedLink(actor: Actor, id: string, raw: unknown) {
  const input = managedUpdateSchema.parse(raw);
  const result = await workspaceTransaction(actor, "write", async (tx) => {
    const before = await tx.shortLink.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!before) throw new ApiError(404, "LINK_NOT_FOUND", "Link não encontrado.");
    await assertReferences(tx, actor.workspaceId, { folderId: input.folderId, campaignId: input.campaignId });
    if (input.destinationUrl && new URL(input.destinationUrl).origin === appUrl().origin && /^\/(s|l|q)\//.test(new URL(input.destinationUrl).pathname)) throw new ApiError(400, "NESTED_SHORT_LINK", "Use o destino original.");
    const link = await tx.shortLink.update({ where: { id }, data: { ...input, expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt === null ? null : new Date(input.expiresAt) } });
    if (input.destinationUrl && before.distribution === "qr") await tx.qrAsset.updateMany({ where: { redirectId: id, workspaceId: actor.workspaceId }, data: { destinationUrl: input.destinationUrl } });
    await audit(tx, actor, "shortLink.updated", id, { before: { destinationUrl: before.destinationUrl, isActive: before.isActive, expiresAt: before.expiresAt, tags: before.tags, folderId: before.folderId }, after: input });
    return link;
  });
  await invalidateLinkCache(result.domainKey, result.slug);
  return result;
}
export async function deleteManagedLink(actor: Actor, id: string) {
  const link = await workspaceTransaction(actor, "write", async (tx) => {
    const link = await tx.shortLink.findFirst({ where: { id, workspaceId: actor.workspaceId }, include: { qr: true } });
    if (!link) throw new ApiError(404, "LINK_NOT_FOUND", "Link não encontrado.");
    if (link.qr) throw new ApiError(409, "QR_DISTRIBUTION", "Exclua o QR dinâmico associado antes de remover sua distribuição.");
    await tx.shortLink.delete({ where: { id } });
    await releaseQuota(tx, actor.workspaceId, "shortLinks");
    await audit(tx, actor, "shortLink.deleted", id, { slug: link.slug });
    return link;
  });
  await invalidateLinkCache(link.domainKey, link.slug);
}
export async function workspaceLink(actor: Actor, id: string) {
  const link = await getPrisma().shortLink.findFirst({ where: { id, workspaceId: actor.workspaceId }, include: { _count: { select: { clicks: true } } } });
  if (!link) throw new ApiError(404, "LINK_NOT_FOUND", "Link não encontrado.");
  return link;
}
