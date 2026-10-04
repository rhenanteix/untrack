import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
import { canUse, getAnalyticsHistoryDays } from "@/modules/billing/entitlements";
import type { Actor } from "@/modules/workspaces/context";
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
  assetType?: AnalyticsAssetType;
  assetId?: string;
  campaignId?: string;
};

type ResolvedFilters = AnalyticsFilters & {
  from: Date;
  to: Date;
  historyDays: number;
  advancedAnalytics: boolean;
};

function startOfDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function endOfDay(value: Date) {
  const result = startOfDay(value);
  result.setUTCDate(result.getUTCDate() + 1);
  result.setMilliseconds(-1);
  return result;
}

async function resolveFilters(actor: Actor, filters: AnalyticsFilters) {
  const access = await getAccountAccessForUser(actor.userId);
  const historyDays = getAnalyticsHistoryDays(access);
  const today = startOfDay(new Date());
  const earliest = new Date(today);
  earliest.setUTCDate(earliest.getUTCDate() - historyDays + 1);
  const requestedFrom = filters.from ? startOfDay(filters.from) : earliest;
  const requestedTo = filters.to ? endOfDay(filters.to) : endOfDay(new Date());
  return {
    ...filters,
    from: requestedFrom < earliest ? earliest : requestedFrom,
    to: requestedTo,
    historyDays,
    advancedAnalytics: canUse(access, "advancedAnalytics"),
  } satisfies ResolvedFilters;
}

function eventWhere(actor: Actor, filters: ResolvedFilters) {
  return {
    workspaceId: actor.workspaceId,
    occurredAt: { gte: filters.from, lte: filters.to },
    isBot: false,
    isTest: false,
    ...(filters.assetType ? { assetType: filters.assetType } : {}),
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  };
}

async function totals(actor: Actor, filters: ResolvedFilters) {
  const db = getPrisma();
  const where = eventWhere(actor, filters);
  const [views, clicks, conversions, visitors, sessions] = await Promise.all([
    db.analyticsEvent.count({ where: { ...where, name: { in: viewEvents } } }),
    db.analyticsEvent.count({ where: { ...where, name: { in: clickEvents } } }),
    db.analyticsEvent.count({ where: { ...where, name: "goal_completed" } }),
    db.analyticsEvent.groupBy({
      by: ["visitorHash"],
      where: { ...where, visitorHash: { not: null } },
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
    ctr: views ? Number(((clicks / views) * 100).toFixed(1)) : 0,
    conversions,
    conversionRate: views
      ? Number(((conversions / views) * 100).toFixed(1))
      : 0,
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
  const filters = await resolveFilters(actor, input);
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
      conversions: previous ? change(current.conversions, previous.conversions) : null,
    },
  };
}

export async function analyticsTimeseries(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveFilters(actor, input);
  const [rows, visitorRows] = await Promise.all([
    getPrisma().analyticsEvent.groupBy({
      by: ["day", "name"],
      where: {
        ...eventWhere(actor, filters),
        day: { not: null },
        name: { in: [...viewEvents, ...clickEvents, "goal_completed"] },
      },
      _count: { _all: true },
    }),
    getPrisma().analyticsEvent.groupBy({
      by: ["day", "visitorHash"],
      where: {
        ...eventWhere(actor, filters),
        day: { not: null },
        visitorHash: { not: null },
        name: { in: viewEvents },
      },
    }),
  ]);
  const byDay = new Map<string, { visitors: number; views: number; clicks: number; conversions: number }>();
  for (const row of rows) {
    if (!row.day) continue;
    const key = row.day.toISOString().slice(0, 10);
    const values = byDay.get(key) ?? { visitors: 0, views: 0, clicks: 0, conversions: 0 };
    if (viewEvents.includes(row.name)) values.views += row._count._all;
    if (clickEvents.includes(row.name)) values.clicks += row._count._all;
    if (row.name === "goal_completed") values.conversions += row._count._all;
    byDay.set(key, values);
  }
  for (const row of visitorRows) {
    if (!row.day || !row.visitorHash) continue;
    const key = row.day.toISOString().slice(0, 10);
    const values = byDay.get(key) ?? { visitors: 0, views: 0, clicks: 0, conversions: 0 };
    values.visitors += 1;
    byDay.set(key, values);
  }
  const points = [];
  for (let day = startOfDay(filters.from); day <= filters.to; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    points.push({ date, ...(byDay.get(date) ?? { visitors: 0, views: 0, clicks: 0, conversions: 0 }) });
  }
  return { range: { from: filters.from.toISOString(), to: filters.to.toISOString() }, points };
}

async function dimensionBreakdown(
  actor: Actor,
  input: AnalyticsFilters,
  dimension: "source" | "channel",
) {
  const filters = await resolveFilters(actor, input);
  const where = eventWhere(actor, filters);
  const db = getPrisma();
  const [visits, clicks, conversions] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: [dimension],
      where: { ...where, name: { in: viewEvents }, [dimension]: { not: null } },
      _count: { _all: true },
    }),
    db.analyticsEvent.groupBy({
      by: [dimension],
      where: { ...where, name: { in: clickEvents }, [dimension]: { not: null } },
      _count: { _all: true },
    }),
    db.analyticsEvent.groupBy({
      by: [dimension],
      where: { ...where, name: "goal_completed", [dimension]: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const items = new Map<string, { views: number; clicks: number; conversions: number }>();
  for (const row of visits) {
    const key = row[dimension];
    if (key) items.set(key, { ...(items.get(key) ?? { clicks: 0, conversions: 0 }), views: row._count._all });
  }
  for (const row of clicks) {
    const key = row[dimension];
    if (key) items.set(key, { ...(items.get(key) ?? { views: 0, conversions: 0 }), clicks: row._count._all });
  }
  for (const row of conversions) {
    const key = row[dimension];
    if (key) items.set(key, { ...(items.get(key) ?? { views: 0, clicks: 0 }), conversions: row._count._all });
  }
  const result = {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...items.entries()]
      .map(([name, values]) => ({
        name,
        ...values,
        ctr: values.views ? Number(((values.clicks / values.views) * 100).toFixed(1)) : 0,
        conversionRate: values.views
          ? Number(((values.conversions / values.views) * 100).toFixed(1))
          : 0,
      }))
      .sort((left, right) => right.views - left.views),
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
  const filters = await resolveFilters(actor, input);
  const rows = await getPrisma().analyticsEvent.groupBy({
    by: ["assetType", "assetId", "name"],
    where: {
      ...eventWhere(actor, filters),
      assetType: { not: null },
      assetId: { not: null },
      name: { in: [...viewEvents, ...clickEvents, "goal_completed"] },
    },
    _count: { _all: true },
  });
  const assets = new Map<string, { assetType: string; assetId: string; views: number; clicks: number; conversions: number }>();
  for (const row of rows) {
    if (!row.assetType || !row.assetId) continue;
    const key = `${row.assetType}:${row.assetId}`;
    const item = assets.get(key) ?? { assetType: row.assetType, assetId: row.assetId, views: 0, clicks: 0, conversions: 0 };
    if (viewEvents.includes(row.name)) item.views += row._count._all;
    if (clickEvents.includes(row.name)) item.clicks += row._count._all;
    if (row.name === "goal_completed") item.conversions += row._count._all;
    assets.set(key, item);
  }
  const result = {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    items: [...assets.values()]
      .map((item) => ({
        ...item,
        ctr: item.views ? Number(((item.clicks / item.views) * 100).toFixed(1)) : 0,
        conversionRate: item.views
          ? Number(((item.conversions / item.views) * 100).toFixed(1))
          : 0,
      }))
      .sort((left, right) => right.views - left.views),
  };
  return {
    ...result,
    items: filters.advancedAnalytics ? result.items : result.items.slice(0, 5),
    locked: !filters.advancedAnalytics,
  };
}

export async function analyticsLocations(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveFilters(actor, input);
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
        ? [{ country: row.country, region: row.region, city: row.city, events: row._count._all }]
        : [],
    ),
  };
}

export async function analyticsTechnology(actor: Actor, input: AnalyticsFilters) {
  const filters = await resolveFilters(actor, input);
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
    db.analyticsEvent.groupBy({ by: ["deviceType"], where: { ...where, deviceType: { not: null } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["os"], where: { ...where, os: { not: null } }, _count: { _all: true } }),
    db.analyticsEvent.groupBy({ by: ["browser"], where: { ...where, browser: { not: null } }, _count: { _all: true } }),
  ]);
  return {
    range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
    devices: devices.flatMap((row) =>
      row.deviceType
        ? [{ name: row.deviceType, events: row._count._all }]
        : [],
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
  const filters = await resolveFilters(actor, input);
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
  const filters = await resolveFilters(actor, input);
  if (!filters.advancedAnalytics)
    return {
      range: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      sampled: false,
      items: [],
      locked: true,
    };
  const events = await getPrisma().analyticsEvent.findMany({
    where: { ...eventWhere(actor, filters), sessionId: { not: null } },
    select: { sessionId: true, source: true, name: true, assetType: true, occurredAt: true },
    orderBy: { occurredAt: "desc" },
    take: 5_000,
  });
  const journeys = new Map<string, { source: string; steps: string[] }>();
  for (const event of [...events].reverse()) {
    if (!event.sessionId) continue;
    const journey = journeys.get(event.sessionId) ?? { source: event.source ?? "direct", steps: [] };
    const step = event.assetType ? `${event.name}:${event.assetType}` : event.name;
    if (journey.steps.at(-1) !== step && journey.steps.length < 5) journey.steps.push(step);
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