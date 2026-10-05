import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
import {
  canUse,
  getAnalyticsHistoryDays,
} from "@/modules/billing/entitlements";
import type { Actor } from "@/modules/workspaces/context";
import { conversionRate } from "./conversion-rate";
import type { AnalyticsAssetType } from "./event-types";

const viewEvents = [
  "page_view",
  "smart_page_view",
  "smart_card_view",
  "product_view",
];
const clickEvents = [
  "link_click",
  "button_click",
  "social_click",
  "whatsapp_click",
  "product_click",
  "website_click",
  "save_contact_click",
];

export type AnalyticsFilters = {
  from?: Date;
  to?: Date;
  periodDays?: number;
  assetType?: AnalyticsAssetType;
  assetId?: string;
  campaignId?: string;
  goalId?: string;
  source?: string;
  channel?: string;
};

export type ResolvedFilters = AnalyticsFilters & {
  from: Date;
  to: Date;
  timezone: string;
  historyDays: number;
  advancedAnalytics: boolean;
};

function calendarDate(value: Date, timezone: string) {
  try {
    const values = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(value)
        .filter((part) => ["year", "month", "day"].includes(part.type))
        .map((part) => [part.type, part.value]),
    );
    return new Date(
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
      ),
    );
  } catch {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
}

function timezoneOffset(value: Date, timezone: string) {
  try {
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
      .formatToParts(value)
      .find((part) => part.type === "timeZoneName")?.value;
    const match = label?.match(/^GMT(?:(\+|-)(\d{2}):(\d{2}))?$/);
    if (!match || !match[1]) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return (match[1] === "+" ? 1 : -1) * minutes * 60_000;
  } catch {
    return 0;
  }
}

function startOfDay(value: Date, timezone: string) {
  const target = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
  let instant = target;
  for (let attempt = 0; attempt < 2; attempt += 1)
    instant = target - timezoneOffset(new Date(instant), timezone);
  return new Date(instant);
}

function endOfDay(value: Date, timezone: string) {
  const next = new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + 1,
    ),
  );
  return new Date(startOfDay(next, timezone).getTime() - 1);
}

export async function resolveAnalyticsFilters(
  actor: Actor,
  filters: AnalyticsFilters,
) {
  const [access, workspace] = await Promise.all([
    getAccountAccessForUser(actor.userId),
    getPrisma().workspace.findUnique({
      where: { id: actor.workspaceId },
      select: { timezone: true },
    }),
  ]);
  const timezone = workspace?.timezone ?? "UTC";
  const historyDays = getAnalyticsHistoryDays(access);
  const today = calendarDate(new Date(), timezone);
  const earliestDay = new Date(today);
  earliestDay.setUTCDate(earliestDay.getUTCDate() - historyDays + 1);
  const earliest = startOfDay(earliestDay, timezone);
  const periodStart = new Date(today);
  periodStart.setUTCDate(
    periodStart.getUTCDate() - (filters.periodDays ?? historyDays) + 1,
  );
  const requestedFrom = filters.from
    ? startOfDay(filters.from, timezone)
    : startOfDay(periodStart, timezone);
  const requestedTo = filters.to
    ? endOfDay(filters.to, timezone)
    : endOfDay(today, timezone);
  return {
    ...filters,
    from: requestedFrom < earliest ? earliest : requestedFrom,
    to: requestedTo,
    timezone,
    historyDays,
    advancedAnalytics: canUse(access, "advancedAnalytics"),
  } satisfies ResolvedFilters;
}

export function eventWhere(actor: Actor, filters: ResolvedFilters) {
  return {
    workspaceId: actor.workspaceId,
    occurredAt: { gte: filters.from, lte: filters.to },
    isBot: false,
    isTest: false,
    ...(filters.assetType ? { assetType: filters.assetType } : {}),
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.goalId
      ? {
          visitor: {
            conversions: { some: conversionWhere(actor, filters) },
          },
        }
      : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
  };
}

export function conversionWhere(actor: Actor, filters: ResolvedFilters) {
  return {
    workspaceId: actor.workspaceId,
    occurredAt: { gte: filters.from, lte: filters.to },
    isBot: false,
    isTest: false,
    ...(filters.goalId ? { goalId: filters.goalId } : {}),
    ...(filters.assetType ? { assetType: filters.assetType } : {}),
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
  };
}

async function totals(actor: Actor, filters: ResolvedFilters) {
  const db = getPrisma();
  const where = eventWhere(actor, filters);
  const conversionsWhere = conversionWhere(actor, filters);
  const [views, clicks, whatsappClicks, conversions, visitors, sessions] =
    await Promise.all([
      db.analyticsEvent.count({
        where: { ...where, name: { in: viewEvents } },
      }),
      db.analyticsEvent.count({
        where: { ...where, name: { in: clickEvents } },
      }),
      db.analyticsEvent.count({ where: { ...where, name: "whatsapp_click" } }),
      db.analyticsConversion.count({ where: conversionsWhere }),
      db.analyticsEvent.groupBy({
        by: ["visitorId"],
        where: { ...where, visitorId: { not: null } },
      }),
      db.analyticsEvent.groupBy({
        by: ["sessionId"],
        where: { ...where, sessionId: { not: null } },
      }),
    ]);
  return {
    visitors: visitors.length,
    sessions: sessions.length,
    views,
    clicks,
    whatsappClicks,
    ctr: views ? Number(((clicks / views) * 100).toFixed(1)) : 0,
    conversions,
    conversionRate: conversionRate(conversions, visitors.length),
  };
}

function priorRange(filters: ResolvedFilters) {
  const duration = filters.to.getTime() - filters.from.getTime() + 1;
  return {
    ...filters,
    from: new Date(filters.from.getTime() - duration),
    to: new Date(filters.from.getTime() - 1),
  };
}

function change(current: number, previous: number) {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export async function analyticsOverview(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const current = await totals(actor, filters);
  const previous = filters.advancedAnalytics
    ? await totals(actor, priorRange(filters))
    : undefined;
  return {
    range: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      historyDays: filters.historyDays,
      advancedAnalytics: filters.advancedAnalytics,
    },
    ...current,
    comparison: {
      visitors: previous ? change(current.visitors, previous.visitors) : null,
      views: previous ? change(current.views, previous.views) : null,
      clicks: previous ? change(current.clicks, previous.clicks) : null,
      conversions: previous
        ? change(current.conversions, previous.conversions)
        : null,
    },
  };
}

export async function analyticsTimeseries(
  actor: Actor,
  input: AnalyticsFilters,
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const eventConditions: Prisma.Sql[] = [
    Prisma.sql`event."workspaceId" = ${actor.workspaceId}`,
    Prisma.sql`event."occurredAt" >= ${filters.from}`,
    Prisma.sql`event."occurredAt" <= ${filters.to}`,
    Prisma.sql`event."isBot" = false`,
    Prisma.sql`event."isTest" = false`,
  ];
  const conversionConditions: Prisma.Sql[] = [
    Prisma.sql`conversion."workspaceId" = ${actor.workspaceId}`,
    Prisma.sql`conversion."occurredAt" >= ${filters.from}`,
    Prisma.sql`conversion."occurredAt" <= ${filters.to}`,
    Prisma.sql`conversion."isBot" = false`,
    Prisma.sql`conversion."isTest" = false`,
  ];
  if (filters.assetType) {
    eventConditions.push(Prisma.sql`event."assetType" = ${filters.assetType}`);
    conversionConditions.push(
      Prisma.sql`conversion."assetType" = ${filters.assetType}`,
    );
  }
  if (filters.assetId) {
    eventConditions.push(Prisma.sql`event."assetId" = ${filters.assetId}`);
    conversionConditions.push(
      Prisma.sql`conversion."assetId" = ${filters.assetId}`,
    );
  }
  if (filters.campaignId) {
    eventConditions.push(
      Prisma.sql`event."campaignId" = ${filters.campaignId}`,
    );
    conversionConditions.push(
      Prisma.sql`conversion."campaignId" = ${filters.campaignId}`,
    );
  }
  if (filters.source) {
    eventConditions.push(Prisma.sql`event."source" = ${filters.source}`);
    conversionConditions.push(
      Prisma.sql`conversion."source" = ${filters.source}`,
    );
  }
  if (filters.channel) {
    eventConditions.push(Prisma.sql`event."channel" = ${filters.channel}`);
    conversionConditions.push(
      Prisma.sql`conversion."channel" = ${filters.channel}`,
    );
  }
  if (filters.goalId) {
    conversionConditions.push(
      Prisma.sql`conversion."goalId" = ${filters.goalId}`,
    );
    eventConditions.push(Prisma.sql`
      event."visitorId" IS NOT NULL AND event."visitorId" IN (
        SELECT goal_conversion."visitorId"
        FROM "AnalyticsConversion" AS goal_conversion
        WHERE goal_conversion."workspaceId" = ${actor.workspaceId}
          AND goal_conversion."goalId" = ${filters.goalId}
          AND goal_conversion."occurredAt" >= ${filters.from}
          AND goal_conversion."occurredAt" <= ${filters.to}
          AND goal_conversion."isBot" = false
          AND goal_conversion."isTest" = false
          AND goal_conversion."visitorId" IS NOT NULL
      )
    `);
  }
  const [rows, visitorRows, conversionRows] = await Promise.all([
    getPrisma().$queryRaw<Array<{ date: string; name: string; count: bigint }>>(
      Prisma.sql`
        SELECT TO_CHAR(event."occurredAt" AT TIME ZONE ${filters.timezone}, 'YYYY-MM-DD') AS "date", event."name", COUNT(*)::bigint AS "count"
        FROM "AnalyticsEvent" AS event
        WHERE ${Prisma.join(eventConditions, " AND ")}
          AND event."name" IN (${Prisma.join([...viewEvents, ...clickEvents])})
        GROUP BY 1, 2
      `,
    ),
    getPrisma().$queryRaw<Array<{ date: string; visitorId: string }>>(
      Prisma.sql`
        SELECT TO_CHAR(event."occurredAt" AT TIME ZONE ${filters.timezone}, 'YYYY-MM-DD') AS "date", event."visitorId"
        FROM "AnalyticsEvent" AS event
        WHERE ${Prisma.join(eventConditions, " AND ")}
          AND event."visitorId" IS NOT NULL
        GROUP BY 1, 2
      `,
    ),
    getPrisma().$queryRaw<Array<{ date: string; count: bigint }>>(
      Prisma.sql`
        SELECT TO_CHAR(conversion."occurredAt" AT TIME ZONE ${filters.timezone}, 'YYYY-MM-DD') AS "date", COUNT(*)::bigint AS "count"
        FROM "AnalyticsConversion" AS conversion
        WHERE ${Prisma.join(conversionConditions, " AND ")}
        GROUP BY 1
      `,
    ),
  ]);
  const byDay = new Map<
    string,
    { visitors: number; views: number; clicks: number; conversions: number }
  >();
  for (const row of rows) {
    const key = row.date;
    const values = byDay.get(key) ?? {
      visitors: 0,
      views: 0,
      clicks: 0,
      conversions: 0,
    };
    if (viewEvents.includes(row.name)) values.views += Number(row.count);
    if (clickEvents.includes(row.name)) values.clicks += Number(row.count);
    byDay.set(key, values);
  }
  for (const row of visitorRows) {
    const key = row.date;
    const values = byDay.get(key) ?? {
      visitors: 0,
      views: 0,
      clicks: 0,
      conversions: 0,
    };
    values.visitors += 1;
    byDay.set(key, values);
  }
  for (const row of conversionRows) {
    const key = row.date;
    const values = byDay.get(key) ?? {
      visitors: 0,
      views: 0,
      clicks: 0,
      conversions: 0,
    };
    values.conversions += Number(row.count);
    byDay.set(key, values);
  }
  const points = [];
  const lastDay = calendarDate(filters.to, filters.timezone);
  for (
    let day = calendarDate(filters.from, filters.timezone);
    day <= lastDay;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const date = day.toISOString().slice(0, 10);
    points.push({
      date,
      ...(byDay.get(date) ?? {
        visitors: 0,
        views: 0,
        clicks: 0,
        conversions: 0,
      }),
    });
  }
  return {
    range: {
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
      timezone: filters.timezone,
      granularity: "day",
    },
    points,
  };
}

async function dimensionBreakdown(
  actor: Actor,
  input: AnalyticsFilters,
  dimension: "source" | "channel",
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const where = eventWhere(actor, filters);
  const db = getPrisma();
  const [visits, clicks, conversions] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: [dimension, "visitorId"],
      where: {
        ...where,
        [dimension]: { not: null },
        visitorId: { not: null },
      },
    }),
    db.analyticsEvent.groupBy({
      by: [dimension],
      where: {
        ...where,
        name: { in: clickEvents },
        [dimension]: { not: null },
      },
      _count: { _all: true },
    }),
    db.analyticsConversion.groupBy({
      by: [dimension],
      where: { ...conversionWhere(actor, filters), [dimension]: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const items = new Map<
    string,
    { visitors: number; clicks: number; conversions: number }
  >();
  for (const row of visits) {
    const key = row[dimension];
    if (key) {
      const values = items.get(key) ?? {
        visitors: 0,
        clicks: 0,
        conversions: 0,
      };
      values.visitors += 1;
      items.set(key, values);
    }
  }
  for (const row of clicks) {
    const key = row[dimension];
    if (key)
      items.set(key, {
        ...(items.get(key) ?? { visitors: 0, conversions: 0 }),
        clicks: row._count._all,
      });
  }
  for (const row of conversions) {
    const key = row[dimension];
    if (key)
      items.set(key, {
        ...(items.get(key) ?? { visitors: 0, clicks: 0 }),
        conversions: row._count._all,
      });
  }
  const result = {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...items.entries()]
      .map(([name, values]) => ({
        name,
        ...values,
        ctr: values.visitors
          ? Number(((values.clicks / values.visitors) * 100).toFixed(1))
          : 0,
        conversionRate: conversionRate(values.conversions, values.visitors),
      }))
      .sort((left, right) => right.visitors - left.visitors),
  };
  return {
    ...result,
    items: filters.advancedAnalytics ? result.items : result.items.slice(0, 5),
    locked: !filters.advancedAnalytics,
  };
}

export function analyticsSources(actor: Actor, input: AnalyticsFilters) {
  return dimensionBreakdown(actor, input, "source");
}

export function analyticsChannels(actor: Actor, input: AnalyticsFilters) {
  return dimensionBreakdown(actor, input, "channel").then((result) =>
    result.locked ? { ...result, items: [] } : result,
  );
}

export async function analyticsAssets(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const db = getPrisma();
  const [visitors, clicks, conversions, scans] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["assetType", "assetId", "visitorId"],
      where: {
        ...eventWhere(actor, filters),
        assetType: { not: null },
        assetId: { not: null },
        visitorId: { not: null },
      },
    }),
    db.analyticsEvent.groupBy({
      by: ["assetType", "assetId"],
      where: {
        ...eventWhere(actor, filters),
        assetType: { not: null },
        assetId: { not: null },
        name: { in: clickEvents },
      },
      _count: { _all: true },
    }),
    db.analyticsConversion.groupBy({
      by: ["assetType", "assetId"],
      where: {
        ...conversionWhere(actor, filters),
        assetType: { not: null },
        assetId: { not: null },
      },
      _count: { _all: true },
    }),
    db.analyticsEvent.groupBy({
      by: ["assetType", "assetId"],
      where: {
        ...eventWhere(actor, filters),
        assetType: "qr_code",
        assetId: { not: null },
        name: "qr_scan",
      },
      _count: { _all: true },
    }),
  ]);
  const assets = new Map<
    string,
    {
      assetType: string;
      assetId: string;
      visitors: number;
      clicks: number;
      scans: number;
      conversions: number;
    }
  >();
  for (const row of visitors) {
    if (!row.assetType || !row.assetId) continue;
    const key = `${row.assetType}:${row.assetId}`;
    const item = assets.get(key) ?? {
      assetType: row.assetType,
      assetId: row.assetId,
      visitors: 0,
      clicks: 0,
      scans: 0,
      conversions: 0,
    };
    item.visitors += 1;
    assets.set(key, item);
  }
  for (const row of clicks) {
    if (!row.assetType || !row.assetId) continue;
    const key = `${row.assetType}:${row.assetId}`;
    const item = assets.get(key) ?? {
      assetType: row.assetType,
      assetId: row.assetId,
      visitors: 0,
      clicks: 0,
      scans: 0,
      conversions: 0,
    };
    item.clicks += row._count._all;
    assets.set(key, item);
  }
  for (const row of conversions) {
    if (!row.assetType || !row.assetId) continue;
    const key = `${row.assetType}:${row.assetId}`;
    const item = assets.get(key) ?? {
      assetType: row.assetType,
      assetId: row.assetId,
      visitors: 0,
      clicks: 0,
      scans: 0,
      conversions: 0,
    };
    item.conversions += row._count._all;
    assets.set(key, item);
  }
  for (const row of scans) {
    if (!row.assetType || !row.assetId) continue;
    const key = `${row.assetType}:${row.assetId}`;
    const item = assets.get(key) ?? {
      assetType: row.assetType,
      assetId: row.assetId,
      visitors: 0,
      clicks: 0,
      scans: 0,
      conversions: 0,
    };
    item.scans += row._count._all;
    assets.set(key, item);
  }
  const assetDetails = await listAnalyticsAssetDetails(actor, [
    ...assets.values(),
  ]);
  const result = {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...assets.values()]
      .map((item) => ({
        ...item,
        name:
          assetDetails.get(`${item.assetType}:${item.assetId}`)?.name ??
          item.assetId,
        context:
          assetDetails.get(`${item.assetType}:${item.assetId}`)?.context ??
          null,
        interactions: item.clicks + item.scans,
        ctr: item.visitors
          ? Number(((item.clicks / item.visitors) * 100).toFixed(1))
          : 0,
        conversionRate: conversionRate(item.conversions, item.visitors),
      }))
      .sort((left, right) => right.visitors - left.visitors),
  };
  return {
    ...result,
    items: filters.advancedAnalytics ? result.items : result.items.slice(0, 5),
    locked: !filters.advancedAnalytics,
  };
}

async function listAnalyticsAssetDetails(
  actor: Actor,
  assets: Array<{ assetType: string; assetId: string }>,
): Promise<Map<string, { name: string; context: string | null }>> {
  const idsFor = (assetType: string) =>
    assets
      .filter((asset) => asset.assetType === assetType)
      .map((asset) => asset.assetId);
  const [pages, cards, links, qrCodes] = await Promise.all([
    getPrisma().smartPage.findMany({
      where: {
        workspaceId: actor.workspaceId,
        id: { in: idsFor("smart_page") },
      },
      select: { id: true, title: true },
    }),
    getPrisma().smartCard.findMany({
      where: {
        workspaceId: actor.workspaceId,
        id: { in: idsFor("smart_card") },
      },
      select: { id: true, firstName: true, lastName: true },
    }),
    getPrisma().shortLink.findMany({
      where: { workspaceId: actor.workspaceId, id: { in: idsFor("link") } },
      select: { id: true, slug: true, title: true },
    }),
    getPrisma().qrAsset.findMany({
      where: { workspaceId: actor.workspaceId, id: { in: idsFor("qr_code") } },
      select: { id: true, name: true, context: true },
    }),
  ]);
  const details = new Map<string, { name: string; context: string | null }>();
  for (const page of pages)
    details.set(`smart_page:${page.id}`, {
      name: page.title,
      context: null,
    });
  for (const card of cards)
    details.set(`smart_card:${card.id}`, {
      name: `${card.firstName} ${card.lastName}`.trim(),
      context: null,
    });
  for (const link of links)
    details.set(`link:${link.id}`, {
      name: link.title || link.slug,
      context: null,
    });
  for (const qrCode of qrCodes)
    details.set(`qr_code:${qrCode.id}`, {
      name: qrCode.name,
      context: qrCode.context,
    });
  return details;
}

export async function analyticsConversions(
  actor: Actor,
  input: AnalyticsFilters,
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const items = await getPrisma().analyticsConversion.findMany({
    where: conversionWhere(actor, filters),
    include: {
      goal: { select: { id: true, name: true, goalType: true } },
      event: { select: { eventId: true, name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items,
  };
}

export async function analyticsGoals(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const db = getPrisma();
  const [conversionRows, visitorRows, goals] = await Promise.all([
    db.analyticsConversion.groupBy({
      by: ["goalId"],
      where: conversionWhere(actor, filters),
      _count: { _all: true },
    }),
    db.analyticsConversion.groupBy({
      by: ["goalId", "visitorId"],
      where: {
        ...conversionWhere(actor, filters),
        visitorId: { not: null },
      },
    }),
    db.analyticsGoal.findMany({
      where: { workspaceId: actor.workspaceId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, goalType: true, isPrimary: true },
    }),
  ]);
  const visitorsByGoal = new Map<string, number>();
  for (const row of visitorRows) {
    if (row.visitorId)
      visitorsByGoal.set(row.goalId, (visitorsByGoal.get(row.goalId) ?? 0) + 1);
  }
  const goalsById = new Map(goals.map((goal) => [goal.id, goal]));
  const items = conversionRows
    .map((row) => {
      const goal = goalsById.get(row.goalId);
      const visitors = visitorsByGoal.get(row.goalId) ?? 0;
      return {
        goalId: row.goalId,
        name: goal?.name ?? row.goalId,
        goalType: goal?.goalType ?? null,
        isPrimary: goal?.isPrimary ?? false,
        conversions: row._count._all,
        visitors,
        conversionRate: conversionRate(row._count._all, visitors),
      };
    })
    .sort((left, right) => right.conversions - left.conversions);
  const primaryGoal = goals.find((goal) => goal.isPrimary);
  const primary = primaryGoal
    ? (items.find((item) => item.goalId === primaryGoal.id) ?? {
        goalId: primaryGoal.id,
        name: primaryGoal.name,
        goalType: primaryGoal.goalType,
        isPrimary: true,
        conversions: 0,
        visitors: 0,
        conversionRate: 0,
      })
    : null;
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items,
    primary,
    goalOptions: goals.map((goal) => ({ id: goal.id, name: goal.name })),
  };
}

type UtmConversionRow = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  conversions: bigint;
};

function utmKey(
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null,
) {
  return [utmSource ?? "", utmMedium ?? "", utmCampaign ?? ""].join("\u0000");
}

export async function analyticsUtms(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const db = getPrisma();
  const conversionConditions = [
    Prisma.sql`conversion."workspaceId" = ${actor.workspaceId}`,
    Prisma.sql`conversion."occurredAt" >= ${filters.from}`,
    Prisma.sql`conversion."occurredAt" <= ${filters.to}`,
    Prisma.sql`conversion."isBot" = false`,
    Prisma.sql`conversion."isTest" = false`,
  ];
  if (filters.goalId)
    conversionConditions.push(
      Prisma.sql`conversion."goalId" = ${filters.goalId}`,
    );
  if (filters.assetType)
    conversionConditions.push(
      Prisma.sql`conversion."assetType" = ${filters.assetType}`,
    );
  if (filters.assetId)
    conversionConditions.push(
      Prisma.sql`conversion."assetId" = ${filters.assetId}`,
    );
  if (filters.campaignId)
    conversionConditions.push(
      Prisma.sql`conversion."campaignId" = ${filters.campaignId}`,
    );
  if (filters.source)
    conversionConditions.push(
      Prisma.sql`conversion."source" = ${filters.source}`,
    );
  if (filters.channel)
    conversionConditions.push(
      Prisma.sql`conversion."channel" = ${filters.channel}`,
    );
  const [visitorRows, clickRows, conversionRows] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium", "utmCampaign", "visitorId"],
      where: {
        ...eventWhere(actor, filters),
        utmSource: { not: null },
        visitorId: { not: null },
      },
    }),
    db.analyticsEvent.groupBy({
      by: ["utmSource", "utmMedium", "utmCampaign"],
      where: {
        ...eventWhere(actor, filters),
        utmSource: { not: null },
        name: { in: clickEvents },
      },
      _count: { _all: true },
    }),
    db.$queryRaw<UtmConversionRow[]>(Prisma.sql`
      SELECT
        event."utmSource" AS "utmSource",
        event."utmMedium" AS "utmMedium",
        event."utmCampaign" AS "utmCampaign",
        COUNT(*)::bigint AS "conversions"
      FROM "AnalyticsConversion" AS conversion
      INNER JOIN "AnalyticsEvent" AS event ON event."id" = conversion."eventId"
      WHERE ${Prisma.join(conversionConditions, " AND ")}
        AND event."utmSource" IS NOT NULL
      GROUP BY 1, 2, 3
    `),
  ]);
  const items = new Map<
    string,
    {
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      visitors: number;
      clicks: number;
      conversions: number;
    }
  >();
  const getItem = (
    utmSource: string | null,
    utmMedium: string | null,
    utmCampaign: string | null,
  ) => {
    const key = utmKey(utmSource, utmMedium, utmCampaign);
    const existing = items.get(key);
    if (existing) return existing;
    const created = {
      utmSource,
      utmMedium,
      utmCampaign,
      visitors: 0,
      clicks: 0,
      conversions: 0,
    };
    items.set(key, created);
    return created;
  };
  for (const row of visitorRows)
    getItem(row.utmSource, row.utmMedium, row.utmCampaign).visitors += 1;
  for (const row of clickRows)
    getItem(row.utmSource, row.utmMedium, row.utmCampaign).clicks +=
      row._count._all;
  for (const row of conversionRows)
    getItem(row.utmSource, row.utmMedium, row.utmCampaign).conversions +=
      Number(row.conversions);
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...items.values()]
      .map((item) => ({
        ...item,
        conversionRate: conversionRate(item.conversions, item.visitors),
      }))
      .sort(
        (left, right) =>
          right.conversions - left.conversions ||
          right.visitors - left.visitors,
      ),
  };
}

export async function analyticsCampaigns(
  actor: Actor,
  input: AnalyticsFilters,
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  const db = getPrisma();
  const [visitorRows, clickRows, conversionRows, campaigns, primaryGoals] =
    await Promise.all([
      db.analyticsEvent.groupBy({
        by: ["campaignId", "visitorId"],
        where: {
          ...eventWhere(actor, filters),
          campaignId: { not: null },
          visitorId: { not: null },
        },
      }),
      db.analyticsEvent.groupBy({
        by: ["campaignId"],
        where: {
          ...eventWhere(actor, filters),
          campaignId: { not: null },
          name: { in: clickEvents },
        },
        _count: { _all: true },
      }),
      db.analyticsConversion.groupBy({
        by: ["campaignId"],
        where: {
          ...conversionWhere(actor, filters),
          campaignId: { not: null },
        },
        _count: { _all: true },
      }),
      db.campaign.findMany({
        where: { workspaceId: actor.workspaceId },
        select: { id: true, name: true },
      }),
      db.analyticsGoal.findMany({
        where: {
          workspaceId: actor.workspaceId,
          scopeType: "CAMPAIGN",
          isPrimary: true,
          status: { not: "ARCHIVED" },
        },
        select: { scopeId: true, id: true, name: true, goalType: true },
      }),
    ]);
  const items = new Map<
    string,
    { visitors: number; clicks: number; conversions: number }
  >();
  for (const row of visitorRows) {
    if (!row.campaignId) continue;
    const item = items.get(row.campaignId) ?? {
      visitors: 0,
      clicks: 0,
      conversions: 0,
    };
    item.visitors += 1;
    items.set(row.campaignId, item);
  }
  for (const row of clickRows) {
    if (!row.campaignId) continue;
    const item = items.get(row.campaignId) ?? {
      visitors: 0,
      clicks: 0,
      conversions: 0,
    };
    item.clicks += row._count._all;
    items.set(row.campaignId, item);
  }
  for (const row of conversionRows) {
    if (!row.campaignId) continue;
    const item = items.get(row.campaignId) ?? {
      visitors: 0,
      clicks: 0,
      conversions: 0,
    };
    item.conversions += row._count._all;
    items.set(row.campaignId, item);
  }
  const names = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.name]),
  );
  const goals = new Map(
    primaryGoals.flatMap((goal) =>
      goal.scopeId
        ? [
            [
              goal.scopeId,
              { id: goal.id, name: goal.name, goalType: goal.goalType },
            ],
          ]
        : [],
    ),
  );
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...items.entries()]
      .map(([campaignId, values]) => ({
        campaignId,
        name: names.get(campaignId) ?? campaignId,
        ...values,
        conversionRate: conversionRate(values.conversions, values.visitors),
        primaryGoal: goals.get(campaignId) ?? null,
      }))
      .sort((left, right) => right.visitors - left.visitors),
  };
}

export async function analyticsLocations(
  actor: Actor,
  input: AnalyticsFilters,
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  if (!filters.advancedAnalytics)
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      items: [],
      locked: true,
    };
  const rows = await getPrisma().analyticsEvent.groupBy({
    by: ["country", "region", "city"],
    where: { ...eventWhere(actor, filters), country: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: 100,
  });
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: rows.flatMap((row) =>
      row.country && row._count._all >= 5
        ? [
            {
              country: row.country,
              region: row.region,
              city: row.city,
              events: row._count._all,
            },
          ]
        : [],
    ),
  };
}

export async function analyticsTechnology(
  actor: Actor,
  input: AnalyticsFilters,
) {
  const filters = await resolveAnalyticsFilters(actor, input);
  if (!filters.advancedAnalytics)
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      devices: [],
      operatingSystems: [],
      browsers: [],
      locked: true,
    };
  const where = eventWhere(actor, filters);
  const db = getPrisma();
  const [devices, operatingSystems, browsers] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["deviceType"],
      where: { ...where, deviceType: { not: null } },
      _count: { _all: true },
    }),
    db.analyticsEvent.groupBy({
      by: ["os"],
      where: { ...where, os: { not: null } },
      _count: { _all: true },
    }),
    db.analyticsEvent.groupBy({
      by: ["browser"],
      where: { ...where, browser: { not: null } },
      _count: { _all: true },
    }),
  ]);
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    devices: devices.flatMap((row) =>
      row.deviceType ? [{ name: row.deviceType, events: row._count._all }] : [],
    ),
    operatingSystems: operatingSystems.flatMap((row) =>
      row.os ? [{ name: row.os, events: row._count._all }] : [],
    ),
    browsers: browsers.flatMap((row) =>
      row.browser ? [{ name: row.browser, events: row._count._all }] : [],
    ),
  };
}

export async function analyticsTime(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  if (!filters.advancedAnalytics)
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      items: [],
      locked: true,
    };
  const conditions = [
    Prisma.sql`"workspaceId" = ${actor.workspaceId}`,
    Prisma.sql`"occurredAt" >= ${filters.from}`,
    Prisma.sql`"occurredAt" <= ${filters.to}`,
    Prisma.sql`"isBot" = false`,
    Prisma.sql`"isTest" = false`,
  ];
  if (filters.assetType)
    conditions.push(Prisma.sql`"assetType" = ${filters.assetType}`);
  if (filters.assetId)
    conditions.push(Prisma.sql`"assetId" = ${filters.assetId}`);
  if (filters.campaignId)
    conditions.push(Prisma.sql`"campaignId" = ${filters.campaignId}`);
  const rows = await getPrisma().$queryRaw<
    Array<{ weekday: number; hour: number; events: bigint }>
  >(Prisma.sql`
    SELECT
      EXTRACT(DOW FROM "occurredAt")::int AS "weekday",
      EXTRACT(HOUR FROM "occurredAt")::int AS "hour",
      COUNT(*)::bigint AS "events"
    FROM "AnalyticsEvent"
    WHERE ${Prisma.join(conditions, " AND ")}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: rows.map((row) => ({
      weekday: row.weekday,
      hour: row.hour,
      events: Number(row.events),
    })),
  };
}

export async function analyticsJourneys(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveAnalyticsFilters(actor, input);
  if (!filters.advancedAnalytics)
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      sampled: false,
      items: [],
      locked: true,
    };
  const events = await getPrisma().analyticsEvent.findMany({
    where: { ...eventWhere(actor, filters), sessionId: { not: null } },
    select: {
      sessionId: true,
      source: true,
      name: true,
      assetType: true,
      occurredAt: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 5_000,
  });
  const journeys = new Map<string, { source: string; steps: string[] }>();
  for (const event of [...events].reverse()) {
    if (!event.sessionId) continue;
    const journey = journeys.get(event.sessionId) ?? {
      source: event.source ?? "direct",
      steps: [],
    };
    const step = event.assetType
      ? `${event.name}:${event.assetType}`
      : event.name;
    if (journey.steps.at(-1) !== step && journey.steps.length < 5)
      journey.steps.push(step);
    journeys.set(event.sessionId, journey);
  }
  const items = new Map<string, number>();
  for (const journey of journeys.values()) {
    if (journey.steps.length < 2) continue;
    const key = [journey.source, ...journey.steps].join(" -> ");
    items.set(key, (items.get(key) ?? 0) + 1);
  }
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    sampled: events.length === 5_000,
    items: [...items.entries()]
      .map(([journey, sessions]) => ({ journey, sessions }))
      .sort((left, right) => right.sessions - left.sessions)
      .slice(0, 20),
  };
}
