import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import { productBlockSettingsSchema } from "@/modules/products/schemas";
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
  type SmartPageFormFieldInput,
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
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      priceInCents: true,
      currency: true,
      images: true,
      status: true,
      visible: true,
      startAt: true,
      endAt: true,
    },
  },
  form: {
    include: { fields: { orderBy: { position: "asc" as const } } },
  },
} as const;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function onboardingSocialLinks(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return (
    socialLinksSchema.safeParse((value as Record<string, unknown>).socialLinks)
      .data ?? []
  );
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
      async (tx, access) => {
        await reserveQuota(tx, actor.workspaceId, access, "smartPages");
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
    const page = await workspaceTransaction(actor, "write", async (tx) => {
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
    });
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
  const page = await workspaceTransaction(actor, "write", async (tx) => {
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
  if (published) {
    const forms = await getPrisma().smartPageForm.count({
      where: { smartPageId: id, status: "active" },
    });
    if (forms)
      await track("form_published", {
        workspaceId: actor.workspaceId,
        formCount: forms,
      });
  }
  return page;
}

async function checkedBlockInput(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: SmartPageBlockInput,
) {
  if (input.type === "link" && input.linkId) {
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
  }
  if (input.type === "product") {
    const product = await tx.product.findFirst({
      where: { id: input.productId, workspaceId: actor.workspaceId },
    });
    if (!product) {
      throw new ApiError(
        404,
        "PRODUCT_NOT_FOUND",
        "O produto selecionado não pertence a este workspace.",
      );
    }
  }
  return input;
}

function formFieldData(field: SmartPageFormFieldInput, position: number) {
  return {
    fieldType: field.fieldType,
    label: field.label,
    placeholder: field.placeholder || null,
    required: field.required,
    position,
    options: json(field.options),
    config: json({}),
  };
}

async function replaceFormFields(
  tx: Prisma.TransactionClient,
  formId: string,
  fields: SmartPageFormFieldInput[],
) {
  const existing = await tx.smartPageFormField.findMany({
    where: { formId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((field) => field.id));
  const retainedIds = fields.flatMap((field) => (field.id ? [field.id] : []));
  if (!retainedIds.every((id) => existingIds.has(id))) {
    throw new ApiError(
      400,
      "INVALID_FORM_FIELD",
      "Um dos campos do formulário não pertence a este formulário.",
    );
  }
  await tx.smartPageFormField.deleteMany({
    where: {
      formId,
      ...(retainedIds.length ? { id: { notIn: retainedIds } } : {}),
    },
  });
  await tx.smartPageFormField.updateMany({
    where: { formId },
    data: { position: { increment: fields.length + existing.length } },
  });
  await Promise.all(
    fields.map((field, position) =>
      field.id
        ? tx.smartPageFormField.update({
            where: { id: field.id },
            data: formFieldData(field, position),
          })
        : tx.smartPageFormField.create({
            data: { formId, ...formFieldData(field, position) },
          }),
    ),
  );
}

export async function addSmartPageBlock(
  actor: Actor,
  pageId: string,
  raw: unknown,
) {
  const input = smartPageBlockInputSchema.parse(raw);
  const block = await workspaceTransaction(actor, "write", async (tx) => {
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
        settings: json(validInput.type === "form" ? {} : validInput.settings),
        visible: validInput.visible,
        analyticsEnabled: validInput.analyticsEnabled,
        linkId: validInput.type === "link" ? (validInput.linkId ?? null) : null,
        productId: validInput.type === "product" ? validInput.productId : null,
      },
      include: publicBlockInclude,
    });
    const result =
      validInput.type === "form"
        ? await (async () => {
            const form = await tx.smartPageForm.create({
              data: {
                workspaceId: actor.workspaceId,
                smartPageId: pageId,
                smartPageBlockId: block.id,
                name: validInput.settings.name,
                title: validInput.settings.title,
                description: validInput.settings.description,
                submitLabel: validInput.settings.submitLabel,
                successMessage: validInput.settings.successMessage,
                privacyPolicyUrl: validInput.settings.privacyPolicyUrl ?? null,
                status: validInput.settings.status,
                fields: {
                  create: validInput.settings.fields.map(formFieldData),
                },
              },
            });
            return tx.smartPageBlock.update({
              where: { id: block.id },
              data: { settings: json({ formId: form.id }) },
              include: publicBlockInclude,
            });
          })()
        : block;
    await audit(tx, actor, "smartPage.blockCreated", block.id, {
      pageId,
      type: block.type,
    });
    return result;
  });
  await track("smart_block_created", { workspaceId: actor.workspaceId });
  if (input.type === "form")
    await Promise.all([
      track("form_created", { workspaceId: actor.workspaceId }),
      track("form_block_added", { workspaceId: actor.workspaceId }),
    ]);
  return block;
}

export async function updateSmartPageBlock(
  actor: Actor,
  pageId: string,
  blockId: string,
  raw: unknown,
) {
  const input = smartPageBlockInputSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const block = await tx.smartPageBlock.findFirst({
      where: {
        id: blockId,
        smartPageId: pageId,
        smartPage: { workspaceId: actor.workspaceId },
      },
      include: publicBlockInclude,
    });
    if (!block) {
      throw new ApiError(404, "SMART_BLOCK_NOT_FOUND", "Bloco não encontrado.");
    }
    const validInput = await checkedBlockInput(tx, actor, input);
    if (block.form && validInput.type !== "form") {
      throw new ApiError(
        400,
        "FORM_BLOCK_TYPE_IMMUTABLE",
        "Um formulário só pode ser atualizado como formulário.",
      );
    }
    if (validInput.type === "form") {
      if (!block.form) {
        throw new ApiError(400, "FORM_NOT_FOUND", "Formulário não encontrado.");
      }
      await tx.smartPageForm.update({
        where: { id: block.form.id },
        data: {
          name: validInput.settings.name,
          title: validInput.settings.title,
          description: validInput.settings.description,
          submitLabel: validInput.settings.submitLabel,
          successMessage: validInput.settings.successMessage,
          privacyPolicyUrl: validInput.settings.privacyPolicyUrl ?? null,
          status: validInput.settings.status,
        },
      });
      await replaceFormFields(tx, block.form.id, validInput.settings.fields);
      const updated = await tx.smartPageBlock.update({
        where: { id: blockId },
        data: {
          visible: validInput.visible,
          analyticsEnabled: validInput.analyticsEnabled,
        },
        include: publicBlockInclude,
      });
      await audit(tx, actor, "smartPage.blockUpdated", blockId, {
        pageId,
        type: updated.type,
      });
      return updated;
    }
    const updated = await tx.smartPageBlock.update({
      where: { id: blockId },
      data: {
        type: validInput.type,
        settings: json(validInput.settings),
        visible: validInput.visible,
        analyticsEnabled: validInput.analyticsEnabled,
        linkId: validInput.type === "link" ? (validInput.linkId ?? null) : null,
        productId: validInput.type === "product" ? validInput.productId : null,
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
  return workspaceTransaction(actor, "write", async (tx) => {
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

export async function publicSmartPageProduct(slug: string, productId: string) {
  return getPrisma().smartPage.findFirst({
    where: {
      slug,
      status: "published",
      blocks: {
        some: { productId, type: "product", visible: true },
      },
    },
    include: {
      blocks: {
        where: { productId, type: "product", visible: true },
        include: publicBlockInclude,
        take: 1,
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
    name: {
      in: [
        "smart_block_clicked",
        "link_in_bio_product_click",
        "link_click",
        "button_click",
        "product_click",
      ],
    },
    day: { gte: start },
  };
  const formViewWhere = {
    smartPageId: page.id,
    name: "form_view",
    day: { gte: start },
  };
  const formSubmitWhere = {
    smartPageId: page.id,
    name: "form_submit",
    day: { gte: start },
  };
  const leadWhere = {
    smartPageId: page.id,
    name: "lead_created",
    day: { gte: start },
  };
  const db = getPrisma();
  const [
    views,
    clicks,
    visitors,
    topBlocks,
    trafficSources,
    devices,
    formViews,
    formSubmissions,
    leads,
    uniqueContacts,
  ] = await Promise.all([
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
    db.analyticsEvent.count({ where: formViewWhere }),
    db.analyticsEvent.count({ where: formSubmitWhere }),
    db.analyticsEvent.count({ where: leadWhere }),
    db.analyticsEvent.groupBy({
      by: ["audienceContactId"],
      where: { ...formSubmitWhere, audienceContactId: { not: null } },
    }),
  ]);
  const blockIds = topBlocks.flatMap((item) =>
    item.smartPageBlockId ? [item.smartPageBlockId] : [],
  );
  const blocks = await db.smartPageBlock.findMany({
    where: { id: { in: blockIds }, smartPageId: page.id },
    select: { id: true, settings: true, product: { select: { name: true } } },
  });
  const blockTitles = new Map(
    blocks.map((block) => [
      block.id,
      linkBlockSettingsSchema.safeParse(block.settings).data?.title ??
        block.product?.name ??
        productBlockSettingsSchema.safeParse(block.settings).data
          ?.buttonLabel ??
        "Bloco",
    ]),
  );
  return {
    periodDays: days,
    views,
    uniqueVisitors: visitors.length,
    clicks,
    ctr: views ? Number(((clicks / views) * 100).toFixed(1)) : 0,
    formViews,
    formSubmissions,
    formContacts: uniqueContacts.length,
    formLeads: leads,
    formSubmissionRate: formViews
      ? Number(((formSubmissions / formViews) * 100).toFixed(1))
      : 0,
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
