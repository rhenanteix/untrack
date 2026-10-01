import { ApiError } from "@/lib/api-response";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  audit,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  createProjectSchema,
  bulkProjectActionSchema,
  projectSlug,
  type ProjectListQuery,
  updateProjectSchema,
} from "./schemas";

async function availableSlug(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  name: string,
) {
  const base = projectSlug(name);
  for (let suffix = 1; suffix <= 10000; suffix++) {
    const candidate =
      suffix === 1 ? base : `${base.slice(0, 134)}-${suffix.toString()}`;
    const existing = await tx.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: candidate } },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new ApiError(
    409,
    "PROJECT_SLUG_UNAVAILABLE",
    "Não foi possível reservar um endereço para este projeto.",
  );
}

export async function listProjects(actor: Actor, query: ProjectListQuery) {
  const items = await getPrisma().project.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(query.status === "all" ? {} : { status: query.status }),
      ...(query.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (query.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { _count: { select: { resources: true } } },
  });
  return {
    items: items.slice(0, PAGE_SIZE),
    page: query.page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getProject(actor: Actor, id: string) {
  const project = await getPrisma().project.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: { _count: { select: { resources: true } } },
  });
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
  return project;
}

export async function createProject(actor: Actor, raw: unknown) {
  const input = createProjectSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    const slug = await availableSlug(tx, actor.workspaceId, input.name);
    await reserveQuota(tx, actor.workspaceId, plan, "projects");
    const project = await tx.project.create({
      data: { ...input, slug, workspaceId: actor.workspaceId },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "project.created", project.id, {
      name: project.name,
      slug: project.slug,
    });
    return project;
  });
}

export async function updateProject(actor: Actor, id: string, raw: unknown) {
  const input = updateProjectSchema.parse(raw);
  if (!Object.keys(input).length)
    throw new ApiError(
      400,
      "PROJECT_UPDATE_EMPTY",
      "Informe ao menos um campo para atualizar.",
    );
  return workspaceTransaction(actor, "write", async (tx) => {
    const previous = await tx.project.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!previous)
      throw new ApiError(
        404,
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado.",
      );
    const project = await tx.project.update({
      where: { id },
      data: input,
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "project.updated", id, {
      before: {
        name: previous.name,
        description: previous.description,
        icon: previous.icon,
        color: previous.color,
      },
      after: input,
    });
    return project;
  });
}

async function projectResourceCounts(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const counts = await tx.projectResource.groupBy({
    by: ["resourceType"],
    where: { projectId },
    _count: { _all: true },
  });
  return Object.fromEntries(
    counts.map((item) => [item.resourceType, item._count._all]),
  );
}

export async function archiveProject(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const project = await tx.project.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!project)
      throw new ApiError(
        404,
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado.",
      );
    const resourceCounts = await projectResourceCounts(tx, id);
    if (project.status === "archived") return { project, resourceCounts };
    const archived = await tx.project.update({
      where: { id },
      data: { status: "archived", archivedAt: new Date() },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "project.archived", id, { resourceCounts });
    return { project: archived, resourceCounts };
  });
}

export async function restoreProject(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const project = await tx.project.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!project)
      throw new ApiError(
        404,
        "PROJECT_NOT_FOUND",
        "Projeto não encontrado.",
      );
    if (project.status === "active") return project;
    const restored = await tx.project.update({
      where: { id },
      data: { status: "active", archivedAt: null },
      include: { _count: { select: { resources: true } } },
    });
    await audit(tx, actor, "project.restored", id);
    return restored;
  });
}

export async function changeProjectsStatusBulk(actor: Actor, raw: unknown) {
  const input = bulkProjectActionSchema.parse(raw);
  const ids = [...new Set(input.ids)];
  return workspaceTransaction(actor, "write", async (tx) => {
    const projects = await tx.project.findMany({
      where: { id: { in: ids }, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (projects.length !== ids.length)
      throw new ApiError(404, "PROJECT_NOT_FOUND", "Um dos projetos não pertence a este workspace.");
    const archive = input.action === "archive";
    await tx.project.updateMany({
      where: { id: { in: ids }, workspaceId: actor.workspaceId },
      data: {
        status: archive ? "archived" : "active",
        archivedAt: archive ? new Date() : null,
      },
    });
    await audit(tx, actor, archive ? "project.bulkArchived" : "project.bulkRestored", actor.workspaceId, {
      projectIds: ids,
    });
    return { count: ids.length, action: input.action };
  });
}