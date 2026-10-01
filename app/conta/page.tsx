import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sessionFromHeaders } from "@/lib/session";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { DashboardEventTracker } from "@/components/untrack/dashboard-event-tracker";
export const metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
};

const DAY = 24 * 60 * 60 * 1000;
const periods = [7, 30, 90] as const;

function periodFrom(value: string | string[] | undefined) {
  const candidate = Number(Array.isArray(value) ? value[0] : value);
  return periods.includes(candidate as (typeof periods)[number])
    ? candidate
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

function relativeTime(date: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

function sourceName(referrer: string) {
  try {
    return new URL(referrer).hostname;
  } catch {
    return referrer;
  }
}

async function overview(userId: string, requestHeaders: Headers, days: number) {
  try {
    const actor = await actorFor(userId, requestHeaders),
      db = getPrisma(),
      where = { workspaceId: actor.workspaceId },
      since = new Date(Date.now() - days * DAY);
    const [
      workspace,
      campaigns,
      links,
      pages,
      clicks,
      clickDays,
      topLink,
      topSource,
      activity,
      incidents,
    ] = await Promise.all([
      db.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } }),
      db.campaign.count({ where: { ...where, status: "active" } }),
      db.shortLink.count({ where }),
      db.smartPage.count({ where: { ...where, status: "published" } }),
      db.linkClick.count({ where: { link: where, createdAt: { gte: since } } }),
      db.linkClick.groupBy({
        by: ["day"],
        where: { link: where, createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { day: "asc" },
      }),
      db.shortLink.findFirst({
        where,
        orderBy: { clicks: { _count: "desc" } },
        select: {
          id: true,
          title: true,
          slug: true,
          _count: { select: { clicks: { where: { createdAt: { gte: since } } } } },
        },
      }),
      db.linkClick.groupBy({
        by: ["referrer"],
        where: { link: where, createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { referrer: "desc" } },
        take: 1,
      }),
      db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 }),
      db.campaignIncident.findMany({
        where: {
          ...where,
          confirmed: true,
          status: { in: ["open", "confirmed"] },
        },
        include: { campaign: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);
    return {
      ok: true as const,
      actor,
      workspace,
      campaigns,
      links,
      pages,
      clicks,
      clickDays,
      topLink,
      topSource: topSource[0] ?? null,
      activity,
      incidents,
    };
  } catch (error) {
    return { ok: false as const, error: workspaceLoadError(error) };
  }
}
const actionNames: Record<string, string> = {
  "smartPage.created": "Página criada",
  "smartPage.updated": "Página atualizada",
  "smartPage.published": "Página publicada",
  "smartPage.unpublished": "Página despublicada",
  "shortLink.created": "Link criado",
  "shortLink.updated": "Link atualizado",
  "campaign.created": "Campanha criada",
  "campaign.create": "Campanha criada",
  "qr.created": "QR Code criado",
  "utm.created": "UTM criada",
  "whatsappLink.created": "Link do WhatsApp criado",
  "client.created": "Cliente criado",
  "history.created": "Link processado",
  "smartPage.imageUploaded": "Imagem enviada",
};
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
  const data = await overview(session.user.id, requestHeaders, days);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const canWrite = data.actor.role !== "viewer";
  const metrics = [
    {
      label: "Links",
      value: data.links,
      detail: "destinos prontos para compartilhar",
    },
    {
      label: "Campanhas",
      value: data.campaigns,
      detail: "ativas no workspace",
    },
    {
      label: "QR scans",
      value: null,
      detail: "Sem dados suficientes",
    },
    {
      label: "Cliques",
      value: data.clicks,
      detail: `nos últimos ${days} dias`,
    },
  ];
  const startActions = [
    { label: "Criar um link", href: "/untrack/short-links?create=1" },
    { label: "Criar uma campanha", href: "/untrack/campaigns?create=1" },
    { label: "Criar uma Smart Page", href: "/untrack/smart-pages?create=1" },
  ];
  const quickActions = [
    ...startActions,
    { label: "Criar QR Code", href: "/untrack/qr" },
    { label: "Criar UTM", href: "/untrack/utm" },
  ];
  const series = clickSeries(days, data.clickDays);
  const maximum = Math.max(...series.map((point) => point.value), 1);
  const isNewWorkspace =
    data.links === 0 && data.campaigns === 0 && data.pages === 0;
  return (
    <section className="workspace-page workspace-overview">
      <DashboardEventTracker />
      <header className="workspace-page-heading workspace-overview-heading">
        <div>
          <span className="eyebrow">{data.workspace.name}</span>
          <h1>Visão geral</h1>
          <p>Acompanhe seus links, campanhas e resultados.</p>
        </div>
        <div className="workspace-heading-actions">
          <nav className="dashboard-period" aria-label="Período de análise">
            {periods.map((value) => (
              <Link
                key={value}
                href={`/conta?period=${value}`}
                aria-current={value === days ? "page" : undefined}
              >
                {value} dias
              </Link>
            ))}
          </nav>
          {canWrite && (
            <details className="create-menu">
              <summary className="button">Criar</summary>
              <div>
                <Link data-analytics-event="create_action_started" href="/untrack/short-links?create=1">Criar Short Link</Link>
                <Link data-analytics-event="create_action_started" href="/untrack/whatsapp">Criar WhatsApp Link</Link>
                <Link data-analytics-event="create_action_started" href="/untrack/campaigns?create=1">Criar Campanha</Link>
                <Link data-analytics-event="create_action_started" href="/untrack/qr">Criar QR Code</Link>
                <Link data-analytics-event="create_action_started" href="/untrack/utm">Criar UTM</Link>
                <Link data-analytics-event="create_action_started" href="/untrack/smart-pages?create=1">Criar Smart Page</Link>
              </div>
            </details>
          )}
        </div>
      </header>
      {isNewWorkspace ? (
        <section className="workspace-empty-state" aria-labelledby="workspace-empty-heading">
          <span className="eyebrow">Primeiro passo</span>
          <h2 id="workspace-empty-heading">Vamos começar.</h2>
          <p>Crie seu primeiro link, campanha ou Smart Page e acompanhe tudo por aqui.</p>
          {canWrite && (
            <div className="workspace-empty-actions">
              {startActions.map((action) => (
                <Link key={action.href} className="button" data-analytics-event="quick_action_clicked" href={action.href}>
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="workspace-snapshot" aria-labelledby="workspace-snapshot-heading">
            <div className="workspace-section-intro">
              <span className="eyebrow">Panorama</span>
              <h2 id="workspace-snapshot-heading">Seus resultados</h2>
              <p>Um retrato dos recursos e interações do período selecionado.</p>
            </div>
            <dl className="workspace-kpis">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <dt>{metric.label}</dt>
                  <dd>{metric.value ?? "—"}</dd>
                  <small>{metric.detail}</small>
                </div>
              ))}
            </dl>
          </section>
          <section id="desempenho" className="workspace-panel dashboard-chart" aria-labelledby="dashboard-chart-heading">
            <div className="workspace-panel-heading">
              <div>
                <span className="eyebrow">Analytics</span>
                <h2 id="dashboard-chart-heading">Cliques ao longo do tempo</h2>
              </div>
              <p>{data.clicks} cliques no período selecionado.</p>
            </div>
            {data.clicks ? (
              <ol className="dashboard-chart-bars" aria-label="Cliques por dia">
                {series.map((point) => (
                  <li key={point.label}>
                    <span style={{ height: `${Math.max((point.value / maximum) * 100, point.value ? 8 : 2)}%` }} title={`${point.label}: ${point.value} cliques`} />
                    <small>{point.label}</small>
                  </li>
                ))}
              </ol>
            ) : <p>Sem dados suficientes para mostrar a evolução dos cliques.</p>}
          </section>
          <section className="workspace-dashboard-section" aria-labelledby="performance-heading">
            <div className="workspace-section-intro">
              <span className="eyebrow">Desempenho</span>
              <h2 id="performance-heading">O que está acontecendo?</h2>
            </div>
            <div className="workspace-performance-grid">
              <div>
                <span>Link com mais cliques</span>
                {data.topLink ? <><strong>{data.topLink.title || data.topLink.slug}</strong><small>{data.topLink._count.clicks} cliques no período · Sem dados de variação</small></> : <small>Sem dados suficientes</small>}
              </div>
              <div>
                <span>Campanha com melhor desempenho</span>
                <small>Sem dados suficientes para comparar campanhas.</small>
              </div>
              <div>
                <span>Fonte com maior tráfego</span>
                {data.topSource ? <><strong>{sourceName(data.topSource.referrer)}</strong><small>{data.topSource._count._all} cliques no período</small></> : <small>Sem dados suficientes</small>}
              </div>
            </div>
          </section>
          <div className="workspace-overview-grid workspace-activity-grid">
            <section id="atencao" className="workspace-panel workspace-attention">
              <div className="workspace-panel-heading">
                <div><span className="eyebrow">Atenção</span><h2>Precisa de atenção</h2></div>
                <p>Ocorrências confirmadas pela monitoração das campanhas.</p>
              </div>
              {data.incidents.length ? (
                <ul className="workspace-attention-list">
                  {data.incidents.map((item) => (
                    <li key={item.id}><div><Link href={`/untrack/campaigns/${item.campaignId}`}>{item.campaign.name}</Link><p>{item.message}</p></div><Link className="workspace-inline-link" href={`/untrack/campaigns/${item.campaignId}`}>Ver campanha</Link></li>
                  ))}
                </ul>
              ) : <div className="workspace-attention-empty"><strong>Tudo certo por aqui.</strong><p>Não há incidentes confirmados neste momento.</p></div>}
            </section>
            <section className="workspace-panel">
              <div className="workspace-panel-heading"><div><span className="eyebrow">Registro</span><h2>Atividade recente</h2></div></div>
              <ul className="workspace-recent">
                {data.activity.map((item) => (
                  <li key={item.id}><span>{actionNames[item.action] ?? "Alteração registrada no workspace"}</span><time dateTime={item.createdAt.toISOString()}>{relativeTime(item.createdAt)}</time></li>
                ))}
              </ul>
              {!data.activity.length && <p>Nenhuma alteração registrada ainda.</p>}
            </section>
          </div>
          {canWrite && (
            <section className="workspace-dashboard-section workspace-quick-actions" aria-labelledby="quick-actions-heading">
              <div className="workspace-section-intro"><span className="eyebrow">Acesso rápido</span><h2 id="quick-actions-heading">Comece rapidamente</h2></div>
              <div>
                {quickActions.map((action) => <Link key={action.href} className="button button-secondary" data-analytics-event="quick_action_clicked" href={action.href}>{action.label}</Link>)}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
