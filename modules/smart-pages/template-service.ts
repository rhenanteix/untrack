import { Prisma } from "@prisma/client";
import { track } from "@/lib/analytics";
import { getSmartPage } from "./service";
import { ApiError } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import {
  audit,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  smartPageInputSchema,
  smartPageBlockInputSchema,
  type SmartPageBlockInput,
} from "./schemas";
import { socialLinksSchema } from "./schemas";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

export interface SmartPageTemplateSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  plan: "free" | "premium";
  version: number;
  publishedAt: Date | null;
}

export interface SmartPageTemplateDetail extends SmartPageTemplateSummary {
  theme: Record<string, unknown>;
  blocks: SmartPageBlockInput[];
  socialLinks: Array<{
    network: string;
    url: string;
    label?: string;
  }>;
}

export async function listSmartPageTemplates(
  _actor: Actor,
  options: {
    page?: number;
    search?: string;
    category?: string;
    plan?: "free" | "premium" | "all";
  } = {},
): Promise<{
  items: SmartPageTemplateSummary[];
  page: number;
  hasMore: boolean;
}> {
  const { page = 1, search = "", category = "", plan = "all" } = options;
  const PAGE_SIZE = 20;

  const where: Prisma.SmartPageTemplateWhereInput = {
    published: true,
    ...(search.trim()
      ? {
          OR: [
            {
              name: {
                contains: search.trim().slice(0, 120),
                mode: "insensitive",
              },
            },
            {
              description: {
                contains: search.trim().slice(0, 120),
                mode: "insensitive",
              },
            },
            {
              slug: {
                contains: search.trim().slice(0, 120),
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
    ...(plan !== "all" ? { plan } : {}),
  };

  const items = await getPrisma().smartPageTemplate.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      thumbnailUrl: true,
      plan: true,
      version: true,
      publishedAt: true,
    },
  });

  return {
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getSmartPageTemplate(
  _actor: Actor,
  id: string,
): Promise<SmartPageTemplateDetail | null> {
  const template = await getPrisma().smartPageTemplate.findFirst({
    where: { id, published: true },
  });

  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    category: template.category,
    thumbnailUrl: template.thumbnailUrl,
    plan: template.plan,
    version: template.version,
    publishedAt: template.publishedAt,
    theme: template.theme as Record<string, unknown>,
    blocks: template.blocks as SmartPageBlockInput[],
    socialLinks: template.socialLinks as Array<{
      network: string;
      url: string;
      label?: string;
    }>,
  };
}

export async function getSmartPageTemplateForPreview(
  id: string,
): Promise<SmartPageTemplateDetail | null> {
  const template = await getPrisma().smartPageTemplate.findFirst({
    where: { id, published: true },
  });

  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    category: template.category,
    thumbnailUrl: template.thumbnailUrl,
    plan: template.plan,
    version: template.version,
    publishedAt: template.publishedAt,
    theme: template.theme as Record<string, unknown>,
    blocks: template.blocks as SmartPageBlockInput[],
    socialLinks: template.socialLinks as Array<{
      network: string;
      url: string;
      label?: string;
    }>,
  };
}

export async function createSmartPageFromTemplate(
  actor: Actor,
  templateId: string,
  overrides: {
    slug: string;
    title: string;
    description?: string;
  },
) {
  overrides = smartPageInputSchema
    .pick({ slug: true, title: true, description: true })
    .parse(overrides);
  const template = await getPrisma().smartPageTemplate.findFirst({
    where: { id: templateId, published: true },
  });

  if (!template) {
    throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template não encontrado.");
  }

  if (template.plan === "premium") {
    const user = await getPrisma().user.findUnique({
      where: { id: actor.userId },
      select: {
        plan: true,
        trial: { select: { status: true, expiresAt: true } },
      },
    });
    const activeTrial =
      user?.trial?.status === "active" &&
      user.trial.expiresAt &&
      user.trial.expiresAt > new Date();
    if (user?.plan !== "premium" && !activeTrial) {
      throw new ApiError(
        403,
        "PREMIUM_REQUIRED",
        "Este template é exclusivo para assinantes Premium.",
      );
    }
  }
  const socialLinks =
    socialLinksSchema.safeParse(template.socialLinks).data ?? [];

  try {
    const page = await workspaceTransaction(
      actor,
      "write",
      async (tx, access) => {
        await reserveQuota(tx, actor.workspaceId, access, "smartPages");

        const page = await tx.smartPage.create({
          data: {
            slug: overrides.slug,
            title: overrides.title,
            description: overrides.description ?? template.description,
            avatarUrl: null,
            theme: json(template.theme),
            socialLinks: json(socialLinks),
            workspaceId: actor.workspaceId,
            status: "draft",
          },
        });

        const blockInputs = template.blocks as SmartPageBlockInput[];
        for (let i = 0; i < blockInputs.length; i++) {
          const blockInput = blockInputs[i];
          const validInput = await checkedBlockInput(tx, actor, blockInput);
          const block = await tx.smartPageBlock.create({
            data: {
              smartPageId: page.id,
              type: validInput.type,
              position: i,
              settings: json(
                validInput.type === "form" ? {} : validInput.settings,
              ),
              visible: validInput.visible,
              analyticsEnabled: validInput.analyticsEnabled,
              linkId:
                validInput.type === "link" ? (validInput.linkId ?? null) : null,
              productId:
                validInput.type === "product" ? validInput.productId : null,
            },
            include: {
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
                include: { fields: { orderBy: { position: "asc" } } },
              },
            },
          });

          if (validInput.type === "form" && validInput.settings) {
            const formSettings = validInput.settings as {
              name: string;
              title: string;
              description: string;
              submitLabel: string;
              successMessage: string;
              privacyPolicyUrl: string | null;
              status: "active" | "inactive";
              fields: Array<{
                id?: string;
                fieldType: string;
                label: string;
                placeholder?: string;
                required: boolean;
                options: string[];
              }>;
            };

            const form = await tx.smartPageForm.create({
              data: {
                workspaceId: actor.workspaceId,
                smartPageId: page.id,
                smartPageBlockId: block.id,
                name: formSettings.name,
                title: formSettings.title,
                description: formSettings.description,
                submitLabel: formSettings.submitLabel,
                successMessage: formSettings.successMessage,
                privacyPolicyUrl: formSettings.privacyPolicyUrl ?? null,
                status: formSettings.status,
                fields: {
                  create: formSettings.fields.map((field, position) => ({
                    fieldType: field.fieldType,
                    label: field.label,
                    placeholder: field.placeholder ?? null,
                    required: field.required,
                    position,
                    options: json(field.options),
                    config: json({}),
                  })),
                },
              },
            });
            await tx.smartPageBlock.update({
              where: { id: block.id },
              data: { settings: json({ formId: form.id }) },
            });
          }
        }

        await audit(tx, actor, "smartPage.createdFromTemplate", page.id, {
          slug: page.slug,
          templateId,
          templateVersion: template.version,
        });

        return page;
      },
    );

    await track("smart_page_created_from_template", {
      workspaceId: actor.workspaceId,
      templateId,
      templateVersion: template.version,
    });
    return getSmartPage(actor, page.id);
  } catch (error) {
    return slugConflict(error);
  }
}

async function checkedBlockInput(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: SmartPageBlockInput,
) {
  input = smartPageBlockInputSchema.parse(input);
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

export async function getSmartPageTemplateCategories(): Promise<string[]> {
  const categories = await getPrisma().smartPageTemplate.findMany({
    where: { published: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return categories.map((c) => c.category);
}
