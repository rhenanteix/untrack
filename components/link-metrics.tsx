"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import type {
  LinkMetrics as Metrics,
  ShortLinkView,
} from "@/modules/short-links/types";

export function LinkMetrics({ id, initial }: { id: string; initial: Metrics }) {
  const router = useRouter();
  const [metrics, setMetrics] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(30);
  const days = metrics.daily.slice(-period);
  const max = Math.max(1, ...days.map((d) => d.clicks));
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{
        link: ShortLinkView;
        metrics: Metrics;
      }>(`/api/short-links/${id}`);
      setMetrics(result.metrics);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível atualizar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="metrics-section" aria-label="Métricas do link">
      <div className="dashboard-heading">
        <h2>Cliques no seu link</h2>
        <button
          className="button button-secondary"
          onClick={refresh}
          disabled={busy}
        >
          {busy ? "Atualizando..." : "Atualizar métricas"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="stats-grid">
        <div>
          <strong data-testid="total-clicks">{metrics.total}</strong>
          <span>cliques no total</span>
        </div>
        <div>
          <strong>{metrics.last30Days}</strong>
          <span>nos últimos 30 dias</span>
        </div>
        <div>
          <strong>{metrics.daily.at(-1)?.clicks ?? 0}</strong>
          <span>hoje (UTC)</span>
        </div>
      </div>
      <div className="tool-card">
        <div className="dashboard-heading">
          <h3>Cliques por dia</h3>
          <label className="period-filter">
            <span>Período</span>
            <select
              value={period}
              onChange={(event) => setPeriod(Number(event.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </label>
        </div>
        <div
          className="click-chart"
          role="img"
          aria-label={`Cliques diários nos últimos ${period} dias. Valores disponíveis na tabela abaixo.`}
        >
          {days.map((day) => (
            <div
              key={day.date}
              className="chart-column"
              title={`${day.date}: ${day.clicks} cliques`}
            >
              <span
                className="chart-bar"
                style={{
                  height: `${day.clicks ? Math.max(3, (day.clicks / max) * 100) : 1}%`,
                }}
              />
              <span className="chart-label">{day.date.slice(8)}</span>
            </div>
          ))}
        </div>
        {metrics.last30Days === 0 && (
          <p className="empty-state">
            Ainda não há cliques. Compartilhe seu link para começar.
          </p>
        )}
        <details>
          <summary>Ver valores por dia (UTC)</summary>
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliques</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
      <div className="metrics-breakdown">
        <Breakdown
          title="Origens nos últimos 30 dias"
          items={metrics.referrers}
        />
        <Breakdown
          title="Dispositivos nos últimos 30 dias"
          items={metrics.devices}
        />
      </div>
      <p className="privacy-note">
        Contamos redirecionamentos, não pessoas únicas. Pré-visualizações e
        robôs conhecidos são ignorados. As métricas não armazenam IPs nem a URL
        completa de origem.
      </p>
    </section>
  );
}

function Breakdown({
  title,
  items,
}: {
  title: string;
  items: { name: string; clicks: number }[];
}) {
  return (
    <div className="tool-card">
      <h3>{title}</h3>
      {items.length ? (
        <ul className="metrics-list">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <strong>{item.clicks}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Nenhum acesso registrado.</p>
      )}
    </div>
  );
}
