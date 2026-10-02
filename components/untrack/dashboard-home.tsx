import Link from "next/link";
import {
  FiArrowRight,
  FiBarChart2,
  FiEye,
  FiGrid,
  FiLink,
  FiMousePointer,
  FiPercent,
  FiPlus,
  FiTarget,
  FiUsers,
} from "react-icons/fi";
import { WorkspaceCommandPalette } from "./workspace-command-palette";
import { SetupChecklist } from "./setup-checklist";
import { CreateLauncher } from "./create-launcher";

const periods = [7, 30, 90] as const;

type Period = (typeof periods)[number];

type SeriesPoint = {
  label: string;
  value: number;
};

type SmartPageAsset = {
  id: string;
  slug: string;
  title: string;
  views: number;
} | null;

type TopLink = {
  id: string;
  slug: string;
  title: string;
  clicks: number;
};

export type DashboardHomeProps = {
  canWrite: boolean;
  greeting: string;
  userName: string;
  days: Period;
  assets: {
    links: number;
    campaigns: number;
    smartPages: number;
    smartCards: number;
    publishedSmartPages: number;
    featuredSmartPage: SmartPageAsset;
  };
  metrics: {
    views: number;
    visitors: number;
    clicks: number;
    ctr: number | null;
  };
  performance: {
    series: SeriesPoint[];
    clicks: number;
  };
  topLinks: TopLink[];
};

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

function sampleSeries(series: SeriesPoint[], limit = 7) {
  if (series.length <= limit) return series;
  const indexes = new Set<number>();
  for (let index = 0; index < limit; index++) {
    indexes.add(Math.round((index * (series.length - 1)) / (limit - 1)));
  }
  return [...indexes].map((index) => series[index]);
}

function DashboardHeader({
  canWrite,
  greeting,
  userName,
}: Pick<DashboardHomeProps, "canWrite" | "greeting" | "userName">) {
  return (
    <header className="dashboard-home-header">
      <div>
        <h1>
          {greeting}, {userName} <span aria-hidden="true">👋</span>
        </h1>
        <p>Acompanhe seus links, páginas e campanhas em um só lugar.</p>
      </div>
      <div className="dashboard-header-actions">
        <WorkspaceCommandPalette />
        {canWrite ? <CreateLauncher /> : null}
      </div>
    </header>
  );
}

function AssetCard({
  icon,
  title,
  status,
  description,
  href,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  description: string;
  href: string;
  action: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="dashboard-card dashboard-asset-card">
      <div className="dashboard-asset-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="dashboard-asset-content">
        <div>
          <h3>{title}</h3>
          <p>{status}</p>
        </div>
        <p className="dashboard-asset-description">{description}</p>
        {children}
      </div>
      <Link className="dashboard-card-link" href={href}>
        <span>{action}</span>
        <FiArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="dashboard-card dashboard-metric-card">
      <div className="dashboard-metric-heading">
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function PerformanceChart({ series }: { series: SeriesPoint[] }) {
  const points = sampleSeries(series);
  const maximum = Math.max(...points.map((point) => point.value), 1);
  const coordinates = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 34 - (point.value / maximum) * 26;
    return { ...point, x, y };
  });
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className="dashboard-performance-chart">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolução de cliques no período selecionado"
      >
        <line x1="0" x2="100" y1="34" y2="34" />
        <polyline points={polyline} />
        {coordinates.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="1.6">
            <title>{`${point.label}: ${point.value} cliques`}</title>
          </circle>
        ))}
      </svg>
      <div className="dashboard-chart-ticks" aria-hidden="true">
        <span>{points[0]?.label}</span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  );
}

function PerformanceCard({
  days,
  performance,
}: Pick<DashboardHomeProps, "days" | "performance">) {
  return (
    <section
      id="desempenho"
      className="dashboard-card dashboard-performance-card"
      aria-labelledby="performance-heading"
    >
      <div className="dashboard-card-heading">
        <div>
          <h2 id="performance-heading">Desempenho</h2>
          <p>{plural(performance.clicks, "clique")} nos últimos {days} dias</p>
        </div>
        <nav className="dashboard-period" aria-label="Período de análise">
          {periods.map((value) => (
            <Link
              key={value}
              href={`/conta?period=${value}`}
              aria-current={value === days ? "page" : undefined}
            >
              {value}d
            </Link>
          ))}
        </nav>
      </div>
      {performance.clicks ? (
        <PerformanceChart series={performance.series} />
      ) : (
        <div className="dashboard-low-data">
          <FiBarChart2 aria-hidden="true" />
          <div>
            <strong>Ainda estamos coletando dados</strong>
            <p>Compartilhe seus links para começar a visualizar tendências.</p>
          </div>
          <Link href="/untrack/short-links">Ver meus links</Link>
        </div>
      )}
    </section>
  );
}

function TopLinksCard({ topLinks }: Pick<DashboardHomeProps, "topLinks">) {
  return (
    <section
      className="dashboard-card dashboard-top-links"
      aria-labelledby="top-links-heading"
    >
      <div className="dashboard-card-heading">
        <div>
          <h2 id="top-links-heading">Links com melhor desempenho</h2>
          <p>Mais clicados no período.</p>
        </div>
      </div>
      {topLinks.length ? (
        <ol>
          {topLinks.map((link, index) => (
            <li key={link.id}>
              <span>{index + 1}</span>
              <Link href={`/conta/links/${link.id}`}>
                {link.title || link.slug}
              </Link>
              <strong>{plural(link.clicks, "clique")}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <div className="dashboard-low-data dashboard-top-links-empty">
          <FiLink aria-hidden="true" />
          <p>Os links mais acessados aparecerão aqui.</p>
        </div>
      )}
      <Link className="dashboard-text-link" href="/untrack/short-links">
        Ver todos os links <FiArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

export function DashboardHome({
  canWrite,
  greeting,
  userName,
  days,
  assets,
  metrics,
  performance,
  topLinks,
}: DashboardHomeProps) {
  const hasData = assets.links || assets.campaigns || assets.smartPages || assets.smartCards;
  const checklist = [
    { label: "Criar sua conta", complete: true },
    { label: "Criar primeiro link", complete: assets.links > 0 },
    { label: "Criar sua Smart Page", complete: assets.smartPages > 0 },
    { label: "Compartilhar sua página", complete: assets.publishedSmartPages > 0 },
    { label: "Conseguir seu primeiro clique", complete: metrics.clicks > 0 },
  ];
  if (!hasData) {
    return (
      <section className="workspace-page dashboard-home dashboard-home-empty">
        <DashboardHeader
          canWrite={canWrite}
          greeting={greeting}
          userName={userName}
        />
        <SetupChecklist items={checklist} />
        <section className="dashboard-welcome" aria-labelledby="welcome-heading">
          <FiLink aria-hidden="true" />
          <div>
            <h2 id="welcome-heading">Bem-vindo ao LinkOr</h2>
            <p>Comece criando seu primeiro destino rastreável para acompanhar tudo por aqui.</p>
          </div>
          {canWrite ? (
            <Link className="button" href="/untrack/short-links?create=1">
              <FiPlus aria-hidden="true" />
              Criar link
            </Link>
          ) : null}
        </section>
      </section>
    );
  }

  const ctr = metrics.ctr === null ? "—" : `${metrics.ctr}%`;
  const ctrDetail = metrics.ctr === null ? "Dados iniciais" : "CTR das Smart Pages";

  return (
    <section className="workspace-page dashboard-home">
      <DashboardHeader
        canWrite={canWrite}
        greeting={greeting}
        userName={userName}
      />
      <SetupChecklist items={checklist} />

      <section className="dashboard-section" aria-labelledby="assets-heading">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="assets-heading">Seus ativos</h2>
            <p>Acesse rapidamente o que você está gerenciando.</p>
          </div>
        </div>
        <div className="dashboard-assets-grid">
          <AssetCard
            icon={<FiGrid />}
            title="Smart Pages"
            status={
              assets.publishedSmartPages
                ? plural(assets.publishedSmartPages, "publicada")
                : assets.smartPages
                  ? "Em rascunho"
                  : "Nenhuma publicada"
            }
            description={
              assets.featuredSmartPage
                ? `${assets.featuredSmartPage.title} · ${plural(assets.featuredSmartPage.views, "visualização", "visualizações")}`
                : assets.smartPages
                  ? "Finalize e publique sua página para acompanhar os resultados."
                  : "Crie uma página para reunir seus principais destinos."
            }
            href={
              assets.featuredSmartPage
                ? `/untrack/smart-pages?edit=${assets.featuredSmartPage.id}`
                : assets.smartPages
                  ? "/untrack/smart-pages"
                  : "/untrack/smart-pages?create=1"
            }
            action={
              assets.featuredSmartPage
                ? "Editar"
                : assets.smartPages
                  ? "Ver páginas"
                  : "Criar Smart Page"
            }
          >
            {assets.featuredSmartPage ? (
              <div className="dashboard-smart-page-preview" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </AssetCard>
          <AssetCard
            icon={<FiLink />}
            title="Links"
            status={plural(assets.links, "ativo")}
            description={`${plural(metrics.clicks, "clique")} nos últimos ${days} dias.`}
            href="/untrack/short-links"
            action="Ver links"
          />
          <AssetCard
            icon={<FiTarget />}
            title="Campanhas"
            status={plural(assets.campaigns, "ativa")}
            description={
              assets.campaigns
                ? "Organize links e acompanhe os resultados por campanha."
                : "Agrupe links e acompanhe resultados por campanha."
            }
            href={
              assets.campaigns
                ? "/untrack/campaigns"
                : "/untrack/campaigns?create=1"
            }
            action={assets.campaigns ? "Ver campanhas" : "Criar campanha"}
          />
          <AssetCard
            icon={<FiUsers />}
            title="Smart Cards"
            status={plural(assets.smartCards, "cartão")}
            description={
              assets.smartCards
                ? "Atualize e compartilhe seus cartões digitais."
                : "Crie um cartão digital profissional para compartilhar."
            }
            href={assets.smartCards ? "/untrack/smart-cards" : "/untrack/smart-cards?create=1"}
            action={assets.smartCards ? "Ver cartões" : "Criar Smart Card"}
          />
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="overview-heading">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="overview-heading">Visão geral</h2>
            <p>Resultados reais no período selecionado.</p>
          </div>
        </div>
        <div className="dashboard-metrics-grid">
          <MetricCard
            icon={<FiEye />}
            label="Visualizações"
            value={metrics.views}
            detail={`Smart Pages nos últimos ${days} dias`}
          />
          <MetricCard
            icon={<FiUsers />}
            label="Visitantes"
            value={metrics.visitors}
            detail={`visitantes únicos nos últimos ${days} dias`}
          />
          <MetricCard
            icon={<FiMousePointer />}
            label="Cliques"
            value={metrics.clicks}
            detail={`em links nos últimos ${days} dias`}
          />
          <MetricCard
            icon={<FiPercent />}
            label="CTR"
            value={ctr}
            detail={ctrDetail}
          />
        </div>
      </section>

      <div className="dashboard-performance-grid">
        <PerformanceCard days={days} performance={performance} />
        <TopLinksCard topLinks={topLinks} />
      </div>
    </section>
  );
}