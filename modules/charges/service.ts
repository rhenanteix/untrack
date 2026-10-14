import { Prisma } from "@prisma/client";
import { ChargeStatus } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import {
  audit,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  CHARGE_TRANSITIONS,
  chargeCancelSchema,
  chargeInputSchema,
  chargeUpdateSchema,
} from "./schemas";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function safeMetadata(raw: unknown): Record<string, unknown> {
  try {
    const parsed =
      typeof raw === "string" ? JSON.parse(raw) : raw;
    return (parsed && typeof parsed === "object" ? parsed : {}) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

export async function listCharges(
  actor: Actor,
  page: number,
  status?: string,
) {
  const where: Prisma.ChargeWhereInput = {
    workspaceId: actor.workspaceId,
    ...(status ? { status: { equals: status as ChargeStatus } } : {}),
  };
  const items = await getPrisma().charge.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      offer: {
        select: { id: true, name: true, amount: true },
      },
    },
  });
  return {
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getCharge(actor: Actor, id: string) {
  const charge = await getPrisma().charge.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      offer: {
        select: { id: true, name: true, amount: true },
      },
    },
  });
  if (!charge) {
    throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
  }
  return charge;
}

export async function createCharge(actor: Actor, raw: unknown) {
  const input = chargeInputSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, access) => {
    await reserveQuota(tx, actor.workspaceId, access, "charges");
    if (input.customerId) {
      const customer = await tx.audienceContact.findFirst({
        where: { id: input.customerId, workspaceId: actor.workspaceId },
      });
      if (!customer) {
        throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Contato não encontrado.");
      }
    }
    if (input.offerId) {
      const offer = await tx.offer.findFirst({
        where: { id: input.offerId, workspaceId: actor.workspaceId },
      });
      if (!offer) {
        throw new ApiError(404, "OFFER_NOT_FOUND", "Oferta não encontrada.");
      }
    }
    const charge = await tx.charge.create({
      data: {
        ...input,
        metadata: json(input.metadata),
        workspaceId: actor.workspaceId,
        status: "draft",
      },
    });
    await audit(tx, actor, "charge.created", charge.id, {
      amountInCents: charge.amountInCents,
      currency: charge.currency,
    });
    return charge;
  });
}

export async function updateCharge(actor: Actor, id: string, raw: unknown) {
  const input = chargeUpdateSchema.parse(raw);
  const { metadata, ...rest } = input;
  return workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.charge.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!existing) {
      throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
    }
    if (existing.status !== "draft") {
      throw new ApiError(
        400,
        "CHARGE_NOT_EDITABLE",
        "Apenas cobranças em rascunho podem ser editadas.",
      );
    }
    const charge = await tx.charge.update({
      where: { id },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: json(metadata) } : {}),
      },
    });
    await audit(tx, actor, "charge.updated", charge.id, {
      before: existing,
      after: input,
    });
    return charge;
  });
}

function validateTransition(from: string, to: string) {
  const allowed = CHARGE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(
      400,
      "INVALID_TRANSITION",
      `Não é possível alterar de ${from} para ${to}.`,
    );
  }
}

export async function activateCharge(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.charge.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!existing) {
      throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
    }
    validateTransition(existing.status, "pending");
    const charge = await tx.charge.update({
      where: { id },
      data: { status: "pending" },
    });
    await audit(tx, actor, "charge.activated", charge.id, {
      previousStatus: existing.status,
    });
    return charge;
  });
}

export async function cancelCharge(
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const input = chargeCancelSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const existing = await tx.charge.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!existing) {
      throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
    }
    validateTransition(existing.status, "cancelled");
    const charge = await tx.charge.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        metadata: json({
          ...(safeMetadata(existing.metadata) as Record<string, unknown>),
          cancelReason: input.reason,
        }),
      },
    });
    await audit(tx, actor, "charge.cancelled", charge.id, {
      previousStatus: existing.status,
      reason: input.reason,
    });
    return charge;
  });
}
