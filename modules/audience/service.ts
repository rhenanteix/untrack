import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import {
  audit,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";

const contactUpdateSchema = z
  .object({
    status: z
      .enum([
        "new_contact",
        "interested",
        "qualified",
        "customer",
        "not_interested",
      ])
      .optional(),
    temperature: z.enum(["cold", "warm", "hot"]).optional(),
    note: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Informe uma alteração.");

const contactInclude = {
  exchanges: {
    orderBy: { capturedAt: "desc" as const },
    take: 1,
    include: {
      smartCard: {
        select: { id: true, slug: true, firstName: true, lastName: true },
      },
      campaign: { select: { id: true, name: true } },
    },
  },
  formSubmissions: {
    orderBy: { submittedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      source: true,
      medium: true,
      channel: true,
      submittedAt: true,
      form: { select: { id: true, name: true, title: true } },
      smartPage: { select: { id: true, title: true, slug: true } },
      campaign: { select: { id: true, name: true } },
    },
  },
  _count: { select: { events: true, exchanges: true } },
} as const;

export async function listAudienceContacts(
  actor: Actor,
  page: number,
  search = "",
) {
  const term = search.trim().slice(0, 120);
  const items = await getPrisma().audienceContact.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: contactInclude,
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

export async function getAudienceContact(actor: Actor, id: string) {
  const contact = await getPrisma().audienceContact.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: {
      exchanges: {
        orderBy: { capturedAt: "desc" },
        include: {
          smartCard: {
            select: { id: true, slug: true, firstName: true, lastName: true },
          },
          campaign: { select: { id: true, name: true } },
        },
      },
      formSubmissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          source: true,
          medium: true,
          channel: true,
          submittedAt: true,
          form: { select: { id: true, name: true, title: true } },
          smartPage: { select: { id: true, title: true, slug: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
      events: { orderBy: { occurredAt: "desc" }, take: 100 },
    },
  });
  if (!contact)
    throw new ApiError(
      404,
      "AUDIENCE_CONTACT_NOT_FOUND",
      "Contato não encontrado.",
    );
  return contact;
}

export async function updateAudienceContact(
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const input = contactUpdateSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const before = await tx.audienceContact.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!before)
      throw new ApiError(
        404,
        "AUDIENCE_CONTACT_NOT_FOUND",
        "Contato não encontrado.",
      );
    const contact = await tx.audienceContact.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.temperature ? { temperature: input.temperature } : {}),
      },
    });
    if (input.note)
      await tx.audienceContactEvent.create({
        data: {
          workspaceId: actor.workspaceId,
          contactId: id,
          name: "note_added",
          metadata: { note: input.note },
        },
      });
    await audit(tx, actor, "audienceContact.updated", id, {
      status: input.status,
      temperature: input.temperature,
      addedNote: Boolean(input.note),
    });
    return contact;
  });
}
