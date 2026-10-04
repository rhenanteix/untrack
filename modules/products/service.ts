import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import { requirePremium } from "@/modules/billing/plans";
import {
  audit,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  productInputSchema,
  productUpdateSchema,
  type ProductInput,
} from "./schemas";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function productSlugConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "PRODUCT_SLUG_EXISTS",
      "Este endereço já está em uso em seu workspace.",
    );
  }
  throw error;
}

async function workspaceProduct(actor: Actor, id: string) {
  const product = await getPrisma().product.findFirst({
    where: { id, workspaceId: actor.workspaceId },
  });
  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  }
  return product;
}

function productData(input: ProductInput) {
  return {
    ...input,
    images: json(input.images),
    metadata: json(input.metadata),
  };
}

export async function listProducts(
  actor: Actor,
  page: number,
  search = "",
) {
  const query = search.trim().slice(0, 120);
  const items = await getPrisma().product.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { slug: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  return {
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getProduct(actor: Actor, id: string) {
  return workspaceProduct(actor, id);
}

export async function createProduct(actor: Actor, raw: unknown) {
  const input = productInputSchema.parse(raw);
  try {
    return await workspaceTransaction(actor, "write", async (tx, access) => {
      requirePremium(access);
      await reserveQuota(tx, actor.workspaceId, access, "products");
      const product = await tx.product.create({
        data: { ...productData(input), workspaceId: actor.workspaceId },
      });
      await audit(tx, actor, "product.created", product.id, {
        slug: product.slug,
        type: product.type,
      });
      return product;
    });
  } catch (error) {
    return productSlugConflict(error);
  }
}

export async function updateProduct(actor: Actor, id: string, raw: unknown) {
  const input = productUpdateSchema.parse(raw);
  const { images, metadata, ...productFields } = input;
  try {
    return await workspaceTransaction(actor, "write", async (tx, access) => {
      requirePremium(access);
      const existing = await tx.product.findFirst({
        where: { id, workspaceId: actor.workspaceId },
      });
      if (!existing) {
        throw new ApiError(
          404,
          "PRODUCT_NOT_FOUND",
          "Produto não encontrado.",
        );
      }
      const product = await tx.product.update({
        where: { id },
        data: {
          ...productFields,
          ...(images ? { images: json(images) } : {}),
          ...(metadata ? { metadata: json(metadata) } : {}),
        },
      });
      await audit(tx, actor, "product.updated", product.id, {
        before: { slug: existing.slug, status: existing.status },
        after: input,
      });
      return product;
    });
  } catch (error) {
    return productSlugConflict(error);
  }
}