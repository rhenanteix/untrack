"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { FiArrowDown, FiArrowRight, FiX } from "react-icons/fi";
import { PremiumGate } from "@/components/premium-gate";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "./shared";

type JourneyNode = {
  type: "source" | "campaign" | "asset" | "interaction" | "conversion";
  id: string;
  label: string;
  context?: string | null;
};
type Journey = {
  id: string;
  path: JourneyNode[];
  visitors: number;
  sessions: number;
  interactions: number;
  conversions: number;
  conversionRate: number;
  firstSeen: string;
  lastSeen: string;
};
type JourneySummary = {
  visitors: number;
  conversions: number;
  conversionRate: number;
};
type JourneyData = {
  items: Journey[];
  sources: Array<
    JourneySummary & { id: string; name: string; filterValue: string }
  >;
  campaigns: Array<JourneySummary & { campaignId: string; name: string }>;
  assets: Array<
    JourneySummary & {
      assetType: string;
      assetId: string;
      name: string;
    }
  >;
  primaryGoal: { goalId: string; name: string } | null;
  goalOptions: Array<{ id: string; name: string }>;
  campaignOptions: Array<{ id: string; name: string }>;
  sourceOptions: Array<{ id: string; name: string }>;
  hasTraffic: boolean;
  hasGoals: boolean;
  attribution: "last_touch";
  sampled: boolean;
  locked: boolean;
};

const assetTypes = {
  smart_page: "Smart Page",
  smart_card: "Smart Card",
  link: "Link",
  qr_code: "QR Code",
} as const;
const nodeTypeLabels: Record<JourneyNode["type"], string> = {
  source: "Origem",
  campaign: "Campanha",
  asset: "Ativo",
  interaction: "Interação",
  conversion: "Conversão",
};

function number(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pathLabel(path: JourneyNode[]) {
  return path.map((node) => node.label).join(" → ");
}

function JourneyFlow({ path }: { path: JourneyNode[] }) {
  return (
    <ol className="journey-flow" aria-label={pathLabel(path)}>
      {path.map((node, index) => (
        <li key={`${node.type}:${node.id}`}>
          <div className={`journey-node journey-node-${node.type}`}>
            <span>{nodeTypeLabels[node.type]}</span>
            <strong>{node.label}</strong>
            {node.context ? <small>{node.context}</small> : null}
          </div>
          {index < path.length - 1 ? (
            <span className="journey-connector" aria-hidden="true">
              <FiArrowRight />
              <FiArrowDown />
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function JourneyTable({
  journeys,
  onOpen,
}: {
  journeys: Journey[];
  onOpen: (journey: Journey) => void;
}) {
  const visibleJourneys = journeys.slice(0, 5);
  const collapsedJourneys = journeys.slice(5);
  const collapsed = collapsedJourneys.reduce(
    (total, journey) => ({
      visitors: total.visitors + journey.visitors,
      conversions: total.conversions + journey.conversions,
    }),
    { visitors: 0, conversions: 0 },
  );
  return (
    <div className="analytics-table-wrap">
      <table className="analytics-table journey-table">
        <thead>
          <tr>
            <th>Caminho</th>
            <th>Visitantes</th>
            <th>Conversões</th>
            <th>CVR</th>
          </tr>
        </thead>
        <tbody>
          {visibleJourneys.map((journey) => (
            <tr key={journey.id}>
              <td>
                <button
                  className="journey-path-button"
                  type="button"
                  onClick={() => onOpen(journey)}
                >
                  {pathLabel(journey.path)}
                </button>
              </td>
              <td>{number(journey.visitors)}</td>
              <td>{number(journey.conversions)}</td>
              <td>{percent(journey.conversionRate)}</td>
            </tr>
          ))}
          {collapsedJourneys.length ? (
            <tr className="journey-collapsed-row">
              <td>Outras jornadas</td>
              <td>{number(collapsed.visitors)}</td>
              <td>{number(collapsed.conversions)}</td>
              <td>-</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SummaryTable({
  title,
  description,
  items,
  onSelect,
}: {
  title: string;
  description: string;
  items: Array<JourneySummary & { id: string; name: string }>;
  onSelect?: (item: JourneySummary & { id: string; name: string }) => void;
}) {
  return (
    <section className="workspace-panel analytics-table-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {items.length ? (
        <div className="analytics-table-wrap">
          <table className="analytics-table journey-summary-table">
            <thead>
              <tr>
                <th>Origem</th>
                <th>Visitantes</th>
                <th>Conversões</th>
                <th>CVR</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 5).map((item) => (
                <tr key={item.id}>
                  <td>
                    {onSelect ? (
                      <button
                        className="journey-path-button"
                        type="button"
                        onClick={() => onSelect(item)}
                      >
                        {item.name}
                      </button>
                    ) : (
                      item.name
                    )}
                  </td>
                  <td>{number(item.visitors)}</td>
                  <td>{number(item.conversions)}</td>
                  <td>{percent(item.conversionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="analytics-muted">
          Ainda não há conversões neste recorte.
        </p>
      )}
    </section>
  );
}

export function AnalyticsJourney() {
  const pathname = usePathname();
  const router = useRouter();
  const queryKey = useSearchParams().toString();
  const params = new URLSearchParams(queryKey);
  const period = ["7d", "30d", "90d"].includes(params.get("period") ?? "")
    ? (params.get("period") as "7d" | "30d" | "90d")
    : "30d";
  const goalId = params.get("goal") ?? "";
  const campaignId = params.get("campaign") ?? "";
  const source = params.get("source") ?? "";
  const assetType = params.get("assetType") ?? "";
  const assetId = params.get("asset") ?? "";
  const requestKey = [
    period,
    goalId,
    campaignId,
    source,
    assetType,
    assetId,
  ].join(":");
  const [response, setResponse] = useState<{
    key: string;
    data: JourneyData;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const data = response?.key === requestKey ? response.data : null;

  useEffect(() => {
    analytics.track("journey_viewed");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ period });
    if (goalId) query.set("goalId", goalId);
    if (campaignId) query.set("campaignId", campaignId);
    if (source) query.set("source", source);
    if (assetType) query.set("assetType", assetType);
    if (assetId) query.set("assetId", assetId);
    apiRequest<JourneyData>(`/api/workspace/analytics?view=journeys&${query}`, {
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted)
          setResponse({ key: requestKey, data: next });
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted)
          setError({
            key: requestKey,
            message: reason.message || "Não foi possível carregar as jornadas.",
          });
      });
    return () => controller.abort();
  }, [
    assetId,
    assetType,
    campaignId,
    goalId,
    period,
    requestKey,
    retry,
    source,
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

  function applyFilters(changes: Record<string, string | undefined>) {
    analytics.track("journey_filter_changed");
    updateQuery(changes);
  }

  const loading = !data && error?.key !== requestKey;
  const failure = error?.key === requestKey ? error.message : "";
  const selected = data?.items.find((item) => item.id === selectedId) ?? null;
  const selectedAsset = data?.assets.find((asset) => asset.assetId === assetId);
  const initialData =
    (data?.items.reduce((total, item) => total + item.sessions, 0) ?? 0) < 10;

  return (
    <div className="workspace-page analytics-page journey-page">
      <header className="workspace-page-heading analytics-heading">
        <div>
          <h1>Jornadas</h1>
          <p>Veja o caminho entre a origem do acesso e o resultado.</p>
        </div>
        <div className="workspace-heading-actions">
          <Link className="button button-secondary" href="/untrack/analytics">
            Voltar ao Analytics
          </Link>
        </div>
      </header>

      <div className="journey-context" aria-label="Contexto de atribuição">
        <span>Attribution: Last Touch</span>
        {data?.primaryGoal && !goalId ? (
          <strong>Jornadas que geraram {data.primaryGoal.name}</strong>
        ) : null}
      </div>

      <div
        className="analytics-filters journey-filters"
        aria-label="Filtros de jornadas"
      >
        <div className="analytics-period" role="group" aria-label="Período">
          {["7d", "30d", "90d"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => applyFilters({ period: value })}
            >
              {value.replace("d", " dias")}
            </button>
          ))}
        </div>
        <label className="analytics-asset-filter">
          <span>Campanha</span>
          <select
            value={campaignId}
            onChange={(event) => applyFilters({ campaign: event.target.value })}
          >
            <option value="">Todas as campanhas</option>
            {data?.campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-asset-filter">
          <span>Objetivo</span>
          <select
            value={goalId}
            onChange={(event) => applyFilters({ goal: event.target.value })}
          >
            <option value="">
              {data?.primaryGoal ? "Objetivo principal" : "Todos os objetivos"}
            </option>
            {data?.goalOptions.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
        <label className="analytics-asset-filter">
          <span>Origem</span>
          <select
            value={source}
            onChange={(event) => applyFilters({ source: event.target.value })}
          >
            <option value="">Todas as origens</option>
            {data?.sourceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
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
        {assetId ? (
          <button
            className="journey-clear-asset"
            type="button"
            onClick={() => applyFilters({ asset: undefined })}
          >
            <FiX aria-hidden="true" />
            {selectedAsset?.name ?? "Limpar ativo"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div
          className="analytics-skeleton journey-skeleton"
          role="status"
          aria-label="Carregando jornadas"
        />
      ) : null}
      {failure ? (
        <section className="workspace-panel analytics-error-state" role="alert">
          <h2>Não foi possível carregar as jornadas.</h2>
          <p>{failure}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </section>
      ) : null}
      {!loading && !failure && data?.locked ? (
        <section className="workspace-panel journey-locked-state">
          <h2>Entenda o caminho até suas conversões</h2>
          <p>O Journey completo está disponível no LinkOr Premium.</p>
          <PremiumGate
            feature="Jornadas de conversão"
            description="Veja como origens, campanhas, ativos e interações se conectam aos seus objetivos."
          />
        </section>
      ) : null}
      {!loading && !failure && data && !data.locked && !data.items.length ? (
        <section className="workspace-empty-state journey-empty-state">
          {!data.hasGoals && data.hasTraffic ? (
            <>
              <h2>
                Você já possui acessos, mas ainda não definiu o que representa
                uma conversão.
              </h2>
              <Link className="button" href="/untrack/analytics/goals">
                Criar objetivo
              </Link>
            </>
          ) : (
            <>
              <h2>Suas jornadas aparecerão aqui.</h2>
              <p>
                Compartilhe seus links, páginas ou QR Codes e acompanhe como as
                pessoas chegam até seus objetivos.
              </p>
              <div className="workspace-empty-actions">
                <Link className="button" href="/untrack/smart-pages">
                  Criar Smart Page
                </Link>
                <Link
                  className="button button-secondary"
                  href="/untrack/campaigns"
                >
                  Criar campanha
                </Link>
              </div>
            </>
          )}
        </section>
      ) : null}
      {!loading && !failure && data && !data.locked && data.items.length ? (
        <>
          {initialData ? (
            <p className="journey-low-data">
              Dados iniciais: aguarde mais acessos antes de tirar conclusões.
            </p>
          ) : null}
          {data.sampled ? (
            <p className="journey-low-data">
              A visualização usa uma amostra das sessões mais recentes deste
              período.
            </p>
          ) : null}
          <section className="workspace-panel journey-featured-path">
            <div className="workspace-panel-heading">
              <div>
                <h2>Caminho com mais conversões</h2>
                <p>
                  Reconstruído dentro de uma sessão, sem identificação de
                  visitantes.
                </p>
              </div>
            </div>
            <JourneyFlow path={data.items[0].path} />
            <dl className="journey-featured-metrics">
              <div>
                <dt>Visitantes</dt>
                <dd>{number(data.items[0].visitors)}</dd>
              </div>
              <div>
                <dt>Interações</dt>
                <dd>{number(data.items[0].interactions)}</dd>
              </div>
              <div>
                <dt>Conversões</dt>
                <dd>{number(data.items[0].conversions)}</dd>
              </div>
              <div>
                <dt>CVR</dt>
                <dd>{percent(data.items[0].conversionRate)}</dd>
              </div>
            </dl>
          </section>

          <section className="workspace-panel analytics-table-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Principais jornadas</h2>
                <p>
                  Os caminhos de menor volume são agrupados apenas nesta
                  visualização.
                </p>
              </div>
            </div>
            <JourneyTable
              journeys={data.items}
              onOpen={(journey) => {
                analytics.track("journey_path_opened");
                setSelectedId(journey.id);
              }}
            />
          </section>

          {selected ? (
            <section
              className="workspace-panel journey-detail"
              aria-live="polite"
            >
              <div className="workspace-panel-heading">
                <div>
                  <h2>Detalhe da jornada</h2>
                  <p>
                    Dados agregados de sessões que concluíram este objetivo.
                  </p>
                </div>
                <button
                  className="journey-close-detail"
                  type="button"
                  aria-label="Fechar detalhe"
                  title="Fechar detalhe"
                  onClick={() => setSelectedId(null)}
                >
                  <FiX aria-hidden="true" />
                </button>
              </div>
              <JourneyFlow path={selected.path} />
              <dl className="journey-detail-metrics">
                <div>
                  <dt>Visitantes</dt>
                  <dd>{number(selected.visitors)}</dd>
                </div>
                <div>
                  <dt>Sessões</dt>
                  <dd>{number(selected.sessions)}</dd>
                </div>
                <div>
                  <dt>Interações</dt>
                  <dd>{number(selected.interactions)}</dd>
                </div>
                <div>
                  <dt>Conversões</dt>
                  <dd>{number(selected.conversions)}</dd>
                </div>
                <div>
                  <dt>CVR</dt>
                  <dd>{percent(selected.conversionRate)}</dd>
                </div>
                <div>
                  <dt>Primeira vez</dt>
                  <dd>{formatDate(selected.firstSeen)}</dd>
                </div>
                <div>
                  <dt>Última vez</dt>
                  <dd>{formatDate(selected.lastSeen)}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <div className="journey-summary-grid">
            <SummaryTable
              title="Quais origens geraram conversão?"
              description="Last Touch registrado no evento de conversão."
              items={data.sources.map((item) => ({ ...item, id: item.id }))}
              onSelect={(item) =>
                applyFilters({
                  source: data.sources.find(
                    (sourceItem) => sourceItem.id === item.id,
                  )?.filterValue,
                })
              }
            />
            <SummaryTable
              title="Campanhas que geraram conversão"
              description="Apenas campanhas presentes no caminho registrado."
              items={data.campaigns.map((item) => ({
                ...item,
                id: item.campaignId,
              }))}
              onSelect={(item) => {
                analytics.track("journey_campaign_opened");
                applyFilters({ campaign: item.id });
              }}
            />
            <SummaryTable
              title="Ativos que geraram conversão"
              description="Smart Pages, Smart Cards, Links e QR Codes com jornada registrada."
              items={data.assets.map((item) => ({
                ...item,
                id: `${item.assetType}:${item.assetId}`,
              }))}
              onSelect={(item) => {
                const asset = data.assets.find(
                  (assetItem) =>
                    `${assetItem.assetType}:${assetItem.assetId}` === item.id,
                );
                applyFilters({
                  assetType: asset?.assetType,
                  asset: asset?.assetId,
                });
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
