"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { FiArrowDown, FiTarget } from "react-icons/fi";
import { PremiumGate } from "@/components/premium-gate";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "./shared";

type Tab = "overview" | "acquisition" | "content" | "conversions";
type Metric = "visitors" | "clicks" | "conversions";
type AcquisitionMode = "source" | "channel";

type Overview = {
  range: { historyDays: number; advancedAnalytics: boolean };
  visitors: number;
  sessions: number;
  views: number;
  clicks: number;
  whatsappClicks: number;
  conversions: number;
  conversionRate: number;
  comparison: Record<string, number | null>;
};
type Timeseries = {
  points: Array<{
    date: string;
    visitors: number;
    clicks: number;
    conversions: number;
  }>;
};
type Breakdown = {
  items: Array<{
    name: string;
    visitors: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
  }>;
  locked?: boolean;
};
type Asset = {
  assetType: string;
  assetId: string;
  name: string;
  context: string | null;
  visitors: number;
  clicks: number;
  scans: number;
  interactions: number;
  conversions: number;
  conversionRate: number;
};
type Campaign = {
  campaignId: string;
  name: string;
  visitors: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
};
type Goal = {
  goalId: string;
  name: string;
  conversions: number;
  visitors: number;
  conversionRate: number;
};
type Utm = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  visitors: number;
  conversions: number;
  conversionRate: number;
};
type Data = {
  overview: Overview;
  series: Timeseries;
  sources: Breakdown;
  channels: Breakdown;
  assets: { items: Asset[]; locked?: boolean };
  campaigns: { items: Campaign[] };
  goals: {
    items: Goal[];
    primary: Goal | null;
    goalOptions: Array<{ id: string; name: string }>;
  };
  utms: { items: Utm[] };
};

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Visão geral" },
  { value: "acquisition", label: "Aquisição" },
  { value: "content", label: "Conteúdo" },
  { value: "conversions", label: "Conversões" },
];
const assetTypes: Record<string, string> = {
  smart_page: "Smart Page",
  smart_card: "Smart Card",
  link: "Link",
  qr_code: "QR Code",
  campaign: "Campanha",
  product: "Produto",
  payment_link: "Link de pagamento",
};
const channelLabels: Record<string, string> = {
  direct: "Direct",
  organic_search: "Organic Search",
  paid_search: "Paid Search",
  organic_social: "Organic Social",
  paid_social: "Paid Social",
  email: "Email",
  messaging: "Messaging",
  referral: "Referral",
  qr: "QR",
  other: "Other",
};
const metricLabels: Record<Metric, string> = {
  visitors: "Visitantes",
  clicks: "Cliques",
  conversions: "Conversões",
};

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
function comparison(value: number | null | undefined) {
  return value === null || value === undefined
    ? null
    : `${value > 0 ? "+" : ""}${percent(value)} vs. período anterior`;
}
function assetTypeLabel(type: string) {
  return assetTypes[type] ?? type.replaceAll("_", " ");
}
function analyticsHref(values: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value) query.set(key, value);
  return `/untrack/analytics?${query}`;
}

function Skeleton() {
  return (
    <div
      className="analytics-skeleton"
      role="status"
      aria-label="Carregando Analytics"
    >
      <div className="analytics-skeleton-kpis">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <span className="analytics-skeleton-chart" />
      <span className="analytics-skeleton-table" />
    </div>
  );
}

function AcquisitionTable({
  mode,
  items,
}: {
  mode: AcquisitionMode;
  items: Breakdown["items"];
}) {
  return items.length ? (
    <div className="analytics-table-wrap">
      <table className="analytics-table">
        <thead>
          <tr>
            <th>{mode === "source" ? "Origem" : "Canal"}</th>
            <th>Visitantes</th>
            <th>Cliques</th>
            <th>Conversões</th>
            <th>CVR</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name}>
              <td>
                {mode === "channel"
                  ? (channelLabels[item.name] ?? item.name)
                  : item.name === "direct"
                    ? "Direct"
                    : item.name}
              </td>
              <td>{number(item.visitors)}</td>
              <td>{number(item.clicks)}</td>
              <td>{number(item.conversions)}</td>
              <td>{percent(item.conversionRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="analytics-muted">Ainda não há dados neste período.</p>
  );
}

function ContentTable({
  title,
  assets,
  period,
  variant,
}: {
  title: string;
  assets: Asset[];
  period: string;
  variant: "all" | "smart" | "link" | "qr";
}) {
  const qr = variant === "qr";
  return (
    <section className="workspace-panel analytics-table-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      {assets.length ? (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>
                  {qr
                    ? "QR"
                    : variant === "link"
                      ? "Link"
                      : variant === "smart"
                        ? "Smart Page"
                        : "Ativo"}
                </th>
                {variant === "all" ? (
                  <>
                    <th>Tipo</th>
                    <th>Visitantes</th>
                    <th>Interações</th>
                  </>
                ) : null}
                <th>{qr ? "Scans" : "Cliques"}</th>
                <th>Conversões</th>
                <th>CVR</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={`${asset.assetType}:${asset.assetId}`}>
                  <td>
                    <Link
                      className="analytics-table-link"
                      href={analyticsHref({
                        tab: "content",
                        period,
                        assetType: asset.assetType,
                        asset: asset.assetId,
                      })}
                      onClick={() => analytics.track("analytics_asset_opened")}
                    >
                      {asset.name}
                    </Link>
                    {asset.context ? <small>{asset.context}</small> : null}
                  </td>
                  {variant === "all" ? (
                    <>
                      <td>{assetTypeLabel(asset.assetType)}</td>
                      <td>{number(asset.visitors)}</td>
                      <td>{number(asset.interactions)}</td>
                    </>
                  ) : null}
                  <td>{number(qr ? asset.scans : asset.clicks)}</td>
                  <td>{number(asset.conversions)}</td>
                  <td>{percent(asset.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-muted">
          Sem dados suficientes para este ranking.
        </p>
      )}
    </section>
  );
}

export function AnalyticsDashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const queryKey = useSearchParams().toString();
  const params = new URLSearchParams(queryKey);
  const requestedTab = params.get("tab");
  const tab = tabs.some((item) => item.value === requestedTab)
    ? (requestedTab as Tab)
    : "overview";
  const requestedPeriod = params.get("period");
  const period = ["7d", "30d", "90d"].includes(requestedPeriod ?? "")
    ? (requestedPeriod as "7d" | "30d" | "90d")
    : "7d";
  const periodDays = Number.parseInt(period, 10);
  const assetType = params.get("assetType") ?? "";
  const assetId = params.get("asset") ?? "";
  const campaignId = params.get("campaign") ?? "";
  const goalId = params.get("goal") ?? "";
  const [response, setResponse] = useState<{
    key: string;
    data: Data;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [metric, setMetric] = useState<Metric>("visitors");
  const [acquisitionMode, setAcquisitionMode] =
    useState<AcquisitionMode>("source");
  const requestKey = [period, assetType, assetId, campaignId, goalId].join(":");
  const data = response?.key === requestKey ? response.data : null;
  const error = failure?.key === requestKey ? failure.message : "";
  const loading = !data && !error;

  useEffect(() => {
    analytics.track("analytics_viewed");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ period });
    if (assetType) query.set("assetType", assetType);
    if (assetId) query.set("assetId", assetId);
    if (campaignId) query.set("campaignId", campaignId);
    if (goalId) query.set("goalId", goalId);
    const request = <T,>(view: string) =>
      apiRequest<T>(`/api/workspace/analytics?view=${view}&${query}`, {
        signal: controller.signal,
      });
    Promise.all([
      request<Overview>("overview"),
      request<Timeseries>("timeseries"),
      request<Breakdown>("sources"),
      request<Breakdown>("channels"),
      request<{ items: Asset[]; locked?: boolean }>("assets"),
      request<{ items: Campaign[] }>("campaigns"),
      request<Data["goals"]>("goals"),
      request<{ items: Utm[] }>("utms"),
    ])
      .then(
        ([
          overview,
          series,
          sources,
          channels,
          assets,
          campaigns,
          goals,
          utms,
        ]) => {
          if (!controller.signal.aborted)
            setResponse({
              key: requestKey,
              data: {
                overview,
                series,
                sources,
                channels,
                assets,
                campaigns,
                goals,
                utms,
              },
            });
        },
      )
      .catch((reason: Error) => {
        if (!controller.signal.aborted)
          setFailure({
            key: requestKey,
            message: reason.message || "Não foi possível carregar estes dados.",
          });
      });
    return () => controller.abort();
  }, [
    assetId,
    assetType,
    campaignId,
    goalId,
    period,
    periodDays,
    requestKey,
    retry,
  ]);

  function updateQuery(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(queryKey);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() =>
      router.replace(next.size ? `${pathname}?${next}` : pathname),
    );
  }

  function selectPeriod(days: number) {
    analytics.track("analytics_period_changed");
    updateQuery({ period: `${days}d` });
  }

  function applyFilters(changes: Record<string, string | undefined>) {
    analytics.track("analytics_filter_applied");
    updateQuery(changes);
  }

  const assets = data?.assets.items ?? [];
  const filteredAssets = assets.filter(
    (asset) => !assetType || asset.assetType === assetType,
  );
  const smartPages = assets.filter((asset) => asset.assetType === "smart_page");
  const links = assets.filter((asset) => asset.assetType === "link");
  const qrCodes = assets.filter((asset) => asset.assetType === "qr_code");
  const currentAcquisition =
    acquisitionMode === "source" ? data?.sources : data?.channels;
  const highest = Math.max(
    ...(data?.series.points.map((point) => point[metric]) ?? [0]),
    1,
  );
  const isEmpty = data
    ? !data.overview.visitors &&
      !data.overview.views &&
      !data.overview.clicks &&
      !data.overview.conversions
    : false;
  const historyDays = data?.overview.range.historyDays ?? 7;

  return (
    <div className="workspace-page analytics-page">
      <header className="workspace-page-heading analytics-heading">
        <div>
          <h1>Analytics</h1>
          <p>
            Entenda de onde vêm seus acessos e quais ações geram resultados.
          </p>
        </div>
        <div className="workspace-heading-actions">
          <Link
            className="button button-secondary"
            href="/untrack/analytics/goals"
          >
            <FiTarget aria-hidden="true" /> Objetivos
          </Link>
        </div>
      </header>

      <div
        className="analytics-tabs"
        role="tablist"
        aria-label="Seções de Analytics"
      >
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => updateQuery({ tab: item.value })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="analytics-filters" aria-label="Filtros de Analytics">
        <div className="analytics-period" role="group" aria-label="Período">
          {[7, 30, 90].map((days) =>
            days <= historyDays ? (
              <button
                key={days}
                type="button"
                aria-pressed={periodDays === days}
                onClick={() => selectPeriod(days)}
              >
                {days} dias
              </button>
            ) : (
              <PremiumGate
                key={days}
                feature={`${days} dias de Analytics`}
                description="Amplie o histórico disponível com o LinkOr Premium. Seus dados continuam sendo coletados no plano Free."
              >
                {days} dias
              </PremiumGate>
            ),
          )}
        </div>
        <label className="analytics-asset-filter">
          <span>Tipo de ativo</span>
          <select
            value={assetType}
            onChange={(event) =>
              applyFilters({ assetType: event.target.value, asset: undefined })
            }
          >
            <option value="">Todos os ativos</option>
            {Object.entries(assetTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-asset-filter">
          <span>Ativo</span>
          <select
            value={assetId}
            disabled={!filteredAssets.length}
            onChange={(event) => applyFilters({ asset: event.target.value })}
          >
            <option value="">Todos os ativos</option>
            {filteredAssets.map((asset) => (
              <option key={asset.assetId} value={asset.assetId}>
                {asset.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-asset-filter">
          <span>Campanha</span>
          <select
            value={campaignId}
            disabled={!data?.campaigns.items.length}
            onChange={(event) => applyFilters({ campaign: event.target.value })}
          >
            <option value="">Todas as campanhas</option>
            {data?.campaigns.items.map((campaign) => (
              <option key={campaign.campaignId} value={campaign.campaignId}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-asset-filter">
          <span>Objetivo</span>
          <select
            value={goalId}
            disabled={!data?.goals.goalOptions.length}
            onChange={(event) => applyFilters({ goal: event.target.value })}
          >
            <option value="">Todos os objetivos</option>
            {data?.goals.goalOptions.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <Skeleton /> : null}
      {error ? (
        <section className="workspace-panel analytics-error-state" role="alert">
          <h2>Não foi possível carregar estes dados.</h2>
          <p>{error}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setFailure(null);
              setRetry((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </section>
      ) : null}
      {isEmpty ? (
        <section className="workspace-empty-state">
          <h2>Seu Analytics ainda está começando.</h2>
          <p>
            Compartilhe seus links, páginas ou QR Codes para começar a receber
            dados.
          </p>
          <div className="workspace-empty-actions">
            <Link className="button" href="/untrack/short-links">
              Criar link
            </Link>
            <Link
              className="button button-secondary"
              href="/untrack/smart-pages"
            >
              Criar Smart Page
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && !error && data && !isEmpty ? (
        <>
          {tab === "overview" ? (
            <>
              <dl className="workspace-kpis analytics-kpis">
                <div>
                  <dt>Visitantes</dt>
                  <dd>{number(data.overview.visitors)}</dd>
                  <small>{comparison(data.overview.comparison.visitors)}</small>
                </div>
                <div>
                  <dt>Sessões</dt>
                  <dd>{number(data.overview.sessions)}</dd>
                  <small>Identificadas no período</small>
                </div>
                <div>
                  <dt>Visualizações</dt>
                  <dd>{number(data.overview.views)}</dd>
                  <small>{comparison(data.overview.comparison.views)}</small>
                </div>
                <div>
                  <dt>Cliques</dt>
                  <dd>{number(data.overview.clicks)}</dd>
                  <small>{comparison(data.overview.comparison.clicks)}</small>
                </div>
                <div>
                  <dt>Conversões</dt>
                  <dd>{number(data.overview.conversions)}</dd>
                  <small>
                    {comparison(data.overview.comparison.conversions)}
                  </small>
                </div>
                <div>
                  <dt>Taxa de conversão</dt>
                  <dd>{percent(data.overview.conversionRate)}</dd>
                  <small>Conversões por visitante único</small>
                </div>
                {data.overview.whatsappClicks ? (
                  <div>
                    <dt>Cliques no WhatsApp</dt>
                    <dd>{number(data.overview.whatsappClicks)}</dd>
                    <small>Não representa conversas</small>
                  </div>
                ) : null}
              </dl>
              <section className="workspace-panel analytics-performance">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>Desempenho no período</h2>
                    <p>Uma métrica por vez para facilitar a leitura.</p>
                  </div>
                  <label className="analytics-metric">
                    <span>Métrica</span>
                    <select
                      value={metric}
                      onChange={(event) =>
                        setMetric(event.target.value as Metric)
                      }
                    >
                      {Object.entries(metricLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <ol className="dashboard-chart-bars analytics-chart-bars">
                  {data.series.points.map((point) => (
                    <li
                      key={point.date}
                      title={`${point.date}: ${metricLabels[metric]} ${number(point[metric])}`}
                    >
                      <span
                        style={{
                          height: `${Math.max((point[metric] / highest) * 100, 2)}%`,
                        }}
                      />
                      <small>{point.date.slice(5)}</small>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="workspace-panel analytics-funnel">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>Fluxo de resultado</h2>
                    <p>Do alcance à conversão no período selecionado.</p>
                  </div>
                </div>
                <ol>
                  <li>
                    <strong>{number(data.overview.visitors)}</strong>
                    <span>Visitantes</span>
                  </li>
                  <FiArrowDown aria-hidden="true" />
                  <li>
                    <strong>{number(data.overview.clicks)}</strong>
                    <span>Interações</span>
                  </li>
                  <FiArrowDown aria-hidden="true" />
                  <li>
                    <strong>{number(data.overview.conversions)}</strong>
                    <span>Conversões</span>
                  </li>
                </ol>
              </section>
            </>
          ) : null}

          {tab === "acquisition" ? (
            <>
              <section className="workspace-panel analytics-table-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>De onde vieram seus visitantes?</h2>
                    <p>
                      Direct é preservado quando não foi possível identificar
                      outra origem.
                    </p>
                  </div>
                  <div
                    className="analytics-mode-switch"
                    role="group"
                    aria-label="Dimensão de aquisição"
                  >
                    <button
                      type="button"
                      aria-pressed={acquisitionMode === "source"}
                      onClick={() => setAcquisitionMode("source")}
                    >
                      Origem
                    </button>
                    <button
                      type="button"
                      aria-pressed={acquisitionMode === "channel"}
                      onClick={() => setAcquisitionMode("channel")}
                    >
                      Canal
                    </button>
                  </div>
                </div>
                {currentAcquisition?.locked ? (
                  <div className="analytics-locked-state">
                    <p>
                      Os relatórios completos por canal estão disponíveis no
                      Premium.
                    </p>
                    <PremiumGate
                      feature="Canais de aquisição"
                      description="Veja todos os canais e amplie o histórico de Analytics com o LinkOr Premium."
                    />
                  </div>
                ) : (
                  <AcquisitionTable
                    mode={acquisitionMode}
                    items={currentAcquisition?.items ?? []}
                  />
                )}
              </section>
              <section className="workspace-panel analytics-table-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>UTMs</h2>
                    <p>Fontes, mídias e campanhas informadas nos acessos.</p>
                  </div>
                </div>
                {data.utms.items.length ? (
                  <div className="analytics-table-wrap">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>utm_source</th>
                          <th>utm_medium</th>
                          <th>utm_campaign</th>
                          <th>Visitantes</th>
                          <th>Conversões</th>
                          <th>CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.utms.items.map((utm) => (
                          <tr
                            key={`${utm.utmSource}:${utm.utmMedium}:${utm.utmCampaign}`}
                          >
                            <td>{utm.utmSource ?? "Não informado"}</td>
                            <td>{utm.utmMedium ?? "Não informado"}</td>
                            <td>{utm.utmCampaign ?? "Não informado"}</td>
                            <td>{number(utm.visitors)}</td>
                            <td>{number(utm.conversions)}</td>
                            <td>{percent(utm.conversionRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="analytics-muted">
                    Nenhum acesso com UTM neste período.
                  </p>
                )}
              </section>
              <section className="workspace-panel analytics-table-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>Campanhas com resultado</h2>
                    <p>Somente campanhas que receberam atividade no período.</p>
                  </div>
                </div>
                {data.campaigns.items.length ? (
                  <div className="analytics-table-wrap">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Campanha</th>
                          <th>Visitantes</th>
                          <th>Cliques</th>
                          <th>Conversões</th>
                          <th>CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.campaigns.items.map((campaign) => (
                          <tr key={campaign.campaignId}>
                            <td>
                              <Link
                                className="analytics-table-link"
                                href={analyticsHref({
                                  tab: "acquisition",
                                  period,
                                  campaign: campaign.campaignId,
                                })}
                              >
                                {campaign.name}
                              </Link>
                            </td>
                            <td>{number(campaign.visitors)}</td>
                            <td>{number(campaign.clicks)}</td>
                            <td>{number(campaign.conversions)}</td>
                            <td>{percent(campaign.conversionRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="analytics-muted">
                    Nenhuma campanha tem dados neste período.
                  </p>
                )}
              </section>
            </>
          ) : null}

          {tab === "content" ? (
            <>
              <ContentTable
                title="Conteúdo que mais gera resultado"
                assets={filteredAssets}
                period={period}
                variant="all"
              />
              <div className="workspace-overview-grid">
                <ContentTable
                  title="Top Smart Pages"
                  assets={smartPages}
                  period={period}
                  variant="smart"
                />
                <ContentTable
                  title="Top Links"
                  assets={links}
                  period={period}
                  variant="link"
                />
                <ContentTable
                  title="Performance de QR Codes"
                  assets={qrCodes}
                  period={period}
                  variant="qr"
                />
              </div>
            </>
          ) : null}

          {tab === "conversions" ? (
            <>
              {data.goals.primary ? (
                <section className="workspace-panel analytics-primary-goal">
                  <div>
                    <span className="eyebrow">Objetivo principal</span>
                    <h2>{data.goals.primary.name}</h2>
                  </div>
                  <dl>
                    <div>
                      <dt>Conversões</dt>
                      <dd>{number(data.goals.primary.conversions)}</dd>
                    </div>
                    <div>
                      <dt>CVR</dt>
                      <dd>{percent(data.goals.primary.conversionRate)}</dd>
                    </div>
                  </dl>
                  <Link
                    className="button button-secondary"
                    href={analyticsHref({
                      tab: "conversions",
                      period,
                      goal: data.goals.primary.goalId,
                    })}
                    onClick={() => analytics.track("analytics_goal_clicked")}
                  >
                    Ver objetivo
                  </Link>
                </section>
              ) : null}
              {!data.goals.goalOptions.length && data.overview.visitors ? (
                <section className="workspace-panel analytics-no-goals">
                  <h2>Você já está recebendo acessos.</h2>
                  <p>Agora defina o que representa um resultado para você.</p>
                  <Link className="button" href="/untrack/analytics/goals">
                    Criar objetivo
                  </Link>
                </section>
              ) : null}
              <section className="workspace-panel analytics-table-panel">
                <div className="workspace-panel-heading">
                  <div>
                    <h2>Performance por objetivo</h2>
                    <p>
                      Conversões são registradas pelo Goal Engine, não por
                      qualquer clique.
                    </p>
                  </div>
                </div>
                {data.goals.items.length ? (
                  <div className="analytics-table-wrap">
                    <table className="analytics-table">
                      <thead>
                        <tr>
                          <th>Objetivo</th>
                          <th>Conversões</th>
                          <th>Visitantes</th>
                          <th>CVR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.goals.items.map((goal) => (
                          <tr key={goal.goalId}>
                            <td>{goal.name}</td>
                            <td>{number(goal.conversions)}</td>
                            <td>{number(goal.visitors)}</td>
                            <td>{percent(goal.conversionRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="analytics-muted">
                    Ainda não há conversões neste período.
                  </p>
                )}
              </section>
              <div className="workspace-overview-grid">
                <section className="workspace-panel analytics-table-panel">
                  <div className="workspace-panel-heading">
                    <div>
                      <h2>Qual origem gera mais resultados?</h2>
                    </div>
                  </div>
                  <AcquisitionTable mode="source" items={data.sources.items} />
                </section>
                <section className="workspace-panel analytics-table-panel">
                  <div className="workspace-panel-heading">
                    <div>
                      <h2>Qual ativo gera mais resultados?</h2>
                    </div>
                  </div>
                  {assets.length ? (
                    <div className="analytics-table-wrap">
                      <table className="analytics-table">
                        <thead>
                          <tr>
                            <th>Ativo</th>
                            <th>Conversões</th>
                            <th>CVR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assets.map((asset) => (
                            <tr key={`${asset.assetType}:${asset.assetId}`}>
                              <td>{assetTypeLabel(asset.assetType)}</td>
                              <td>{number(asset.conversions)}</td>
                              <td>{percent(asset.conversionRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="analytics-muted">
                      Ainda não há ativos com conversão.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
