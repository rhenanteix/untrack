import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { DashboardEventTracker } from "@/components/untrack/dashboard-event-tracker";
import { DashboardHome } from "@/components/untrack/dashboard-home";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
export const metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
};

const DAY = 24 * 60 * 60 * 1000;
const periods = [7, 30, 90] as const;
type Period = (typeof periods)[number];

function periodFrom(value: string | string[] | undefined): Period {
  const candidate = Number(Array.isArray(value) ? value[0] : value);
  return periods.includes(candidate as (typeof periods)[number])
    ? (candidate as Period)
    : 30;
}

function clickSeries(
  days: number,
  rows: { day: Date; _count: { _all: number } }[],
) {
  const values = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), row._count._all]),
  );
  const series = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  for (let index = 0; index < days; index++) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    series.push({
      label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      value: values.get(day.toISOString().slice(0, 10)) ?? 0,
    });
  }
  return series;
}

async function overview(userId: string, requestHeaders: Headers, days: Period) {
  try {
    const actor = await actorFor(userId, requestHeaders),
      db = getPrisma(),
      where = { workspaceId: actor.workspaceId },
      since = new Date(Date.now() - days * DAY),
      clickWhere = { link: where, createdAt: { gte: since } },
      smartPageViewWhere = {
        ...where,
        name: "smart_page_view",
        occurredAt: { gte: since },
      },
      smartPageClickWhere = {
        ...where,
        name: { in: ["smart_block_clicked", "link_in_bio_product_click"] },
        occurredAt: { gte: since },
      };
    const [
      campaigns,
      links,
      pages,
      smartCards,
      publishedPages,
      featuredSmartPage,
      clicks,
      clickDays,
      smartPageViews,
      smartPageVisitors,
      smartPageClicks,
      topLinkClicks,
    ] = await Promise.all([
      db.campaign.count({ where: { ...where, status: "active" } }),
      db.shortLink.count({ where: { ...where, isActive: true } }),
      db.smartPage.count({ where }),
      db.smartCard.count({ where }),
      db.smartPage.count({ where: { ...where, status: "published" } }),
      db.smartPage.findFirst({
        where: { ...where, status: "published" },
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          _count: {
            select: {
              analyticsEvents: { where: smartPageViewWhere },
            },
          },
        },
      }),
      db.linkClick.count({ where: clickWhere }),
      db.linkClick.groupBy({
        by: ["day"],
        where: clickWhere,
        _count: { _all: true },
        orderBy: { day: "asc" },
      }),
      db.analyticsEvent.count({ where: smartPageViewWhere }),
      db.analyticsEvent.groupBy({
        by: ["visitorHash"],
        where: { ...smartPageViewWhere, visitorHash: { not: null } },
      }),
      db.analyticsEvent.count({ where: smartPageClickWhere }),
      db.linkClick.groupBy({
        by: ["linkId"],
        where: clickWhere,
        _count: { _all: true },
        orderBy: { _count: { linkId: "desc" } },
        take: 3,
      }),
    ]);
    const topLinkRecords = topLinkClicks.length
      ? await db.shortLink.findMany({
          where: { ...where, id: { in: topLinkClicks.map((item) => item.linkId) } },
          select: { id: true, slug: true, title: true },
        })
      : [];
    const topLinkById = new Map(topLinkRecords.map((item) => [item.id, item]));
    return {
      ok: true as const,
      actor,
      campaigns,
      links,
      pages,
      smartCards,
      publishedPages,
      featuredSmartPage: featuredSmartPage
        ? {
            id: featuredSmartPage.id,
            slug: featuredSmartPage.slug,
            title: featuredSmartPage.title,
            views: featuredSmartPage._count.analyticsEvents,
          }
        : null,
      clicks,
      clickDays,
      smartPageViews,
      smartPageVisitors: smartPageVisitors.length,
      smartPageClicks,
      topLinks: topLinkClicks.flatMap((item) => {
        const link = topLinkById.get(item.linkId);
        return link ? [{ ...link, clicks: item._count._all }] : [];
      }),
    };
  } catch (error) {
    return { ok: false as const, error: workspaceLoadError(error) };
  }
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period } = await searchParams;
  const days = periodFrom(period);
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/conta");
  const [data, access] = await Promise.all([
    overview(session.user.id, requestHeaders, days),
    getAccountAccessForUser(session.user.id),
  ]);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const canWrite = data.actor.role !== "viewer";
  const series = clickSeries(days, data.clickDays);
  const userName = session.user.name.trim().split(/\s+/, 1)[0] || "por aqui";
  return (
    <>
      <DashboardEventTracker access={access} />
      <DashboardHome
        canWrite={canWrite}
        greeting={greeting()}
        userName={userName}
        access={access}
        days={days}
        assets={{
          links: data.links,
          campaigns: data.campaigns,
          smartPages: data.pages,
          smartCards: data.smartCards,
          publishedSmartPages: data.publishedPages,
          featuredSmartPage: data.featuredSmartPage,
        }}
        metrics={{
          views: data.smartPageViews,
          visitors: data.smartPageVisitors,
          clicks: data.clicks,
          ctr: data.smartPageViews
            ? Math.round((data.smartPageClicks / data.smartPageViews) * 100)
            : null,
        }}
        performance={{ series, clicks: data.clicks }}
        topLinks={data.topLinks}
      />
    </>
  );
}
