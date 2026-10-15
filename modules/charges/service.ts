import { Prisma, ChargeStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { track } from "@/lib/analytics";
import { getPrisma } from "@/lib/prisma";
import { PAGE_SIZE } from "@/lib/pagination";
import { requirePremium } from "@/modules/billing/plans";
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

const SHARE_TOKEN_LENGTH = 32;

export function generateShareToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, SHARE_TOKEN_LENGTH);
}

export async function generateChargeShareToken(actor: Actor, id: string) {
  return workspaceTransaction(actor, "manage", async (tx, access) => {
    requirePremium(access);
    const existing = await tx.charge.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!existing) {
      throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
    }
    if (existing.status !== "draft" && existing.status !== "pending") {
      throw new ApiError(
        400,
        "CHARGE_NOT_SHAREABLE",
        "Apenas cobranças em rascunho ou pendentes podem ser compartilhadas.",
      );
    }
    let token = existing.shareToken;
    if (!token) {
      token = generateShareToken();
      await tx.charge.update({
        where: { id },
        data: { shareToken: token },
      });
    }
    await track("payment_link_created", { chargeId: id });
    return { shareToken: token };
  });
}

export type ChargeWithRelations = {
  id: string;
  description: string;
  amountInCents: number;
  currency: string;
  status: ChargeStatus;
  dueAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  refundedAt: Date | null;
  shareToken: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  customer: { firstName: string; lastName: string; email: string | null } | null;
  offer: { name: string; amount: number } | null;
  workspace: { name: string; notifications: unknown };
};

export async function getChargeByShareToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) {
    throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
  }
  const charge = await getPrisma().charge.findUnique({
    where: { shareToken: token },
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
      offer: {
        select: { name: true, amount: true },
      },
      workspace: {
        select: { name: true, notifications: true },
      },
    },
  });
  if (!charge) {
    throw new ApiError(404, "CHARGE_NOT_FOUND", "Cobrança não encontrada.");
  }
  if (charge.status === "cancelled") {
    throw new ApiError(
      410,
      "CHARGE_CANCELLED",
      "Esta cobrança foi cancelada.",
    );
  }
  if (charge.status === "expired") {
    throw new ApiError(
      410,
      "CHARGE_EXPIRED",
      "Esta cobrança venceu.",
    );
  }
  if (
    charge.dueAt &&
    charge.dueAt < new Date() &&
    charge.status === "pending"
  ) {
    throw new ApiError(
      410,
      "CHARGE_EXPIRED",
      "Esta cobrança venceu.",
    );
  }
   await track("payment_link_viewed", { chargeId: charge.id });
  return charge as ChargeWithRelations;
}

export function chargeShareUrl(token: string): string {
  return new URL(`/pay/${token}`, appUrl()).href;
}

export async function recordPaymentLinkShare(chargeId: string) {
  await track("payment_link_shared", { chargeId });
}
