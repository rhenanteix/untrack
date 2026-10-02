"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { FiTarget } from "react-icons/fi";
import { apiRequest } from "./shared";

type Overview = {
  visitors: number;
  sessions: number;
  views: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  comparison: Record<string, number | null>;
};

type Timeseries = {
  points: Array<{
    date: string;
    visitors: number;
    views: number;
    clicks: number;
    conversions: number;
  }>;
};

type Breakdown = {
  items: Array<{
    name: string;
    views: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
  }>;
};

type Assets = {
  items: Array<{
    assetType: string;
    assetId: string;
    views: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
  }>;
};

type Technology = {
  devices: Array<{ name: string; events: number }>;
  operatingSystems: Array<{ name: string; events: number }>;
  browsers: Array<{ name: string; events: number }>;
};

type Locations = {
  items: Array<{
    country: string;
    region: string | null;
    city: string | null;
    events: number;
  }>;
};

type Time = { items: Array<{ weekday: number; hour: number; events: number }> };
type Journeys = { sampled: boolean; items: Array<{ journey: string; sessions: number }> };

const assetOptions = [
  ["", "Todos os ativos"],
  ["smart_page", "Smart Pages"],
  ["link", "Links"],
  ["smart_card", "Smart Cards"],
  ["qr_code", "QR Codes"],
  ["campaign", "Campanhas"],
] as const;

const eventLabels = {
  visitors: "Visitantes",
  views: "Visualizações",
  clicks: "Cliques",
  conversions: "Conversões",
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function datesFor(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: isoDate(from), to: isoDate(to) };
}

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function comparison(value: number | null | undefined) {
  if (value === null || value === undefined) return "Sem comparação válida";
  return `${value > 0 ? "+" : ""}${percent(value)} vs. período anterior`;
}

function QueryTable({
  title,
  caption,
  rows,
}: {
  title: string;
  caption: string;
  rows: Breakdown["items"];
}) {
  return (
    <section className="workspace-panel analytics-table-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{caption}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Visualizações</th>
                <th>Cliques</th>
                <th>Conversões</th>
                <th>Taxa de conversão</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{number(row.views)}</td>
                  <td>{number(row.clicks)}</td>
                  <td>{number(row.conversions)}</td>
                  <td>{percent(row.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-muted">Ainda não há dados neste período.</p>
      )}
    </section>
  );
}

function TechnologyList({ title, items }: { title: string; items: Array<{ name: string; events: number }> }) {
  const total = items.reduce((sum, item) => sum + item.events, 0);
  return (
    <div className="analytics-list">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{total ? percent((item.events / total) * 100) : "0%"}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sem dados suficientes.</p>
      )}
    </div>
  );
}

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState(30);
  const [range, setRange] = useState(datesFor(30));
  const [assetType, setAssetType] = useState("");
  const [metric, setMetric] = useState<keyof typeof eventLabels>("views");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<Timeseries | null>(null);
  const [sources, setSources] = useState<Breakdown | null>(null);
  const [channels, setChannels] = useState<Breakdown | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [technology, setTechnology] = useState<Technology | null>(null);
  const [locations, setLocations] = useState<Locations | null>(null);
  const [time, setTime] = useState<Time | null>(null);
  const [journeys, setJourneys] = useState<Journeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ from: range.from, to: range.to });
    if (assetType) query.set("assetType", assetType);
    const request = <T,>(view: string) =>
      apiRequest<T>(`/api/workspace/analytics?view=${view}&${query}`, {
        signal: controller.signal,
      });
    Promise.all([
      request<Overview>("overview"),
      request<Timeseries>("timeseries"),
      request<Breakdown>("sources"),
      request<Breakdown>("channels"),
      request<Assets>("assets"),
      request<Technology>("technology"),
      request<Locations>("locations"),
      request<Time>("time"),
      request<Journeys>("journeys"),
    ])
      .then(([nextOverview, nextSeries, nextSources, nextChannels, nextAssets, nextTechnology, nextLocations, nextTime, nextJourneys]) => {
        if (controller.signal.aborted) return;
        setError("");
        setOverview(nextOverview);
        setSeries(nextSeries);
        setSources(nextSources);
        setChannels(nextChannels);
        setAssets(nextAssets);
        setTechnology(nextTechnology);
        setLocations(nextLocations);
        setTime(nextTime);
        setJourneys(nextJourneys);
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [assetType, range]);

  function selectPeriod(days: number) {
    startTransition(() => {
      setPeriod(days);
      setRange(datesFor(days));
    });
  }

  const highest = Math.max(...(series?.points.map((point) => point[metric]) ?? [0]), 1);
  const timeMaximum = Math.max(...(time?.items.map((item) => item.events) ?? [0]), 1);
  const isEmpty = !loading && overview && !overview.views && !overview.clicks;

  return (
    <div className="workspace-page analytics-page">
      <header className="workspace-page-heading analytics-heading">
        <div>
          <span className="eyebrow">Inteligência</span>
          <h1>Analytics</h1>
          <p>Entenda como as pessoas encontram e interagem com seus conteúdos.</p>
        </div>
        <div className="workspace-heading-actions">
          <Link className="button button-secondary" href="/untrack/analytics/goals">
            <FiTarget aria-hidden="true" /> Objetivos
          </Link>
        </div>
      </header>

      <div className="analytics-filters" aria-label="Filtros de Analytics">
        <div className="analytics-period" role="group" aria-label="Período">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={period === days}
              onClick={() => selectPeriod(days)}
            >
              {days} dias
            </button>
          ))}
          <button type="button" aria-pressed={period === 0} onClick={() => setPeriod(0)}>
            Personalizado
          </button>
        </div>
        {period === 0 && (
          <div className="analytics-custom-dates">
            <label>De<input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} /></label>
            <label>Até<input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} /></label>
          </div>
        )}
        <label className="analytics-asset-filter">
          <span>Ativo</span>
          <select value={assetType} onChange={(event) => setAssetType(event.target.value)}>
            {assetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {loading && <p role="status" className="analytics-muted">Carregando Analytics...</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {isEmpty && (
        <section className="workspace-empty-state">
          <h2>Ainda não temos dados suficientes.</h2>
          <p>Compartilhe uma Smart Page, link, QR Code ou Smart Card para começar a medir interações reais.</p>
          <div className="workspace-empty-actions"><Link className="button" href="/untrack/smart-pages">Ver Smart Pages</Link></div>
        </section>
      )}

      {!loading && !error && overview && !isEmpty && (
        <>
          <dl className="workspace-kpis analytics-kpis">
            <div><dt>Visitantes</dt><dd>{number(overview.visitors)}</dd><small>{comparison(overview.comparison.visitors)}</small></div>
            <div><dt>Sessões</dt><dd>{number(overview.sessions)}</dd><small>Visitas identificadas no período</small></div>
            <div><dt>Visualizações</dt><dd>{number(overview.views)}</dd><small>{comparison(overview.comparison.views)}</small></div>
            <div><dt>Cliques</dt><dd>{number(overview.clicks)}</dd><small>{comparison(overview.comparison.clicks)}</small></div>
            <div><dt>CTR</dt><dd>{percent(overview.ctr)}</dd><small>Cliques por visualização</small></div>
            <div><dt>Conversões</dt><dd>{number(overview.conversions)}</dd><small>{comparison(overview.comparison.conversions)}</small></div>
            <div><dt>Taxa de conversão</dt><dd>{percent(overview.conversionRate)}</dd><small>Conversões por visualização</small></div>
          </dl>

          <section className="workspace-panel analytics-performance">
            <div className="workspace-panel-heading">
              <div><h2>Desempenho</h2><p>Atividade real no período selecionado.</p></div>
              <label className="analytics-metric"><span>Métrica</span><select value={metric} onChange={(event) => setMetric(event.target.value as keyof typeof eventLabels)}>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <ol className="dashboard-chart-bars analytics-chart-bars">
              {series?.points.map((point) => <li key={point.date} title={`${point.date}: ${number(point[metric])}`}><span style={{ height: `${Math.max((point[metric] / highest) * 100, 2)}%` }} /><small>{point.date.slice(5)}</small></li>)}
            </ol>
          </section>

          <div className="workspace-overview-grid">
            <QueryTable title="Aquisição" caption="De onde vieram as visualizações." rows={sources?.items ?? []} />
            <QueryTable title="Canais" caption="Agrupamento determinístico do tráfego." rows={channels?.items ?? []} />
          </div>

          <section className="workspace-panel analytics-table-panel">
            <div className="workspace-panel-heading"><div><h2>Conteúdo</h2><p>Performance por ativo no período selecionado.</p></div></div>
            {assets?.items.length ? <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Ativo</th><th>Visualizações</th><th>Cliques</th><th>CTR</th><th>Conversões</th></tr></thead><tbody>{assets.items.slice(0, 12).map((asset) => <tr key={`${asset.assetType}:${asset.assetId}`}><td><span className="analytics-asset-type">{asset.assetType.replace("_", " ")}</span><small>{asset.assetId}</small></td><td>{number(asset.views)}</td><td>{number(asset.clicks)}</td><td>{percent(asset.ctr)}</td><td>{number(asset.conversions)}</td></tr>)}</tbody></table></div> : <p className="analytics-muted">Ainda não há ativos com atividade neste período.</p>}
          </section>

          <div className="workspace-overview-grid">
            <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Tecnologia</h2><p>Dispositivos e navegadores informados pelo acesso.</p></div></div><div className="analytics-technology"><TechnologyList title="Dispositivos" items={technology?.devices ?? []} /><TechnologyList title="Sistemas" items={technology?.operatingSystems ?? []} /><TechnologyList title="Browsers" items={technology?.browsers ?? []} /></div></section>
            <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Localização</h2><p>Dados aproximados com amostra mínima.</p></div></div>{locations?.items.length ? <ul className="analytics-location-list">{locations.items.slice(0, 8).map((location) => <li key={`${location.country}:${location.region}:${location.city}`}><span>{[location.city, location.region, location.country].filter(Boolean).join(", ")}</span><strong>{number(location.events)}</strong></li>)}</ul> : <p className="analytics-muted">Ainda não há volume suficiente para mostrar localização.</p>}</section>
          </div>

          <section className="workspace-panel analytics-time-panel"><div className="workspace-panel-heading"><div><h2>Horários</h2><p>Atividade por dia da semana e hora do dia.</p></div></div><div className="analytics-heatmap" role="img" aria-label="Heatmap de atividade por dia e hora">{[0, 1, 2, 3, 4, 5, 6].flatMap((weekday) => Array.from({ length: 24 }, (_, hour) => { const events = time?.items.find((item) => item.weekday === weekday && item.hour === hour)?.events ?? 0; return <span key={`${weekday}:${hour}`} title={`${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][weekday]} ${hour}h: ${number(events)}`} style={{ opacity: events ? Math.max(events / timeMaximum, 0.12) : 0.04 }} />; }))}</div><div className="analytics-heatmap-labels"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div></section>

          <section className="workspace-panel"><div className="workspace-panel-heading"><div><h2>Jornadas</h2><p>Sequências agregadas, sem expor pessoas individualmente.</p></div></div>{journeys?.items.length ? <ol className="analytics-journeys">{journeys.items.map((item) => <li key={item.journey}><span>{item.journey.replaceAll("_", " ")}</span><strong>{number(item.sessions)}</strong></li>)}</ol> : <p className="analytics-muted">Ainda não há jornadas com mais de uma interação.</p>}{journeys?.sampled && <p className="analytics-muted">Mostrando uma amostra recente de jornadas para preservar o tempo de resposta.</p>}</section>
        </>
      )}
    </div>
  );
}