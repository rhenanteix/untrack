import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { PAGE_SIZE } from "@/lib/pagination";
import { getPrisma } from "@/lib/prisma";
import { canUse } from "@/modules/billing/entitlements";
import {
  audit,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";

const audienceStatuses = ["new", "engaged", "converted"] as const;
const engagementLevels = ["low", "medium", "high"] as const;
const ruleFields = [
  "source",
  "campaign",
  "distribution",
  "tag",
  "status",
  "conversion",
  "form",
  "engagement",
] as const;
const periodDays = { "7d": 7, "30d": 30, "90d": 90 } as const;
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)));

export type AudienceContactFilters = z.infer<typeof filtersSchema>;
export type AudienceSegmentRule = z.infer<typeof segmentRuleSchema>;

const filtersSchema = z
  .object({
    search: z.string().trim().max(120).default(""),
    source: z.string().trim().min(1).max(253).optional(),
    campaignId: z.string().trim().min(1).max(255).optional(),
    campaignAssetId: z.string().trim().min(1).max(255).optional(),
    status: z.enum(audienceStatuses).optional(),
    conversion: z.enum(["all", "with"]).default("all"),
    engagement: z.enum(engagementLevels).optional(),
    tagId: z.string().trim().min(1).max(200).optional(),
    formId: z.string().trim().min(1).max(255).optional(),
    segmentId: z.string().trim().min(1).max(255).optional(),
    period: z.enum(["all", "7d", "30d", "90d", "custom"]).default("all"),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    sort: z
      .enum(["recent", "last_seen", "oldest", "name", "engagement"])
      .default("recent"),
  })
  .strict()
  .superRefine((filters, context) => {
    if (filters.period !== "custom") return;
    if (!filters.from)
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "Informe o início do período personalizado.",
      });
    if (!filters.to)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Informe o fim do período personalizado.",
      });
    if (filters.from && filters.to && filters.from > filters.to)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "O fim do período precisa ser posterior ao início.",
      });
  });

const noteSchema = z.object({ content: z.string().trim().min(1).max(1000) }).strict();
const tagSchema = z.object({ tagId: z.string().trim().min(1).max(200) }).strict();
const contactUpdateSchema = z
  .object({
    status: z
      .enum(["new_contact", "interested", "qualified", "customer", "not_interested"])
      .optional(),
    temperature: z.enum(["cold", "warm", "hot"]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Informe uma alteração.");
const segmentRuleSchema = z
  .object({ field: z.enum(ruleFields), value: z.string().trim().min(1).max(255) })
  .strict();
const segmentRulesSchema = z
  .array(segmentRuleSchema)
  .min(1)
  .max(5)
  .refine(
    (rules) => new Set(rules.map((rule) => rule.field)).size === rules.length,
    "Use no máximo uma regra de cada tipo.",
  );
const segmentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).default(""),
    rules: segmentRulesSchema,
  })
  .strict();

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function parseAudienceContactFilters(raw: Record<string, unknown>) {
  return filtersSchema.parse({
    search: stringValue(raw.search),
    source: stringValue(raw.source),
    campaignId: stringValue(raw.campaignId) ?? stringValue(raw.campaign),
    campaignAssetId:
      stringValue(raw.campaignAssetId) ?? stringValue(raw.distribution),
    status: stringValue(raw.status),
    conversion: stringValue(raw.conversion),
    engagement: stringValue(raw.engagement),
    tagId: stringValue(raw.tagId) ?? stringValue(raw.tag),
    formId: stringValue(raw.formId) ?? stringValue(raw.form),
    segmentId: stringValue(raw.segmentId) ?? stringValue(raw.segment),
    period: stringValue(raw.period),
    from: stringValue(raw.from),
    to: stringValue(raw.to),
    sort: stringValue(raw.sort),
  });
}

function periodRange(filters: AudienceContactFilters) {
  if (filters.period === "all") return {};
  if (filters.period === "custom")
    return {
      from: new Date(`${filters.from!}T00:00:00.000Z`),
      to: new Date(`${filters.to!}T23:59:59.999Z`),
    };
  return {
    from: new Date(Date.now() - periodDays[filters.period] * 86_400_000),
  };
}

async function resolveFilters(
  actor: Actor,
  raw: AudienceContactFilters | Record<string, unknown> | string = {},
) {
  const filters =
    typeof raw === "string"
      ? filtersSchema.parse({ search: raw })
      : parseAudienceContactFilters(raw);
  if (!filters.segmentId) return filters;
  const segment = await getPrisma().audienceSegment.findFirst({
    where: { id: filters.segmentId, workspaceId: actor.workspaceId },
    select: { rules: true },
  });
  if (!segment)
    throw new ApiError(404, "AUDIENCE_SEGMENT_NOT_FOUND", "Segmento não encontrado.");
  const rules = segmentRulesSchema.parse(segment.rules);
  const values: Record<string, string> = {};
  for (const rule of rules) {
    values[
      rule.field === "campaign"
        ? "campaignId"
        : rule.field === "tag"
          ? "tagId"
          : rule.field === "distribution"
            ? "campaignAssetId"
            : rule.field === "form"
              ? "formId"
              : rule.field
    ] = rule.value;
  }
  return filtersSchema.parse({ ...filters, ...values });
}

function whereFor(
  workspaceId: string,
  filters: AudienceContactFilters,
  includeActivityPeriod = true,
): Prisma.AudienceContactWhereInput {
  const clauses: Prisma.AudienceContactWhereInput[] = [{ workspaceId }];
  if (filters.search)
    clauses.push({
      OR: [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
        { company: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  if (filters.source)
    clauses.push({ firstSource: { equals: filters.source, mode: "insensitive" } });
  if (filters.campaignId)
    clauses.push({
      OR: [
        { formSubmissions: { some: { campaignId: filters.campaignId } } },
        { exchanges: { some: { campaignId: filters.campaignId } } },
      ],
    });
  if (filters.campaignAssetId)
    clauses.push({
      OR: [
        {
          formSubmissions: {
            some: { campaignAssetId: filters.campaignAssetId },
          },
        },
        {
          analyticsVisitors: {
            some: {
              events: { some: { campaignAssetId: filters.campaignAssetId } },
            },
          },
        },
      ],
    });
  if (filters.status) clauses.push({ audienceStatus: filters.status });
  if (filters.conversion === "with") clauses.push({ conversionCount: { gt: 0 } });
  if (filters.engagement) clauses.push({ engagementLevel: filters.engagement });
  if (filters.tagId)
    clauses.push({ tags: { some: { tagId: filters.tagId, workspaceId } } });
  if (filters.formId)
    clauses.push({ formSubmissions: { some: { formId: filters.formId } } });
  const range = periodRange(filters);
  if (includeActivityPeriod && range.from)
    clauses.push({
      firstSeenAt: { gte: range.from, ...(range.to ? { lte: range.to } : {}) },
    });
  return { AND: clauses };
}

function orderFor(
  sort: AudienceContactFilters["sort"],
): Prisma.AudienceContactOrderByWithRelationInput[] {
  if (sort === "last_seen") return [{ lastSeenAt: "desc" }, { id: "desc" }];
  if (sort === "oldest") return [{ createdAt: "asc" }, { id: "asc" }];
  if (sort === "name")
    return [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }];
  if (sort === "engagement")
    return [
      { engagementLevel: "desc" },
      { conversionCount: "desc" },
      { lastSeenAt: "desc" },
    ];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

const listInclude = {
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
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
  exchanges: {
    orderBy: { capturedAt: "desc" as const },
    take: 1,
    include: {
      smartCard: { select: { id: true, slug: true, firstName: true, lastName: true } },
      campaign: { select: { id: true, name: true } },
    },
  },
} as const;

export async function listAudienceContacts(
  actor: Actor,
  page: number,
  raw: AudienceContactFilters | Record<string, unknown> | string = {},
) {
  const filters = await resolveFilters(actor, raw);
  const where = whereFor(actor.workspaceId, filters);
  const [items, total] = await Promise.all([
    getPrisma().audienceContact.findMany({
      where,
      include: listInclude,
      orderBy: orderFor(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    }),
    getPrisma().audienceContact.count({ where }),
  ]);
  return { items: items.slice(0, PAGE_SIZE), page, total, hasMore: items.length > PAGE_SIZE, filters };
}

export async function getAudienceOverview(
  actor: Actor,
  raw: AudienceContactFilters | Record<string, unknown> | string = {},
) {
  const filters = await resolveFilters(actor, raw);
  const where = whereFor(actor.workspaceId, filters);
  const range = periodRange(filters);
  const acquisitionWhere = {
    AND: [
      whereFor(actor.workspaceId, filters, false),
      ...(range.from
        ? [{ createdAt: { gte: range.from, ...(range.to ? { lte: range.to } : {}) } }]
        : []),
    ],
  } satisfies Prisma.AudienceContactWhereInput;
  const [total, newContacts, converted, sources] = await Promise.all([
    getPrisma().audienceContact.count({ where }),
    getPrisma().audienceContact.count({ where: acquisitionWhere }),
    getPrisma().audienceContact.count({ where: { AND: [where, { audienceStatus: "converted" }] } }),
    getPrisma().audienceContact.groupBy({
      by: ["firstSource"],
      where: { AND: [where, { firstSource: { not: null } }] },
      _count: { _all: true },
      orderBy: { _count: { firstSource: "desc" } },
      take: 4,
    }),
  ]);
  return {
    total,
    newContacts,
    converted,
    conversionRate: total ? Math.round((converted / total) * 100) : 0,
    topSources: sources.flatMap((item) =>
      item.firstSource ? [{ source: item.firstSource, count: item._count._all }] : [],
    ),
  };
}

export async function getAudienceFilterOptions(actor: Actor) {
  const db = getPrisma();
  const [sources, campaigns, tags, forms, distributions] = await Promise.all([
    db.audienceContact.groupBy({
      by: ["firstSource"],
      where: { workspaceId: actor.workspaceId, firstSource: { not: null } },
      orderBy: { firstSource: "asc" },
      take: 100,
    }),
    db.campaign.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.tag.findMany({
      where: { workspaceId: actor.workspaceId, archivedAt: null },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.smartPageForm.findMany({
      where: { workspaceId: actor.workspaceId },
      select: { id: true, name: true, title: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    db.campaignAsset.findMany({
      where: { workspaceId: actor.workspaceId },
      select: {
        id: true,
        name: true,
        campaign: { select: { name: true } },
        channel: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);
  return {
    sources: sources.flatMap((item) => (item.firstSource ? [item.firstSource] : [])),
    campaigns,
    tags,
    forms,
    distributions,
  };
}

export async function getAudienceContact(actor: Actor, id: string) {
  const db = getPrisma();
  const contact = await db.audienceContact.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: {
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      notes: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      exchanges: {
        orderBy: { capturedAt: "asc" },
        include: {
          smartCard: { select: { id: true, slug: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
      formSubmissions: {
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          source: true,
          channel: true,
          campaignAssetId: true,
          values: true,
          submittedAt: true,
          consentGiven: true,
          consentText: true,
          consentedAt: true,
          form: {
            select: {
              id: true,
              name: true,
              fields: {
                select: { id: true, label: true, fieldType: true },
                orderBy: { position: "asc" },
              },
            },
          },
          smartPage: { select: { id: true, title: true, slug: true } },
          campaign: { select: { id: true, name: true } },
        },
      },
      analyticsVisitors: { select: { id: true } },
      events: { orderBy: { occurredAt: "asc" }, take: 100 },
    },
  });
  if (!contact)
    throw new ApiError(404, "AUDIENCE_CONTACT_NOT_FOUND", "Contato não encontrado.");

  const visitorIds = contact.analyticsVisitors.map((visitor) => visitor.id);
  const eventWhere: Prisma.AnalyticsEventWhereInput = {
    workspaceId: actor.workspaceId,
    isBot: false,
    isTest: false,
    OR: [
      { audienceContactId: contact.id },
      ...(visitorIds.length ? [{ visitorId: { in: visitorIds } }] : []),
    ],
  };
  const [events, conversions] = await Promise.all([
    db.analyticsEvent.findMany({
      where: eventWhere,
      include: { smartPage: { select: { title: true } }, smartCard: { select: { slug: true } } },
      orderBy: { occurredAt: "desc" },
      take: 250,
    }),
    db.analyticsConversion.findMany({
      where: {
        workspaceId: actor.workspaceId,
        isBot: false,
        isTest: false,
        visitorId: { in: visitorIds.length ? visitorIds : ["__none__"] },
      },
      include: {
        goal: { select: { id: true, name: true } },
        event: { select: { smartPage: { select: { title: true } } } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
  ]);
  const knownCampaigns = [
    ...contact.formSubmissions.flatMap((submission) =>
      submission.campaign ? [submission.campaign] : [],
    ),
    ...contact.exchanges.flatMap((exchange) =>
      exchange.campaign ? [exchange.campaign] : [],
    ),
  ];
  const campaignIds = [
    ...conversions.flatMap((conversion) =>
      conversion.campaignId ? [conversion.campaignId] : [],
    ),
    ...events.flatMap((event) => (event.campaignId ? [event.campaignId] : [])),
  ];
  const campaignAssetIds = [
    ...events.flatMap((event) =>
      event.campaignAssetId ? [event.campaignAssetId] : [],
    ),
    ...contact.formSubmissions.flatMap((submission) =>
      submission.campaignAssetId ? [submission.campaignAssetId] : [],
    ),
  ];
  const [campaigns, distributions] = await Promise.all([
    campaignIds.length
      ? db.campaign.findMany({
          where: { id: { in: campaignIds }, workspaceId: actor.workspaceId },
          select: { id: true, name: true },
        })
      : [],
    campaignAssetIds.length
      ? db.campaignAsset.findMany({
          where: {
            id: { in: campaignAssetIds },
            workspaceId: actor.workspaceId,
          },
          select: {
            id: true,
            name: true,
            campaign: { select: { name: true } },
            channel: { select: { name: true } },
          },
        })
      : [],
  ]);
  const campaignById = new Map(
    [...knownCampaigns, ...campaigns].map((campaign) => [campaign.id, campaign]),
  );
  const distributionById = new Map(
    distributions.map((distribution) => [distribution.id, distribution]),
  );
  const attributionEvidence = [
    ...events.map((event) => ({
      occurredAt: event.occurredAt,
      campaignId: event.campaignId,
      campaignAssetId: event.campaignAssetId,
      landingAsset: event.smartPage?.title ?? event.smartCard?.slug ?? null,
    })),
    ...contact.formSubmissions.map((submission) => ({
      occurredAt: submission.submittedAt,
      campaignId: submission.campaign?.id ?? null,
      campaignAssetId: submission.campaignAssetId,
      landingAsset: submission.smartPage.title,
    })),
    ...contact.exchanges.map((exchange) => ({
      occurredAt: exchange.capturedAt,
      campaignId: exchange.campaign?.id ?? null,
      campaignAssetId: null,
      landingAsset: exchange.smartCard.slug,
    })),
  ].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  const firstEvidence = attributionEvidence[0];
  const lastEvidence = attributionEvidence.at(-1);
  const firstDistributionId = attributionEvidence.find(
    (item) => item.campaignAssetId,
  )?.campaignAssetId;
  const lastDistributionId = [...attributionEvidence]
    .reverse()
    .find((item) => item.campaignAssetId)?.campaignAssetId;
  const timeline = [
    ...events
      .filter((event) => !["form_submit", "lead_created"].includes(event.name))
      .map((event) => ({
      id: `event:${event.id}`,
      kind: "event" as const,
      name: event.name,
      occurredAt: event.occurredAt,
      context: {
        source: event.source,
        smartPage: event.smartPage?.title,
        smartCard: event.smartCard?.slug,
        distribution: event.campaignAssetId
          ? distributionById.get(event.campaignAssetId)?.name
          : undefined,
      },
      })),
    ...contact.formSubmissions.map((submission) => ({
      id: `submission:${submission.id}`,
      kind: "submission" as const,
      name: "form_submitted",
      occurredAt: submission.submittedAt,
      context: {
        source: submission.source,
        smartPage: submission.smartPage.title,
        form: submission.form.name,
        campaign: submission.campaign?.name,
        distribution: submission.campaignAssetId
          ? distributionById.get(submission.campaignAssetId)?.name
          : undefined,
      },
    })),
    ...contact.exchanges.map((exchange) => ({
      id: `exchange:${exchange.id}`,
      kind: "exchange" as const,
      name: "contact_captured",
      occurredAt: exchange.capturedAt,
      context: {
        source: exchange.sourceLabel ?? exchange.source,
        smartCard: exchange.smartCard.slug,
        campaign: exchange.campaign?.name,
      },
    })),
    ...contact.notes.map((note) => ({
      id: `note:${note.id}`,
      kind: "note" as const,
      name: "note_added",
      occurredAt: note.createdAt,
      content: note.content,
      author: note.author.name,
      context: {},
    })),
    ...contact.events
      .filter((event) => !["form_submitted", "contact_captured", "note_added"].includes(event.name))
      .map((event) => {
        const metadata = event.metadata as Record<string, unknown>;
        const submission = contact.formSubmissions.find(
          (item) => item.id === stringValue(metadata.submissionId),
        );
        const exchange = contact.exchanges.find(
          (item) => item.id === stringValue(metadata.exchangeId),
        );
        return {
          id: `contact:${event.id}`,
          kind: "contact" as const,
          name: event.name,
          occurredAt: event.occurredAt,
          context: {
            source:
              stringValue(metadata.source) ??
              submission?.source ??
              exchange?.sourceLabel ??
              exchange?.source,
            smartPage: submission?.smartPage.title,
            smartCard: exchange?.smartCard.slug,
            form: submission?.form.name,
            campaign: submission?.campaign?.name ?? exchange?.campaign?.name,
            distribution: submission?.campaignAssetId
              ? distributionById.get(submission.campaignAssetId)?.name
              : undefined,
          },
        };
      }),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  return {
    ...contact,
    attribution: {
      firstCampaign:
        (firstEvidence?.campaignId
          ? campaignById.get(firstEvidence.campaignId)?.name
          : null) ?? contact.firstCampaign,
      lastCampaign:
        (lastEvidence?.campaignId
          ? campaignById.get(lastEvidence.campaignId)?.name
          : null) ?? contact.lastCampaign,
      firstDistribution: firstDistributionId
        ? distributionById.get(firstDistributionId) ?? null
        : null,
      lastDistribution: lastDistributionId
        ? distributionById.get(lastDistributionId) ?? null
        : null,
      landingAsset:
        firstEvidence?.landingAsset ?? contact.formSubmissions[0]?.smartPage.title ?? null,
      identifiedVia: contact.creationSource,
    },
    conversions: conversions.map((conversion) => ({
      id: conversion.id,
      occurredAt: conversion.occurredAt,
      goal: conversion.goal,
      campaign: conversion.campaignId ? campaignById.get(conversion.campaignId) ?? null : null,
      smartPage: conversion.event.smartPage,
    })),
    timeline,
  };
}

export async function updateAudienceContact(actor: Actor, id: string, raw: unknown) {
  const input = contactUpdateSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const contact = await tx.audienceContact.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!contact)
      throw new ApiError(404, "AUDIENCE_CONTACT_NOT_FOUND", "Contato não encontrado.");
    const saved = await tx.audienceContact.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.temperature ? { temperature: input.temperature } : {}),
      },
    });
    await audit(tx, actor, "audienceContact.updated", id, input);
    return saved;
  });
}

export async function createAudienceContactNote(actor: Actor, id: string, raw: unknown) {
  const input = noteSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const contact = await tx.audienceContact.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (!contact)
      throw new ApiError(404, "AUDIENCE_CONTACT_NOT_FOUND", "Contato não encontrado.");
    const note = await tx.audienceContactNote.create({
      data: { workspaceId: actor.workspaceId, contactId: id, authorUserId: actor.userId, content: input.content },
      include: { author: { select: { id: true, name: true } } },
    });
    await tx.audienceContactEvent.create({
      data: { workspaceId: actor.workspaceId, contactId: id, name: "note_added", metadata: { noteId: note.id } },
    });
    await audit(tx, actor, "audienceContact.noteCreated", id, { noteId: note.id });
    return note;
  });
}

export async function addAudienceContactTag(actor: Actor, id: string, raw: unknown) {
  const input = tagSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const [contact, tag] = await Promise.all([
      tx.audienceContact.findFirst({ where: { id, workspaceId: actor.workspaceId }, select: { id: true } }),
      tx.tag.findFirst({
        where: { id: input.tagId, workspaceId: actor.workspaceId, archivedAt: null },
        select: { id: true, name: true, color: true },
      }),
    ]);
    if (!contact)
      throw new ApiError(404, "AUDIENCE_CONTACT_NOT_FOUND", "Contato não encontrado.");
    if (!tag) throw new ApiError(404, "TAG_NOT_FOUND", "Tag não encontrada.");
    await tx.audienceContactTag.upsert({
      where: { contactId_tagId: { contactId: id, tagId: tag.id } },
      create: { workspaceId: actor.workspaceId, contactId: id, tagId: tag.id },
      update: {},
    });
    await audit(tx, actor, "audienceContact.tagAdded", id, { tagId: tag.id });
    return tag;
  });
}

export async function removeAudienceContactTag(actor: Actor, id: string, raw: unknown) {
  const input = tagSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx) => {
    const contact = await tx.audienceContact.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { id: true },
    });
    if (!contact)
      throw new ApiError(404, "AUDIENCE_CONTACT_NOT_FOUND", "Contato não encontrado.");
    await tx.audienceContactTag.deleteMany({
      where: { workspaceId: actor.workspaceId, contactId: id, tagId: input.tagId },
    });
    await audit(tx, actor, "audienceContact.tagRemoved", id, { tagId: input.tagId });
  });
}

function assertSegmentAccess(access: { effectivePlan: "free" | "premium" }) {
  if (!canUse(access, "advancedAnalytics"))
    throw new ApiError(403, "PREMIUM_FEATURE_REQUIRED", "Segmentos dinâmicos estão disponíveis no Premium.");
}

export async function listAudienceSegments(actor: Actor) {
  return getPrisma().audienceSegment.findMany({
    where: { workspaceId: actor.workspaceId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

export async function createAudienceSegment(actor: Actor, raw: unknown) {
  const input = segmentSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, access) => {
    assertSegmentAccess(access);
    const segment = await tx.audienceSegment.create({
      data: { workspaceId: actor.workspaceId, name: input.name, description: input.description, rules: json(input.rules) },
    });
    await audit(tx, actor, "audienceSegment.created", segment.id, { ruleFields: input.rules.map((rule) => rule.field) });
    return segment;
  });
}

export async function deleteAudienceSegment(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx, access) => {
    assertSegmentAccess(access);
    const deleted = await tx.audienceSegment.deleteMany({ where: { id, workspaceId: actor.workspaceId } });
    if (!deleted.count)
      throw new ApiError(404, "AUDIENCE_SEGMENT_NOT_FOUND", "Segmento não encontrado.");
    await audit(tx, actor, "audienceSegment.deleted", id);
  });
}