"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FiAlertTriangle,
  FiGrid,
  FiList,
  FiPlus,
  FiTarget,
} from "react-icons/fi";
import { CampaignBuilder } from "./campaign-builder";
import { apiRequest } from "./shared";

type Campaign = {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  client: { id: string; name: string } | null;
  clicks: number;
  _count: { channels: number; assets: number; shortLinks: number };
};

type CampaignResult = {
  campaigns: Campaign[];
  clients: { id: string; name: string }[];
  members: { user: { id: string; name: string } }[];
  smartPages: { id: string; title: string; slug: string }[];
  summary: {
    active: number;
    draft: number;
    needsAttention: number;
    periodClicks: number;
  };
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  active: "Ativa",
  paused: "Pausada",
  completed: "Finalizada",
  archived: "Arquivada",
};

const filters = [
  ["", "Todas"],
  ["active", "Ativas"],
  ["draft", "Rascunhos"],
  ["scheduled", "Agendadas"],
  ["completed", "Finalizadas"],
] as const;

function campaignPeriod(campaign: Campaign) {
  if (!campaign.startDate && !campaign.endDate) return "Sem período definido";
  const format = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
      .format(new Date(value))
      .replace(".", "");
  return `${campaign.startDate ? format(campaign.startDate) : "Início livre"} → ${campaign.endDate ? format(campaign.endDate) : "Sem data final"}`;
}

export function CampaignsList() {
  const router = useRouter();
  const params = useSearchParams();
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showBuilder, setShowBuilder] = useState(params.get("create") === "1");
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: "1" });
    if (status) query.set("status", status);
    if (search.trim()) query.set("search", search.trim());
    apiRequest<CampaignResult>(`/api/campaigns?${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [search, status]);

  function closeBuilder() {
    if (createdCampaignId) {
      router.push(`/untrack/campaigns/${createdCampaignId}`);
      return;
    }
    setShowBuilder(false);
  }

  const campaigns = result?.campaigns ?? [];
  const summary = result?.summary;

  return (
    <section className="workspace-page campaigns-page">
      <header className="workspace-page-heading campaigns-heading">
        <div>
          <span className="workspace-section-kicker">
            Planejamento e distribuição
          </span>
          <h1>Campanhas</h1>
          <p>Planeje, distribua e acompanhe suas campanhas em um só lugar.</p>
        </div>
        <button
          className="button"
          type="button"
          onClick={() => {
            setCreatedCampaignId(null);
            setShowBuilder(true);
          }}
        >
          <FiPlus aria-hidden="true" /> Nova campanha
        </button>
      </header>

      <dl className="campaign-summary" aria-label="Resumo de campanhas">
        <div>
          <dt>Campanhas ativas</dt>
          <dd>{summary?.active ?? "—"}</dd>
        </div>
        <div>
          <dt>Em preparação</dt>
          <dd>{summary?.draft ?? "—"}</dd>
        </div>
        <div>
          <dt>Precisam de atenção</dt>
          <dd>{summary?.needsAttention ?? "—"}</dd>
        </div>
        <div>
          <dt>Cliques nos últimos 30 dias</dt>
          <dd>{summary?.periodClicks ?? "—"}</dd>
        </div>
      </dl>

      <div className="campaign-list-controls">
        <label className="campaign-search">
          <span className="sr-only">Buscar campanhas</span>
          <input
            value={search}
            maxLength={120}
            placeholder="Buscar campanha"
            onChange={(event) => {
              setError("");
              setLoading(true);
              setSearch(event.target.value);
            }}
          />
        </label>
        <div className="campaign-filter-tabs" aria-label="Filtrar por status">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={status === value ? "is-active" : ""}
              onClick={() => {
                setError("");
                setLoading(true);
                setStatus(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="campaign-view-switch" aria-label="Modo de visualização">
          <button
            type="button"
            className={view === "cards" ? "is-active" : ""}
            aria-label="Exibir em cards"
            title="Exibir em cards"
            onClick={() => setView("cards")}
          >
            <FiGrid aria-hidden="true" />
          </button>
          <button
            type="button"
            className={view === "table" ? "is-active" : ""}
            aria-label="Exibir em tabela"
            title="Exibir em tabela"
            onClick={() => setView("table")}
          >
            <FiList aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="campaign-loading" role="status">
          Carregando campanhas...
        </div>
      ) : error ? (
        <div className="workspace-empty-state" role="alert">
          <h2>Não foi possível carregar as campanhas</h2>
          <p>{error}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => window.location.reload()}
          >
            Tentar novamente
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="campaign-empty-state">
          <span>
            <FiTarget aria-hidden="true" />
          </span>
          <h2>
            {status || search
              ? "Nenhuma campanha encontrada"
              : "Crie sua primeira campanha"}
          </h2>
          <p>
            {status || search
              ? "Ajuste seus filtros para encontrar outra campanha."
              : "Centralize links, UTMs, QR Codes e resultados de uma ação em um só lugar."}
          </p>
          {!status && !search && (
            <button
              className="button"
              type="button"
              onClick={() => setShowBuilder(true)}
            >
              <FiPlus aria-hidden="true" /> Criar campanha
            </button>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="campaign-card-grid">
          {campaigns.map((campaign) => (
            <article className="campaign-list-card" key={campaign.id}>
              <div className="campaign-card-status">
                <span className={`campaign-status is-${campaign.status}`}>
                  {statusLabel[campaign.status] ?? campaign.status}
                </span>
                {campaign._count.assets === 0 &&
                  campaign.status === "active" && (
                    <span title="Sem pontos de distribuição">
                      <FiAlertTriangle aria-hidden="true" />
                    </span>
                  )}
              </div>
              <div>
                <h2>{campaign.name}</h2>
                <p>{campaign.client?.name ?? "Campanha do workspace"}</p>
              </div>
              <p className="campaign-card-period">{campaignPeriod(campaign)}</p>
              <dl>
                <div>
                  <dt>Pontos de distribuição</dt>
                  <dd>{campaign._count.assets}</dd>
                </div>
                <div>
                  <dt>Cliques</dt>
                  <dd>{campaign.clicks}</dd>
                </div>
              </dl>
              <footer>
                <span>
                  {campaign._count.channels
                    ? `${campaign._count.channels} canal(is)`
                    : "Configure os canais"}
                </span>
                <Link
                  className="button button-secondary"
                  href={`/untrack/campaigns/${campaign.id}`}
                >
                  {campaign.status === "draft"
                    ? "Continuar configuração"
                    : "Ver campanha"}
                </Link>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="campaign-table-wrap">
          <table className="campaign-table">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Cliente</th>
                <th>Status</th>
                <th>Distribuição</th>
                <th>Cliques</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <strong>{campaign.name}</strong>
                    <small>{campaignPeriod(campaign)}</small>
                  </td>
                  <td>{campaign.client?.name ?? "—"}</td>
                  <td>
                    <span className={`campaign-status is-${campaign.status}`}>
                      {statusLabel[campaign.status] ?? campaign.status}
                    </span>
                  </td>
                  <td>{campaign._count.assets} ponto(s)</td>
                  <td>{campaign.clicks}</td>
                  <td>
                    <Link href={`/untrack/campaigns/${campaign.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBuilder && result && (
        <CampaignBuilder
          context={{
            clients: result.clients,
            members: result.members,
            smartPages: result.smartPages,
          }}
          onCreated={(campaign) => setCreatedCampaignId(campaign.id)}
          onClose={closeBuilder}
        />
      )}
    </section>
  );
}
