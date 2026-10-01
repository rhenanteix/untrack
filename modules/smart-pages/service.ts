import { requireSmartPages } from "@/modules/billing/plans";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import {
  audit,
  releaseQuota,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  smartPageBlockInputSchema,
  smartPageInputSchema,
  smartPageUpdateSchema,
  linkBlockSettingsSchema,
  socialLinksSchema,
  type SmartPageBlockInput,
} from "./schemas";

const publicBlockInclude = {
  link: {
    select: {
      slug: true,
      domainKey: true,
      isActive: true,
      expiresAt: true,
    },
  },
} as const;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function onboardingSocialLinks(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return socialLinksSchema.safeParse(
    (value as Record<string, unknown>).socialLinks,
  ).data ?? [];
}

function slugConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "SLUG_EXISTS",
      "Este endereço já está em uso. Escolha outro para sua página.",
    );
  }
  throw error;
}

async function workspacePage(actor: Actor, id: string) {
  const page = await getPrisma().smartPage.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: {
      blocks: { orderBy: { position: "asc" }, include: publicBlockInclude },
    },
  });
  if (!page) {
    throw new ApiError(
      404,
      "SMART_PAGE_NOT_FOUND",
      "Smart Page não encontrada.",
    );
  }
  return page;
}

export async function listSmartPages(actor: Actor, page: number, search = "") {
  const items = await getPrisma().smartPage.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(search.trim()
        ? {
            OR: [
              {
                title: {
                  contains: search.trim().slice(0, 120),
                  mode: "insensitive" as const,
                },
              },
              {
                slug: {
                  contains: search.trim().slice(0, 120),
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { _count: { select: { blocks: true } } },
  });
  return {
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getSmartPage(actor: Actor, id: string) {
  return workspacePage(actor, id);
}

export async function createSmartPage(actor: Actor, raw: unknown) {
  const input = smartPageInputSchema.parse(raw);
  const user = await getPrisma().user.findUnique({
    where: { id: actor.userId },
    select: { onboarding: true },
  });
  const socialLinks =
    input.socialLinks.length > 0
      ? input.socialLinks
      : onboardingSocialLinks(user?.onboarding);
  try {
    const page = await workspaceTransaction(
      actor,
      "write",
      async (tx, plan) => {
        requireSmartPages(plan);
        await reserveQuota(tx, actor.workspaceId, plan, "smartPages");
        const page = await tx.smartPage.create({
          data: { ...input, socialLinks, workspaceId: actor.workspaceId },
        });
        await audit(tx, actor, "smartPage.created", page.id, {
          slug: page.slug,
        });
        return page;
      },
    );
    await track("smart_page_created", { workspaceId: actor.workspaceId });
    return page;
  } catch (error) {
    return slugConflict(error);
  }
}

export async function updateSmartPage(actor: Actor, id: string, raw: unknown) {
  const input = smartPageUpdateSchema.parse(raw);
  try {
    const page = await workspaceTransaction(
      actor,
      "write",
      async (tx, plan) => {
        requireSmartPages(plan);
        const existing = await tx.smartPage.findFirst({
          where: { id, workspaceId: actor.workspaceId },
        });
        if (!existing) {
          throw new ApiError(
            404,
            "SMART_PAGE_NOT_FOUND",
            "Smart Page não encontrada.",
          );
        }
        const page = await tx.smartPage.update({ where: { id }, data: input });
        await audit(tx, actor, "smartPage.updated", id, {
          before: {
            slug: existing.slug,
            title: existing.title,
            description: existing.description,
            avatarUrl: existing.avatarUrl,
          },
          after: input,
        });
        return page;
      },
    );
    await track("smart_page_updated", { workspaceId: actor.workspaceId });
    return page;
  } catch (error) {
    return slugConflict(error);
  }
}

export async function deleteSmartPage(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const page = await tx.smartPage.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!page) {
      throw new ApiError(
        404,
        "SMART_PAGE_NOT_FOUND",
        "Smart Page não encontrada.",
      );
    }
    await tx.smartPage.delete({ where: { id } });
    await releaseQuota(tx, actor.workspaceId, "smartPages");
    await audit(tx, actor, "smartPage.deleted", id, { slug: page.slug });
  });
}

export async function setSmartPagePublished(
  actor: Actor,
  id: string,
  published: boolean,
) {
  const page = await workspaceTransaction(actor, "write", async (tx, plan) => {
    if (published) requireSmartPages(plan);
    const page = await tx.smartPage.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!page) {
      throw new ApiError(
        404,
        "SMART_PAGE_NOT_FOUND",
        "Smart Page não encontrada.",
      );
    }
    const updated = await tx.smartPage.update({
      where: { id },
      data: {
        status: published ? "published" : "draft",
        publishedAt: published ? new Date() : null,
      },
    });
    await audit(
      tx,
      actor,
      published ? "smartPage.published" : "smartPage.unpublished",
      id,
    );
    return updated;
  });
  if (published)
    await track("smart_page_published", { workspaceId: actor.workspaceId });
  return page;
}

async function checkedBlockInput(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: SmartPageBlockInput,
) {
  if (!input.linkId) return input;
  const link = await tx.shortLink.findFirst({
    where: {
      id: input.linkId,
      workspaceId: actor.workspaceId,
      distribution: "digital",
    },
  });
  if (!link) {
    throw new ApiError(
      404,
      "LINK_NOT_FOUND",
      "O link selecionado não pertence a este workspace.",
    );
  }
  return input;
}

export async function addSmartPageBlock(
  actor: Actor,
  pageId: string,
  raw: unknown,
) {
  const input = smartPageBlockInputSchema.parse(raw);
  const block = await workspaceTransaction(actor, "write", async (tx, plan) => {
    requireSmartPages(plan);
    const page = await tx.smartPage.findFirst({
      where: { id: pageId, workspaceId: actor.workspaceId },
    });
    if (!page) {
      throw new ApiError(
        404,
        "SMART_PAGE_NOT_FOUND",
        "Smart Page não encontrada.",
      );
    }
    const validInput = await checkedBlockInput(tx, actor, input);
    const position = await tx.smartPageBlock.count({
      where: { smartPageId: pageId },
    });
    const block = await tx.smartPageBlock.create({
      data: {
        smartPageId: pageId,
        type: validInput.type,
        position,
        settings: json(validInput.settings),
        visible: validInput.visible,
        analyticsEnabled: validInput.analyticsEnabled,
        linkId: validInput.linkId ?? null,
      },
      include: publicBlockInclude,
    });
    await audit(tx, actor, "smartPage.blockCreated", block.id, {
      pageId,
      type: block.type,
    });
    return block;
  });
  await track("smart_block_created", { workspaceId: actor.workspaceId });
  return block;
}

export async function updateSmartPageBlock(
  actor: Actor,
  pageId: string,
  blockId: string,
  raw: unknown,
) {
  const input = smartPageBlockInputSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    requireSmartPages(plan);
    const block = await tx.smartPageBlock.findFirst({
      where: {
        id: blockId,
        smartPageId: pageId,
        smartPage: { workspaceId: actor.workspaceId },
      },
    });
    if (!block) {
      throw new ApiError(404, "SMART_BLOCK_NOT_FOUND", "Bloco não encontrado.");
    }
    const validInput = await checkedBlockInput(tx, actor, input);
    const updated = await tx.smartPageBlock.update({
      where: { id: blockId },
      data: {
        type: validInput.type,
        settings: json(validInput.settings),
        visible: validInput.visible,
        analyticsEnabled: validInput.analyticsEnabled,
        linkId: validInput.linkId ?? null,
      },
      include: publicBlockInclude,
    });
    await audit(tx, actor, "smartPage.blockUpdated", blockId, {
      pageId,
      type: updated.type,
    });
    return updated;
  });
}

export async function deleteSmartPageBlock(
  actor: Actor,
  pageId: string,
  blockId: string,
) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const block = await tx.smartPageBlock.findFirst({
      where: {
        id: blockId,
        smartPageId: pageId,
        smartPage: { workspaceId: actor.workspaceId },
      },
    });
    if (!block) {
      throw new ApiError(404, "SMART_BLOCK_NOT_FOUND", "Bloco não encontrado.");
    }
    await tx.smartPageBlock.delete({ where: { id: blockId } });
    await tx.smartPageBlock.updateMany({
      where: { smartPageId: pageId, position: { gt: block.position } },
      data: { position: { decrement: 1 } },
    });
    await audit(tx, actor, "smartPage.blockDeleted", blockId, { pageId });
  });
}

export async function reorderSmartPageBlocks(
  actor: Actor,
  pageId: string,
  blockIds: string[],
) {
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    requireSmartPages(plan);
    const blocks = await tx.smartPageBlock.findMany({
      where: {
        smartPageId: pageId,
        smartPage: { workspaceId: actor.workspaceId },
      },
      select: { id: true },
    });
    if (
      blocks.length !== blockIds.length ||
      new Set(blockIds).size !== blockIds.length
    ) {
      throw new ApiError(
        400,
        "INVALID_BLOCK_ORDER",
        "A ordem dos blocos é inválida.",
      );
    }
    const blockIdsInPage = new Set(blocks.map((block) => block.id));
    if (!blockIds.every((id) => blockIdsInPage.has(id))) {
      throw new ApiError(
        400,
        "INVALID_BLOCK_ORDER",
        "A ordem dos blocos é inválida.",
      );
    }
    await tx.smartPageBlock.updateMany({
      where: { smartPageId: pageId },
      data: { position: { increment: blockIds.length } },
    });
    await Promise.all(
      blockIds.map((id, position) =>
        tx.smartPageBlock.update({ where: { id }, data: { position } }),
      ),
    );
    await audit(tx, actor, "smartPage.blocksReordered", pageId, { blockIds });
  });
}

export async function publicSmartPage(slug: string) {
  return getPrisma().smartPage.findFirst({
    where: { slug, status: "published" },
    include: {
      blocks: {
        where: { visible: true },
        orderBy: { position: "asc" },
        include: publicBlockInclude,
      },
    },
  });
}

export async function smartPageMetrics(actor: Actor, id: string, days: number) {
  const page = await getPrisma().smartPage.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    select: { id: true },
  });
  if (!page) {
    throw new ApiError(
      404,
      "SMART_PAGE_NOT_FOUND",
      "Smart Page não encontrada.",
    );
  }
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - days + 1);
  const viewWhere = {
    smartPageId: page.id,
    name: "smart_page_view",
    day: { gte: start },
  };
  const clickWhere = {
    smartPageId: page.id,
    name: "smart_block_clicked",
    day: { gte: start },
  };
  const db = getPrisma();
  const [views, clicks, visitors, topBlocks, trafficSources, devices] =
    await Promise.all([
      db.analyticsEvent.count({ where: viewWhere }),
      db.analyticsEvent.count({ where: clickWhere }),
      db.analyticsEvent.groupBy({
        by: ["visitorHash"],
        where: { ...viewWhere, visitorHash: { not: null } },
      }),
      db.analyticsEvent.groupBy({
        by: ["smartPageBlockId"],
        where: { ...clickWhere, smartPageBlockId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { smartPageBlockId: "desc" } },
        take: 5,
      }),
      db.analyticsEvent.groupBy({
        by: ["referrer"],
        where: { ...viewWhere, referrer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrer: "desc" } },
        take: 8,
      }),
      db.analyticsEvent.groupBy({
        by: ["device"],
        where: { ...viewWhere, device: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { device: "desc" } },
      }),
    ]);
  const blockIds = topBlocks.flatMap((item) =>
    item.smartPageBlockId ? [item.smartPageBlockId] : [],
  );
  const blocks = await db.smartPageBlock.findMany({
    where: { id: { in: blockIds }, smartPageId: page.id },
    select: { id: true, settings: true },
  });
  const blockTitles = new Map(
    blocks.map((block) => [
      block.id,
      linkBlockSettingsSchema.safeParse(block.settings).data?.title ?? "Link",
    ]),
  );
  return {
    periodDays: days,
    views,
    uniqueVisitors: visitors.length,
    clicks,
    ctr: views ? Number(((clicks / views) * 100).toFixed(1)) : 0,
    topLinks: topBlocks.flatMap((item) =>
      item.smartPageBlockId
        ? [
            {
              blockId: item.smartPageBlockId,
              title: blockTitles.get(item.smartPageBlockId) ?? "Link",
              clicks: item._count._all,
            },
          ]
        : [],
    ),
    trafficSources: trafficSources.flatMap((item) =>
      item.referrer ? [{ name: item.referrer, views: item._count._all }] : [],
    ),
    devices: devices.flatMap((item) =>
      item.device ? [{ name: item.device, views: item._count._all }] : [],
    ),
  };
}
