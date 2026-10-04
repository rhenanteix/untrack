import { ApiError } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";
import {
  audit,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  createCollectionSchema,
  createTagSchema,
  collectionRuleSchema,
  projectMemberSchema,
  projectResourceReferenceSchema,
  reorderCollectionSchema,
  resourceReferenceSchema,
  setResourceTagsSchema,
  stableSlug,
  updateCollectionSchema,
  updateTagSchema,
  type ResourceReference,
} from "./schemas";
import {
  requireWorkspaceResource,
  resourceOptions,
  workspaceResource,
  type ResourceSummary,
} from "./resources";

async function resourceList(
  actor: Actor,
  rows: ResourceReference[],
): Promise<ResourceSummary[]> {
  const db = getPrisma();
  const resources = await Promise.all(
    rows.map((row) =>
      workspaceResource(db, actor.workspaceId, row.resourceType, row.resourceId),
    ),
  );
  return resources.filter((resource): resource is ResourceSummary => !!resource);
}

export async function listTags(actor: Actor, search = "", archived = false) {
  return getPrisma().tag.findMany({
    where: {
      workspaceId: actor.workspaceId,
      archivedAt: archived ? { not: null } : null,
      ...(search
        ? { name: { contains: search.slice(0, 80), mode: "insensitive" } }
        : {}),
    },
    include: { _count: { select: { resources: true } } },
    orderBy: [{ name: "asc" }],
  });
}

export async function createTag(actor: Actor, raw: unknown) {
  const input = createTagSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const base = stableSlug(input.name);
    let slug = base;
    for (let suffix = 2; suffix <= 10000; suffix++) {
      const exists = await tx.tag.findUnique({
        where: { workspaceId_slug: { workspaceId: actor.workspaceId, slug } },
      });
      if (!exists) break;
      slug = `${base.slice(0, 94)}-${suffix}`;
      if (suffix === 10000)
        throw new ApiError(409, "TAG_EXISTS", "Esta tag já existe.");
    }
    const tag = await tx.tag.create({
      data: { ...input, slug, workspaceId: actor.workspaceId },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "tag.created", tag.id, { name: tag.name });
    return tag;
  });
}

export async function updateTag(actor: Actor, id: string, raw: unknown) {
  const input = updateTagSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const previous = await tx.tag.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!previous)
      throw new ApiError(404, "TAG_NOT_FOUND", "Tag não encontrada.");
    const tag = await tx.tag.update({
      where: { id },
      data: {
        name: input.name,
        color: input.color,
        archivedAt:
          input.archived === undefined
            ? undefined
            : input.archived
              ? new Date()
              : null,
      },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, input.archived ? "tag.archived" : "tag.updated", id, {
      before: { name: previous.name, archivedAt: previous.archivedAt },
      after: input,
    });
    return tag;
  });
}

export async function setResourceTags(
  actor: Actor,
  rawReference: unknown,
  raw: unknown,
) {
  const reference = resourceReferenceSchema.parse(rawReference);
  const input = setResourceTagsSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    await requireWorkspaceResource(
      tx,
      actor.workspaceId,
      reference.resourceType,
      reference.resourceId,
    );
    const tags = await tx.tag.findMany({
      where: {
        id: { in: input.tagIds },
        workspaceId: actor.workspaceId,
        archivedAt: null,
      },
    });
    if (tags.length !== new Set(input.tagIds).size)
      throw new ApiError(404, "TAG_NOT_FOUND", "Uma das tags não está ativa.");
    await tx.resourceTag.deleteMany({
      where: {
        workspaceId: actor.workspaceId,
        resourceType: reference.resourceType,
        resourceId: reference.resourceId,
      },
    });
    if (tags.length)
      await tx.resourceTag.createMany({
        data: tags.map((tag) => ({
          workspaceId: actor.workspaceId,
          tagId: tag.id,
          resourceType: reference.resourceType,
          resourceId: reference.resourceId,
        })),
      });
    await audit(tx, actor, "tag.applied", reference.resourceId, {
      resourceType: reference.resourceType,
      tagIds: tags.map((tag) => tag.id),
    });
    return tags;
  });
}

export async function toggleFavorite(actor: Actor, raw: unknown) {
  const reference = resourceReferenceSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    await requireWorkspaceResource(
      tx,
      actor.workspaceId,
      reference.resourceType,
      reference.resourceId,
    );
    const where = {
      workspaceId_userId_resourceType_resourceId: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        resourceType: reference.resourceType,
        resourceId: reference.resourceId,
      },
    };
    const existing = await tx.favorite.findUnique({ where });
    if (existing) {
      await tx.favorite.delete({ where });
      await audit(tx, actor, "favorite.removed", reference.resourceId, reference);
      return { favorite: false };
    }
    await tx.favorite.create({ data: { ...reference, workspaceId: actor.workspaceId, userId: actor.userId } });
    await audit(tx, actor, "favorite.added", reference.resourceId, reference);
    return { favorite: true };
  });
}

export async function listFavorites(actor: Actor) {
  const rows = await getPrisma().favorite.findMany({
    where: { workspaceId: actor.workspaceId, userId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return resourceList(actor, rows);
}

export async function recordRecent(actor: Actor, raw: unknown) {
  const reference = resourceReferenceSchema.parse(raw);
  return workspaceTransaction(actor, "read", async (tx) => {
    await requireWorkspaceResource(
      tx,
      actor.workspaceId,
      reference.resourceType,
      reference.resourceId,
    );
    return tx.recentResource.upsert({
      where: {
        workspaceId_userId_resourceType_resourceId: {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          resourceType: reference.resourceType,
          resourceId: reference.resourceId,
        },
      },
      update: { viewedAt: new Date() },
      create: { ...reference, workspaceId: actor.workspaceId, userId: actor.userId },
    });
  });
}

export async function listRecent(actor: Actor) {
  const rows = await getPrisma().recentResource.findMany({
    where: { workspaceId: actor.workspaceId, userId: actor.userId },
    orderBy: { viewedAt: "desc" },
    take: 12,
  });
  return resourceList(actor, rows);
}

async function collection(actor: Actor, id: string) {
  const value = await getPrisma().collection.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: { _count: { select: { resources: true } }, project: { select: { id: true, name: true } } },
  });
  if (!value)
    throw new ApiError(404, "COLLECTION_NOT_FOUND", "Collection não encontrada.");
  return value;
}

export async function listCollections(actor: Actor, projectId?: string | null) {
  return getPrisma().collection.findMany({
    where: { workspaceId: actor.workspaceId, ...(projectId ? { projectId } : {}) },
    include: { _count: { select: { resources: true } }, project: { select: { id: true, name: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function createCollection(actor: Actor, raw: unknown) {
  const input = createCollectionSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, access) => {
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, workspaceId: actor.workspaceId },
      });
      if (!project)
        throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    await reserveQuota(tx, actor.workspaceId, access, "collections");
    const value = await tx.collection.create({
      data: { ...input, workspaceId: actor.workspaceId },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "collection.created", value.id, {
      name: value.name,
      kind: value.kind,
      projectId: value.projectId,
    });
    return value;
  });
}

export async function updateCollection(actor: Actor, id: string, raw: unknown) {
  const input = updateCollectionSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const previous = await tx.collection.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!previous)
      throw new ApiError(404, "COLLECTION_NOT_FOUND", "Collection não encontrada.");
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: { id: input.projectId, workspaceId: actor.workspaceId },
      });
      if (!project)
        throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    }
    const value = await tx.collection.update({
      where: { id },
      data: input,
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "collection.updated", id, { before: previous.name, after: input });
    return value;
  });
}

export async function addCollectionResource(actor: Actor, id: string, raw: unknown) {
  const reference = resourceReferenceSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const value = await tx.collection.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!value)
      throw new ApiError(404, "COLLECTION_NOT_FOUND", "Collection não encontrada.");
    if (value.kind === "smart")
      throw new ApiError(409, "SMART_COLLECTION", "Collections inteligentes são definidas por regras.");
    await requireWorkspaceResource(tx, actor.workspaceId, reference.resourceType, reference.resourceId);
    const position = await tx.collectionResource.count({ where: { collectionId: id } });
    const item = await tx.collectionResource.create({
      data: { ...reference, workspaceId: actor.workspaceId, collectionId: id, position },
    });
    await audit(tx, actor, "collection.resourceAdded", item.id, { collectionId: id, ...reference });
    return item;
  });
}

export async function removeCollectionResource(actor: Actor, id: string, itemId: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const item = await tx.collectionResource.findFirst({
      where: { id: itemId, collectionId: id, workspaceId: actor.workspaceId },
    });
    if (!item)
      throw new ApiError(404, "COLLECTION_RESOURCE_NOT_FOUND", "Recurso não encontrado.");
    await tx.collectionResource.delete({ where: { id: itemId } });
    await tx.collectionResource.updateMany({
      where: { collectionId: id, position: { gt: item.position } },
      data: { position: { decrement: 1 } },
    });
    await audit(tx, actor, "collection.resourceRemoved", itemId, { collectionId: id });
    return { ok: true };
  });
}

export async function reorderCollectionResources(actor: Actor, id: string, raw: unknown) {
  const input = reorderCollectionSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const items = await tx.collectionResource.findMany({
      where: { collectionId: id, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (items.length !== input.ids.length || new Set(input.ids).size !== items.length)
      throw new ApiError(400, "INVALID_COLLECTION_ORDER", "A ordem dos recursos é inválida.");
    const allowed = new Set(items.map((item) => item.id));
    if (!input.ids.every((itemId) => allowed.has(itemId)))
      throw new ApiError(400, "INVALID_COLLECTION_ORDER", "A ordem dos recursos é inválida.");
    await tx.collectionResource.updateMany({
      where: { collectionId: id },
      data: { position: { increment: input.ids.length } },
    });
    await Promise.all(input.ids.map((itemId, position) => tx.collectionResource.update({ where: { id: itemId }, data: { position } })));
    await audit(tx, actor, "collection.resourcesReordered", id, { itemIds: input.ids });
    return { ok: true };
  });
}

export async function collectionResources(actor: Actor, id: string) {
  const value = await collection(actor, id);
  if (value.kind === "smart")
    return { collection: value, items: await smartCollectionResources(actor, value) };
  const rows = await getPrisma().collectionResource.findMany({
    where: { collectionId: id, workspaceId: actor.workspaceId },
    orderBy: { position: "asc" },
  });
  const resources = await Promise.all(
    rows.map(async (row) => {
      const resource = await workspaceResource(
        getPrisma(),
        actor.workspaceId,
        row.resourceType,
        row.resourceId,
      );
      return resource
        ? { ...resource, collectionResourceId: row.id, position: row.position }
        : null;
    }),
  );
  return {
    collection: value,
    items: resources.filter(
      (resource): resource is ResourceSummary & { collectionResourceId: string; position: number } => !!resource,
    ),
  };
}

async function smartCollectionResources(
  actor: Actor,
  value: { projectId: string | null; rules: unknown },
) {
  const rulesResult = z.array(collectionRuleSchema).safeParse(value.rules);
  const rules = rulesResult.success ? rulesResult.data : [];
  if (!rules.length) return [] as ResourceSummary[];

  const db = getPrisma();
  let resources = await workspaceResources(actor);
  if (value.projectId) {
    const projectResources = await db.projectResource.findMany({
      where: { workspaceId: actor.workspaceId, projectId: value.projectId },
      select: { resourceType: true, resourceId: true },
    });
    const allowed = new Set(
      projectResources.map((resource) => `${resource.resourceType}:${resource.resourceId}`),
    );
    resources = resources.filter((resource) =>
      allowed.has(`${resource.resourceType}:${resource.id}`),
    );
  }

  const tagRules = rules.filter((rule) => rule.field === "tag");
  const tagsByResource = new Map<string, string[]>();
  if (tagRules.length) {
    const rows = await db.resourceTag.findMany({
      where: { workspaceId: actor.workspaceId },
      include: { tag: { select: { name: true } } },
    });
    for (const row of rows) {
      const key = `${row.resourceType}:${row.resourceId}`;
      tagsByResource.set(key, [...(tagsByResource.get(key) ?? []), row.tag.name]);
    }
  }

  return resources.filter((resource) =>
    rules.every((rule) => {
      const candidate =
        rule.field === "resourceType"
          ? resource.resourceType
          : rule.field === "name"
            ? resource.name
            : rule.field === "tag"
              ? (tagsByResource.get(`${resource.resourceType}:${resource.id}`) ?? []).join(" ")
              : "";
      const source = candidate.toLocaleLowerCase();
      const expected = rule.value.toLocaleLowerCase();
      return rule.operator === "equals" ? source === expected : source.includes(expected);
    }),
  );
}

export async function listProjectMembers(actor: Actor, projectId: string) {
  await collectionProject(actor, projectId);
  return getPrisma().projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

async function collectionProject(actor: Actor, projectId: string) {
  const project = await getPrisma().project.findFirst({
    where: { id: projectId, workspaceId: actor.workspaceId },
  });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
  return project;
}

export async function setProjectMember(actor: Actor, projectId: string, raw: unknown) {
  const input = projectMemberSchema.parse(raw);
  return workspaceTransaction(actor, "manage", async (tx) => {
    const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId } });
    if (!project)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    const member = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId: input.userId } },
    });
    if (!member)
      throw new ApiError(404, "MEMBER_NOT_FOUND", "A pessoa não pertence ao workspace.");
    const projectMember = await tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: input.userId } },
      update: { role: input.role },
      create: { projectId, userId: input.userId, role: input.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await audit(tx, actor, "project.memberSet", input.userId, { projectId, role: input.role });
    return projectMember;
  });
}

export async function removeProjectMember(actor: Actor, projectId: string, userId: string) {
  return workspaceTransaction(actor, "manage", async (tx) => {
    const project = await tx.project.findFirst({ where: { id: projectId, workspaceId: actor.workspaceId } });
    if (!project)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
    const deleted = await tx.projectMember.deleteMany({ where: { projectId, userId } });
    if (!deleted.count)
      throw new ApiError(404, "PROJECT_MEMBER_NOT_FOUND", "Pessoa não está neste projeto.");
    await audit(tx, actor, "project.memberRemoved", userId, { projectId });
    return { ok: true };
  });
}

export async function workspaceResources(actor: Actor) {
  return resourceOptions(getPrisma(), actor.workspaceId);
}

export async function projectResources(actor: Actor, projectId: string) {
  await collectionProject(actor, projectId);
  const rows = await getPrisma().projectResource.findMany({
    where: { projectId, workspaceId: actor.workspaceId },
    orderBy: { createdAt: "asc" },
  });
  return resourceList(actor, rows);
}

export async function addProjectResource(actor: Actor, projectId: string, raw: unknown) {
  const reference = projectResourceReferenceSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, workspaceId: actor.workspaceId, status: "active" },
    });
    if (!project)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto ativo não encontrado.");
    await requireWorkspaceResource(tx, actor.workspaceId, reference.resourceType, reference.resourceId);
    const resource = await tx.projectResource.upsert({
      where: {
        projectId_resourceType_resourceId: {
          projectId,
          resourceType: reference.resourceType,
          resourceId: reference.resourceId,
        },
      },
      update: {},
      create: { ...reference, workspaceId: actor.workspaceId, projectId },
    });
    await audit(tx, actor, "resource.addedToProject", resource.id, { projectId, ...reference });
    return resource;
  });
}

export async function removeProjectResource(
  actor: Actor,
  projectId: string,
  raw: unknown,
) {
  const reference = projectResourceReferenceSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const deleted = await tx.projectResource.deleteMany({
      where: { projectId, workspaceId: actor.workspaceId, ...reference },
    });
    if (!deleted.count)
      throw new ApiError(404, "PROJECT_RESOURCE_NOT_FOUND", "Recurso não está neste projeto.");
    await audit(tx, actor, "resource.removedFromProject", reference.resourceId, {
      projectId,
      ...reference,
    });
    return { ok: true };
  });
}

export async function resourceTags(actor: Actor, raw: unknown) {
  const reference = resourceReferenceSchema.parse(raw);
  await requireWorkspaceResource(
    getPrisma(),
    actor.workspaceId,
    reference.resourceType,
    reference.resourceId,
  );
  return getPrisma().tag.findMany({
    where: {
      workspaceId: actor.workspaceId,
      archivedAt: null,
      resources: {
        some: {
          resourceType: reference.resourceType,
          resourceId: reference.resourceId,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function searchWorkspace(actor: Actor, query: string) {
  const value = query.trim().slice(0, 120);
  if (!value) return [];
  const db = getPrisma();
  const contains = { contains: value, mode: "insensitive" as const };
  const [projects, links, pages, campaigns, utms, qrs, tags, collections] = await Promise.all([
    db.project.findMany({ where: { workspaceId: actor.workspaceId, name: contains }, take: 6, orderBy: { updatedAt: "desc" } }),
    db.shortLink.findMany({ where: { workspaceId: actor.workspaceId, OR: [{ title: contains }, { slug: contains }, { destinationUrl: contains }] }, take: 6, orderBy: { updatedAt: "desc" } }),
    db.smartPage.findMany({ where: { workspaceId: actor.workspaceId, OR: [{ title: contains }, { slug: contains }] }, take: 6, orderBy: { updatedAt: "desc" } }),
    db.campaign.findMany({ where: { workspaceId: actor.workspaceId, name: contains }, take: 6, orderBy: { updatedAt: "desc" } }),
    db.utmLink.findMany({ where: { workspaceId: actor.workspaceId, OR: [{ name: contains }, { resultUrl: contains }] }, take: 6, orderBy: { createdAt: "desc" } }),
    db.qrAsset.findMany({ where: { workspaceId: actor.workspaceId, OR: [{ name: contains }, { destinationUrl: contains }] }, take: 6, orderBy: { createdAt: "desc" } }),
    db.tag.findMany({ where: { workspaceId: actor.workspaceId, name: contains, archivedAt: null }, take: 6, orderBy: { name: "asc" } }),
    db.collection.findMany({ where: { workspaceId: actor.workspaceId, name: contains }, take: 6, orderBy: { updatedAt: "desc" } }),
  ]);
  return [
    ...projects.map((item) => ({ resourceType: "project" as const, id: item.id, name: item.name, href: `/untrack/projects/${item.id}` })),
    ...links.map((item) => ({ resourceType: "shortLink" as const, id: item.id, name: item.title || item.slug, href: `/conta/links/${item.id}` })),
    ...pages.map((item) => ({ resourceType: "smartPage" as const, id: item.id, name: item.title, href: `/untrack/smart-pages?edit=${item.id}` })),
    ...campaigns.map((item) => ({ resourceType: "campaign" as const, id: item.id, name: item.name, href: `/untrack/campaigns/${item.id}` })),
    ...utms.map((item) => ({ resourceType: "utmLink" as const, id: item.id, name: item.name, href: "/untrack/utm" })),
    ...qrs.map((item) => ({ resourceType: "qrAsset" as const, id: item.id, name: item.name, href: "/untrack/qr" })),
    ...tags.map((item) => ({ resourceType: "tag" as const, id: item.id, name: item.name, href: "/untrack/tags" })),
    ...collections.map((item) => ({ resourceType: "collection" as const, id: item.id, name: item.name, href: `/untrack/collections?open=${item.id}` })),
  ];
}