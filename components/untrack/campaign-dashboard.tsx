"use client";

import Link from "next/link";
import {
  startTransition,
  use,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheck,
  FiClipboard,
  FiGrid,
  FiLink,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
  FiTarget,
} from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "./shared";

type Asset = {
  id: string;
  name: string;
  assetType: string;
  destinationUrl: string | null;
  status: string;
  clicks: number;
  distributionUrl: string | null;
  qr: { id: string; encodedUrl: string; mode: string } | null;
  whatsappLink: { id: string; phoneNumber: string; message: string } | null;
};

type Channel = {
  id: string;
  name: string;
  type: string;
  destinationUrl: string;
  monitorEnabled: boolean;
  assets: Asset[];
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  objectiveType: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  primaryDestinationUrl: string | null;
  client: { name: string } | null;
  responsible: { name: string } | null;
  channels: Channel[];
  checklistItems: {
    id: string;
    label: string;
    status: string;
    severity: string;
  }[];
  monitoringChecks: {
    id: string;
    channelId: string | null;
    status: string;
    httpStatus: number | null;
    responseTimeMs: number | null;
    checkedAt: string;
  }[];
  incidents: {
    id: string;
    message: string;
    status: string;
    severity: string;
    createdAt: string;
    recoveredAt: string | null;
  }[];
  metrics: {
    clicks: number;
    contacts: number;
    daily: { date: string; clicks: number }[];
  };
  activities: {
    id: string;
    action: string;
    createdAt: string;
    details: unknown;
    actor: { name: string };
  }[];
  primaryGoal: {
    id: string;
    name: string;
    goalType: string;
    status: string;
  } | null;
};

type CampaignInsights = {
  overview: {
    visitors: number;
    sessions: number;
    clicks: number;
    conversions: number;
    conversionRate: number;
  };
  distributions: {
    items: {
      id: string;
      name: string;
      type: string;
      status: string;
      channel: { id: string; name: string; type: string };
      visitors: number;
      interactions: number;
      conversions: number;
      conversionRate: number;
    }[];
  };
  goals: {
    items: {
      goalId: string;
      conversions: number;
      conversionRate: number;
    }[];
  };
};

type GoalOption = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

type Tab =
  | "overview"
  | "distribution"
  | "analytics"
  | "monitoring"
  | "settings"
  | "history";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  completed: "Finalizada",
  archived: "Arquivada",
};

const channelPresets = [
  ["Instagram", "social"],
  ["Facebook", "social"],
  ["TikTok", "social"],
  ["WhatsApp", "whatsapp"],
  ["E-mail", "email"],
  ["Meta Ads", "paid"],
  ["Google Ads", "paid"],
  ["QR Code", "qr"],
  ["Parceiro", "partner"],
  ["Material impresso", "offline"],
  ["Outro", "other"],
] as const;

function formatDate(value: string | null, includeYear = false) {
  if (!value) return "Sem data final";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  })
    .format(new Date(value))
    .replace(".", "");
}

function campaignPeriod(campaign: Campaign) {
  if (!campaign.startDate && !campaign.endDate) return "Sem período definido";
  return `${campaign.startDate ? formatDate(campaign.startDate, true) : "Início livre"} — ${formatDate(campaign.endDate, true)}`;
}

function formatPercentage(value: number) {
  return (
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    }).format(value) + "%"
  );
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    "campaign.created": "criou a campanha",
    "campaign.updated": "atualizou a campanha",
    "campaign.asset.created": "adicionou um ponto de distribuição",
    "campaign.channel.created": "adicionou um canal",
    "campaign.channel.updated": "atualizou um canal",
    "campaign.channel.deleted": "removeu um canal",
    "checklist.run": "executou o checklist",
    "monitor.check": "verificou um destino",
  };
  return labels[action] ?? "atualizou a campanha";
}

function assetTypeLabel(asset: Asset) {
  if (asset.qr) return "QR rastreável";
  if (asset.whatsappLink) return "WhatsApp";
  return "Link rastreável";
}

function assetActions(asset: Asset) {
  return asset.qr
    ? ["Copiar link", "Ver QR", "Testar destino"]
    : ["Copiar link", "Testar destino"];
}

function ChannelDialog({
  campaign,
  onClose,
  onCreated,
}: {
  campaign: Campaign;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selected, setSelected] = useState<
    (typeof channelPresets)[number] | null
  >(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = channelPresets.filter(([label]) =>
    label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );

  async function createChannel() {
    if (!selected || !campaign.primaryDestinationUrl) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/campaigns?action=channel", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          name: name.trim() || selected[0],
          type: selected[1],
          destinationUrl: campaign.primaryDestinationUrl,
          monitorEnabled: true,
        }),
      });
      onCreated();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível adicionar o canal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Adicionar canal"
      onClose={onClose}
      footer={
        <button
          className="button"
          type="button"
          onClick={() => void createChannel()}
          disabled={!selected || !campaign.primaryDestinationUrl || busy}
        >
          Adicionar canal
        </button>
      }
    >
      <p className="campaign-dialog-copy">
        Escolha onde a campanha será divulgada. O tracking será preparado
        automaticamente.
      </p>
      <label className="campaign-field">
        <span>Pesquisar canal</span>
        <input
          value={query}
          placeholder="Instagram, WhatsApp, QR Code..."
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="campaign-channel-grid">
        {visible.map((option) => (
          <button
            className={
              selected?.[0] === option[0]
                ? "campaign-choice is-selected"
                : "campaign-choice"
            }
            key={option[0]}
            type="button"
            onClick={() => {
              setSelected(option);
              setName(option[0]);
            }}
          >
            <strong>{option[0]}</strong>
            {selected?.[0] === option[0] && <FiCheck aria-hidden="true" />}
          </button>
        ))}
      </div>
      {selected && (
        <label className="campaign-field">
          <span>Nome do canal</span>
          <input
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      )}
      {!campaign.primaryDestinationUrl && (
        <p className="form-error">
          Defina um destino principal antes de adicionar canais.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function AssetDialog({
  campaign,
  onClose,
  onCreated,
}: {
  campaign: Campaign;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [channelId, setChannelId] = useState(campaign.channels[0]?.id ?? "");
  const [mode, setMode] = useState<"link" | "qr" | "whatsapp">("link");
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState(
    campaign.primaryDestinationUrl ?? "",
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const channel = campaign.channels.find((item) => item.id === channelId);

  async function createAsset(event: FormEvent) {
    event.preventDefault();
    if (!channel) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/campaigns?action=asset", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          data: {
            channelId,
            name,
            assetType: `${channel.type}_${name.toLocaleLowerCase("pt-BR").replaceAll(/\s+/g, "_")}`,
            mode,
            destinationUrl: mode === "whatsapp" ? undefined : destinationUrl,
            phoneNumber: mode === "whatsapp" ? phoneNumber : undefined,
            message: mode === "whatsapp" ? message : undefined,
          },
        }),
      });
      onCreated();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar o ponto de distribuição.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Criar ponto de distribuição"
      onClose={onClose}
      footer={
        <button
          className="button"
          type="submit"
          form="campaign-asset-form"
          disabled={!channel || !name || busy}
        >
          Criar{" "}
          {mode === "qr"
            ? "QR rastreável"
            : mode === "whatsapp"
              ? "link do WhatsApp"
              : "link rastreável"}
        </button>
      }
    >
      <form
        id="campaign-asset-form"
        className="campaign-form-grid"
        onSubmit={createAsset}
      >
        <label className="campaign-field campaign-field-wide">
          <span>Canal</span>
          <select
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
          >
            {campaign.channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="campaign-mode-choice campaign-field-wide">
          <button
            className={mode === "link" ? "is-selected" : ""}
            type="button"
            onClick={() => setMode("link")}
          >
            <FiLink aria-hidden="true" /> Link
          </button>
          <button
            className={mode === "qr" ? "is-selected" : ""}
            type="button"
            onClick={() => setMode("qr")}
          >
            <FiGrid aria-hidden="true" /> QR Code
          </button>
          <button
            className={mode === "whatsapp" ? "is-selected" : ""}
            type="button"
            onClick={() => setMode("whatsapp")}
          >
            <FiMessageCircle aria-hidden="true" /> WhatsApp
          </button>
        </div>
        <label className="campaign-field campaign-field-wide">
          <span>Identificação</span>
          <input
            value={name}
            required
            maxLength={120}
            placeholder={
              mode === "qr" ? "Ex.: QR Recepção" : "Ex.: Instagram Bio"
            }
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {mode !== "whatsapp" ? (
          <label className="campaign-field campaign-field-wide">
            <span>Destino</span>
            <input
              value={destinationUrl}
              required
              type="url"
              placeholder="https://..."
              onChange={(event) => setDestinationUrl(event.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="campaign-field">
              <span>Número</span>
              <input
                value={phoneNumber}
                required
                placeholder="5511999999999"
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </label>
            <label className="campaign-field">
              <span>Mensagem inicial</span>
              <input
                value={message}
                maxLength={4096}
                placeholder="Olá, gostaria de saber mais."
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
          </>
        )}
        <p className="campaign-tracking-note campaign-field-wide">
          Tracking automático ativado. A configuração UTM permanece disponível
          no canal para quem precisar ajustar.
        </p>
        {error && (
          <p className="form-error campaign-field-wide" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="campaign-dialog-backdrop" role="presentation">
      <section
        className="campaign-dialog campaign-dialog-small"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="campaign-dialog-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <FiMoreHorizontal aria-hidden="true" />
          </button>
        </header>
        <div className="campaign-dialog-body">{children}</div>
        <footer className="campaign-dialog-footer">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          {footer}
        </footer>
      </section>
    </div>
  );
}

export function CampaignDashboard({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [insights, setInsights] = useState<CampaignInsights | null>(null);
  const [goalOptions, setGoalOptions] = useState<GoalOption[]>([]);
  const [primaryGoalId, setPrimaryGoalId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadCampaign = useCallback(async () => {
    try {
      const response = await apiRequest<{ campaign: Campaign }>(
        `/api/campaigns?campaignId=${params.id}`,
      );
      startTransition(() => {
        setCampaign(response.campaign);
        setPrimaryGoalId(response.campaign.primaryGoal?.id ?? "");
        setError("");
      });
      const query = new URLSearchParams({ campaignId: response.campaign.id });
      if (response.campaign.startDate)
        query.set("from", response.campaign.startDate);
      if (response.campaign.endDate) query.set("to", response.campaign.endDate);
      try {
        const [overview, distributions, goals] = await Promise.all([
          apiRequest<CampaignInsights["overview"]>(
            `/api/workspace/analytics?view=overview&${query}`,
          ),
          apiRequest<CampaignInsights["distributions"]>(
            `/api/workspace/analytics?view=distributions&${query}`,
          ),
          apiRequest<CampaignInsights["goals"]>(
            `/api/workspace/analytics?view=goals&${query}`,
          ),
        ]);
        startTransition(() => setInsights({ overview, distributions, goals }));
      } catch (analyticsError) {
        console.error("Campaign analytics was not loaded", analyticsError);
      }
      try {
        const goals = await apiRequest<GoalOption[]>(
          "/api/workspace/analytics/goals",
        );
        startTransition(() =>
          setGoalOptions(goals.filter((goal) => goal.status === "ACTIVE")),
        );
      } catch (goalsError) {
        console.error("Campaign goals were not loaded", goalsError);
      }
    } catch (requestError) {
      startTransition(() =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível carregar a campanha.",
        ),
      );
    }
  }, [params.id]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  useEffect(() => {
    if (tab === "analytics") analytics.track("campaign_analytics_viewed");
  }, [tab]);

  async function runChecklist() {
    setBusy(true);
    try {
      await apiRequest("/api/campaigns?action=checklist-run", {
        method: "POST",
        body: JSON.stringify({ campaignId: params.id }),
      });
      await loadCampaign();
    } finally {
      setBusy(false);
    }
  }

  async function runMonitor(channelId: string) {
    setBusy(true);
    try {
      await apiRequest("/api/campaigns?action=monitor-check", {
        method: "POST",
        body: JSON.stringify({ campaignId: params.id, channelId }),
      });
      await loadCampaign();
    } finally {
      setBusy(false);
    }
  }

  async function savePrimaryGoal() {
    setBusy(true);
    try {
      await apiRequest("/api/campaigns", {
        method: "PATCH",
        body: JSON.stringify({
          id: params.id,
          data: { primaryGoalId: primaryGoalId || null },
        }),
      });
      await loadCampaign();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível atualizar o objetivo principal.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string | null) {
    if (value) await navigator.clipboard.writeText(value);
  }

  if (error)
    return (
      <section className="workspace-page">
        <div className="workspace-empty-state" role="alert">
          <h2>Não foi possível carregar a campanha</h2>
          <p>{error}</p>
          <Link className="button button-secondary" href="/untrack/campaigns">
            Voltar às campanhas
          </Link>
        </div>
      </section>
    );
  if (!campaign)
    return (
      <section className="workspace-page">
        <div className="campaign-loading" role="status">
          Carregando campanha...
        </div>
      </section>
    );

  const completionItems = [
    ["Objetivo definido", Boolean(campaign.objectiveType)],
    ["Destino definido", Boolean(campaign.primaryDestinationUrl)],
    ["Canal configurado", campaign.channels.length > 0],
    [
      "Ponto de distribuição criado",
      campaign.channels.some((channel) => channel.assets.length > 0),
    ],
    ["Período definido", Boolean(campaign.startDate)],
  ] as const;
  const completed = completionItems.filter(([, complete]) => complete).length;
  const channelMetrics = campaign.channels.map((channel) => ({
    ...channel,
    clicks: channel.assets.reduce((total, asset) => total + asset.clicks, 0),
  }));
  const maximum = Math.max(
    ...campaign.metrics.daily.map((day) => day.clicks),
    1,
  );
  const unhealthy = campaign.monitoringChecks.filter(
    (check) => check.status === "down" || check.status === "degraded",
  );
  const interactions = insights
    ? insights.distributions.items.reduce(
        (total, distribution) => total + distribution.interactions,
        0,
      ) || insights.overview.clicks
    : 0;
  const hasTraffic = Boolean(
    insights &&
    (insights.overview.visitors ||
      insights.overview.sessions ||
      interactions ||
      insights.overview.conversions),
  );
  const primaryGoalMetric = campaign.primaryGoal
    ? insights?.goals.items.find(
        (goal) => goal.goalId === campaign.primaryGoal?.id,
      )
    : undefined;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Visão geral" },
    { id: "distribution", label: "Distribuição" },
    { id: "analytics", label: "Analytics" },
    { id: "monitoring", label: "Monitoramento" },
    { id: "settings", label: "Configurações" },
    { id: "history", label: "Histórico" },
  ];

  return (
    <section className="workspace-page campaign-dashboard">
      <Link className="campaign-back-link" href="/untrack/campaigns">
        <FiArrowLeft aria-hidden="true" /> Campanhas
      </Link>
      <header className="campaign-dashboard-header">
        <div>
          <div className="campaign-header-meta">
            <span className={`campaign-status is-${campaign.status}`}>
              {statusLabel[campaign.status] ?? campaign.status}
            </span>
            <span>{campaign.client?.name ?? "Campanha do workspace"}</span>
            <span>{campaignPeriod(campaign)}</span>
          </div>
          <h1>{campaign.name}</h1>
          <p>
            {campaign.objective ||
              campaign.description ||
              "Defina um objetivo para orientar a distribuição."}
          </p>
        </div>
        <div className="campaign-header-actions">
          <Link
            className="button button-secondary"
            href={`/untrack/analytics?campaign=${campaign.id}`}
          >
            Ver analytics
          </Link>
          <Link
            className="button button-secondary"
            href={`/untrack/analytics/journey?campaign=${campaign.id}`}
            onClick={() => analytics.track("campaign_journey_viewed")}
          >
            Ver jornada
          </Link>
          <Link
            className="button button-secondary"
            href={`/untrack/audience?campaign=${campaign.id}`}
            onClick={() => analytics.track("campaign_audience_viewed")}
          >
            Ver Audience
          </Link>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setShowChannelDialog(true)}
          >
            <FiPlus aria-hidden="true" /> Adicionar canal
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setShowAssetDialog(true)}
            disabled={!campaign.channels.length}
          >
            <FiPlus aria-hidden="true" /> Criar ativo
          </button>
        </div>
      </header>

      <nav
        className="campaign-dashboard-tabs"
        aria-label="Navegação da campanha"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "is-active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="campaign-dashboard-stack">
          <section className="campaign-overview-section">
            <div className="campaign-section-heading">
              <div>
                <span className="workspace-section-kicker">Resultados</span>
                <h2>O que já aconteceu</h2>
              </div>
              <span>Dados registrados</span>
            </div>
            {!insights ? (
              <p role="status">Carregando os resultados da campanha...</p>
            ) : !hasTraffic ? (
              <div className="campaign-empty-state">
                <span>
                  <FiActivity aria-hidden="true" />
                </span>
                <h2>Sua campanha ainda não recebeu acessos.</h2>
                <p>Distribua um link ou QR rastreável para começar a medir.</p>
                <button
                  className="button"
                  type="button"
                  onClick={() => setTab("distribution")}
                >
                  Distribuir campanha
                </button>
              </div>
            ) : (
              <dl className="campaign-results">
                <div>
                  <dt>Visitantes</dt>
                  <dd>{insights.overview.visitors}</dd>
                  <small>Pessoas identificadas pelo tracking</small>
                </div>
                <div>
                  <dt>Interações</dt>
                  <dd>{interactions}</dd>
                  <small>Cliques, QR e formulários</small>
                </div>
                <div>
                  <dt>Contatos</dt>
                  <dd>{campaign.metrics.contacts}</dd>
                  <small>Identificados na campanha</small>
                </div>
                <div>
                  <dt>Conversões</dt>
                  <dd>{insights.overview.conversions}</dd>
                  <small>Goals concluídos</small>
                </div>
                <div>
                  <dt>CVR</dt>
                  <dd>{formatPercentage(insights.overview.conversionRate)}</dd>
                  <small>Conversões por visitante</small>
                </div>
              </dl>
            )}
          </section>
          <section className="campaign-overview-grid">
            <div className="workspace-panel">
              <div className="campaign-section-heading">
                <div>
                  <span className="workspace-section-kicker">Progresso</span>
                  <h2>Preparação da campanha</h2>
                </div>
                <strong>
                  {completed}/{completionItems.length}
                </strong>
              </div>
              <div className="campaign-progress">
                <span
                  style={{
                    width: `${(completed / completionItems.length) * 100}%`,
                  }}
                />
              </div>
              <ul className="campaign-checklist-preview">
                {completionItems.map(([label, complete]) => (
                  <li key={label} className={complete ? "is-complete" : ""}>
                    {complete ? (
                      <FiCheck aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    {label}
                  </li>
                ))}
              </ul>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => void runChecklist()}
              >
                <FiClipboard aria-hidden="true" /> Ver checklist
              </button>
            </div>
            <div className="workspace-panel">
              <div className="campaign-section-heading">
                <div>
                  <span className="workspace-section-kicker">Saúde</span>
                  <h2>Destinos da campanha</h2>
                </div>
                <FiActivity aria-hidden="true" />
              </div>
              {unhealthy.length ? (
                <>
                  <p className="campaign-health-warning">
                    <FiAlertTriangle aria-hidden="true" /> {unhealthy.length}{" "}
                    item(ns) precisam de atenção
                  </p>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setTab("monitoring")}
                  >
                    Ver monitoramento
                  </button>
                </>
              ) : campaign.monitoringChecks.length ? (
                <p className="campaign-health-ok">
                  <FiCheck aria-hidden="true" /> Destinos verificados sem
                  alertas atuais.
                </p>
              ) : (
                <p>Verifique um destino para acompanhar a saúde da campanha.</p>
              )}
            </div>
          </section>
          <section className="workspace-panel">
            <div className="campaign-section-heading">
              <div>
                <span className="workspace-section-kicker">Desempenho</span>
                <h2>Cliques ao longo do tempo</h2>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => setTab("analytics")}
              >
                Ver desempenho
              </button>
            </div>
            {campaign.metrics.daily.length ? (
              <div
                className="campaign-chart"
                aria-label="Gráfico de cliques por dia"
              >
                {campaign.metrics.daily.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.clicks} cliques`}
                  >
                    <span
                      style={{
                        height: `${Math.max((day.clicks / maximum) * 100, day.clicks ? 4 : 1)}%`,
                      }}
                    />
                    <small>{new Date(day.date).getDate()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>
                Ainda não há dados suficientes. Compartilhe seus links ou QR
                Codes para começar a receber resultados.
              </p>
            )}
          </section>
          {campaign.primaryGoal && (
            <section className="workspace-panel">
              <div className="campaign-section-heading">
                <div>
                  <span className="workspace-section-kicker">
                    Objetivo principal
                  </span>
                  <h2>{campaign.primaryGoal.name}</h2>
                </div>
              </div>
              {primaryGoalMetric ? (
                <p>
                  {primaryGoalMetric.conversions} conversões ·{" "}
                  {formatPercentage(primaryGoalMetric.conversionRate)} CVR
                </p>
              ) : (
                <p>
                  Este objetivo ainda não recebeu conversões nesta campanha.
                </p>
              )}
            </section>
          )}
          <section className="campaign-overview-grid">
            <div className="workspace-panel">
              <div className="campaign-section-heading">
                <div>
                  <span className="workspace-section-kicker">Canais</span>
                  <h2>Distribuição atual</h2>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setTab("distribution")}
                >
                  Ver distribuição
                </button>
              </div>
              {channelMetrics.length ? (
                <ul className="campaign-channel-summary">
                  {channelMetrics.map((channel) => (
                    <li key={channel.id}>
                      <span>{channel.name}</span>
                      <strong>{channel.clicks} cliques</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sua campanha ainda não possui canais.</p>
              )}
            </div>
            <div className="workspace-panel">
              <div className="campaign-section-heading">
                <div>
                  <span className="workspace-section-kicker">Atividade</span>
                  <h2>Histórico recente</h2>
                </div>
              </div>
              {campaign.activities.length ? (
                <ul className="campaign-activity-list">
                  {campaign.activities.slice(0, 4).map((activity) => (
                    <li key={activity.id}>
                      <time>
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(activity.createdAt))}
                      </time>
                      <span>
                        <strong>{activity.actor.name}</strong>{" "}
                        {activityLabel(activity.action)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  A atividade aparecerá aqui quando a campanha começar a ser
                  configurada.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "distribution" && (
        <section className="campaign-distribution">
          <div className="campaign-section-heading">
            <div>
              <span className="workspace-section-kicker">
                Distribuição da campanha
              </span>
              <h2>Onde ela está sendo divulgada</h2>
              <p>
                Veja cada ponto de distribuição e acompanhe os resultados reais.
              </p>
            </div>
            <button
              className="button"
              type="button"
              onClick={() => setShowAssetDialog(true)}
              disabled={!campaign.channels.length}
            >
              <FiPlus aria-hidden="true" /> Criar ativo
            </button>
          </div>
          {campaign.channels.length === 0 ? (
            <div className="campaign-empty-state">
              <span>
                <FiTarget aria-hidden="true" />
              </span>
              <h2>Sua campanha ainda não possui canais</h2>
              <p>
                Adicione onde ela será divulgada para começarmos a medir os
                resultados.
              </p>
              <button
                className="button"
                type="button"
                onClick={() => setShowChannelDialog(true)}
              >
                Adicionar canal
              </button>
            </div>
          ) : (
            <div className="campaign-distribution-groups">
              {campaign.channels.map((channel) => (
                <section
                  key={channel.id}
                  className="campaign-distribution-group"
                >
                  <header>
                    <div>
                      <span>{channel.type}</span>
                      <h3>{channel.name}</h3>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      title="Verificar destino"
                      aria-label={`Verificar destino de ${channel.name}`}
                      disabled={busy}
                      onClick={() => void runMonitor(channel.id)}
                    >
                      <FiActivity aria-hidden="true" />
                    </button>
                  </header>
                  {channel.assets.length ? (
                    <ul>
                      {channel.assets.map((asset) => (
                        <li key={asset.id}>
                          <div>
                            <strong>{asset.name}</strong>
                            <span>
                              {assetTypeLabel(asset)} · {asset.clicks} cliques
                            </span>
                          </div>
                          <span
                            className={
                              asset.status === "active"
                                ? "campaign-item-ok"
                                : "campaign-item-muted"
                            }
                          >
                            {asset.status === "active"
                              ? "Funcionando"
                              : "Desativado"}
                          </span>
                          <details className="campaign-asset-menu">
                            <summary aria-label={`Opções de ${asset.name}`}>
                              <FiMoreHorizontal aria-hidden="true" />
                            </summary>
                            <div>
                              {assetActions(asset).map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => {
                                    if (action === "Copiar link")
                                      void copy(asset.distributionUrl);
                                    if (
                                      action === "Testar destino" &&
                                      asset.destinationUrl
                                    )
                                      window.open(
                                        asset.destinationUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                    if (action === "Ver QR" && asset.qr)
                                      window.open(
                                        asset.qr.encodedUrl,
                                        "_blank",
                                        "noopener,noreferrer",
                                      );
                                  }}
                                >
                                  {action}
                                </button>
                              ))}
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="campaign-channel-empty">
                      <p>Este canal ainda não possui pontos de distribuição.</p>
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setShowAssetDialog(true)}
                      >
                        <FiPlus aria-hidden="true" /> Criar ponto
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "analytics" && (
        <section className="campaign-dashboard-stack">
          <div className="campaign-section-heading">
            <div>
              <span className="workspace-section-kicker">Desempenho</span>
              <h2>Resultados da campanha</h2>
              <p>
                As métricas aparecem conforme o tracking existente registra
                eventos.
              </p>
            </div>
          </div>
          {!insights ? (
            <p role="status">Carregando os resultados da campanha...</p>
          ) : !hasTraffic ? (
            <div className="campaign-empty-state">
              <span>
                <FiActivity aria-hidden="true" />
              </span>
              <h2>Ainda não há dados para analisar.</h2>
              <p>
                Os resultados aparecem quando alguém usa um ponto de
                distribuição.
              </p>
            </div>
          ) : (
            <dl className="campaign-results">
              <div>
                <dt>Visitantes</dt>
                <dd>{insights.overview.visitors}</dd>
                <small>Sessões rastreadas na campanha</small>
              </div>
              <div>
                <dt>Interações</dt>
                <dd>{interactions}</dd>
                <small>Eventos reais de contato</small>
              </div>
              <div>
                <dt>Contatos</dt>
                <dd>{campaign.metrics.contacts}</dd>
                <small>Formulários e Smart Cards</small>
              </div>
              <div>
                <dt>Conversões</dt>
                <dd>{insights.overview.conversions}</dd>
                <small>Goals concluídos</small>
              </div>
              <div>
                <dt>CVR</dt>
                <dd>{formatPercentage(insights.overview.conversionRate)}</dd>
                <small>Conversões por visitante</small>
              </div>
            </dl>
          )}
          <section className="workspace-panel">
            <div className="campaign-section-heading">
              <h2>Cliques ao longo do tempo</h2>
            </div>
            {campaign.metrics.daily.length ? (
              <div className="campaign-chart campaign-chart-large">
                {campaign.metrics.daily.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.clicks} cliques`}
                  >
                    <span
                      style={{
                        height: `${Math.max((day.clicks / maximum) * 100, day.clicks ? 4 : 1)}%`,
                      }}
                    />
                    <small>{new Date(day.date).getDate()}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p>Ainda não há dados suficientes.</p>
            )}
          </section>
          <section className="workspace-panel">
            <div className="campaign-section-heading">
              <h2>Desempenho por distribuição</h2>
            </div>
            {insights?.distributions.items.length ? (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Distribuição</th>
                      <th>Visitantes</th>
                      <th>Interações</th>
                      <th>Conversões</th>
                      <th>CVR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.distributions.items.map((distribution) => (
                      <tr key={distribution.id}>
                        <th scope="row">
                          {distribution.name}
                          <small>{distribution.channel.name}</small>
                        </th>
                        <td>{distribution.visitors}</td>
                        <td>{distribution.interactions}</td>
                        <td>{distribution.conversions}</td>
                        <td>{formatPercentage(distribution.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Crie pontos de distribuição para comparar os resultados.</p>
            )}
          </section>
        </section>
      )}

      {tab === "monitoring" && (
        <section className="campaign-dashboard-stack">
          <div className="campaign-section-heading">
            <div>
              <span className="workspace-section-kicker">Monitoramento</span>
              <h2>Saúde dos pontos de distribuição</h2>
              <p>O LinkOr só apresenta verificações que já foram executadas.</p>
            </div>
          </div>
          <section className="workspace-panel">
            <ul className="campaign-monitor-list">
              {campaign.channels.map((channel) => {
                const latest = campaign.monitoringChecks.find(
                  (check) => check.channelId === channel.id,
                );
                return (
                  <li key={channel.id}>
                    <div>
                      <strong>{channel.name}</strong>
                      <span>
                        {latest
                          ? `HTTP ${latest.httpStatus ?? "—"} · ${latest.responseTimeMs ?? "—"}ms`
                          : "Ainda não verificado"}
                      </span>
                    </div>
                    <span
                      className={`campaign-monitor-status is-${latest?.status ?? "unknown"}`}
                    >
                      {latest?.status === "up"
                        ? "Online"
                        : latest?.status === "degraded"
                          ? "Lento"
                          : latest?.status === "down"
                            ? "Indisponível"
                            : "Sem verificação"}
                    </span>
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void runMonitor(channel.id)}
                    >
                      Verificar agora
                    </button>
                  </li>
                );
              })}
            </ul>
            {campaign.channels.length === 0 && (
              <p>Adicione um canal para começar a monitorar destinos.</p>
            )}
          </section>
          <section className="workspace-panel">
            <div className="campaign-section-heading">
              <h2>Incidentes recentes</h2>
            </div>
            {campaign.incidents.length ? (
              <ul className="campaign-incident-list">
                {campaign.incidents.map((incident) => (
                  <li key={incident.id}>
                    <FiAlertTriangle aria-hidden="true" />
                    <div>
                      <strong>{incident.message}</strong>
                      <span>
                        {formatDate(incident.createdAt, true)} ·{" "}
                        {incident.status === "recovered"
                          ? "Resolvido"
                          : "Em acompanhamento"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum incidente registrado.</p>
            )}
          </section>
        </section>
      )}

      {tab === "settings" && (
        <section className="campaign-dashboard-stack">
          <div className="campaign-section-heading">
            <div>
              <span className="workspace-section-kicker">Configurações</span>
              <h2>Como medir o sucesso</h2>
              <p>Escolha um Goal já configurado neste workspace.</p>
            </div>
          </div>
          <section className="workspace-panel campaign-form-grid">
            <label className="campaign-field campaign-field-wide">
              <span>Objetivo principal</span>
              <select
                value={primaryGoalId}
                onChange={(event) => setPrimaryGoalId(event.target.value)}
              >
                <option value="">Nenhum objetivo principal</option>
                {goalOptions.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </label>
            {goalOptions.length ? (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => void savePrimaryGoal()}
              >
                Salvar objetivo principal
              </button>
            ) : (
              <p>
                Crie um Goal antes de defini-lo como o objetivo principal da
                campanha.
              </p>
            )}
            <Link className="text-button" href="/untrack/analytics/goals">
              Gerenciar Goals
            </Link>
          </section>
        </section>
      )}

      {tab === "history" && (
        <section className="campaign-history">
          <div className="campaign-section-heading">
            <div>
              <span className="workspace-section-kicker">Histórico</span>
              <h2>Alterações da campanha</h2>
              <p>Registros de ações feitas por pessoas do workspace.</p>
            </div>
          </div>
          {campaign.activities.length ? (
            <ol className="campaign-timeline">
              {campaign.activities.map((activity) => (
                <li key={activity.id}>
                  <time>
                    {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(activity.createdAt))}
                  </time>
                  <p>
                    <strong>{activity.actor.name}</strong>{" "}
                    {activityLabel(activity.action)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="campaign-empty-state">
              <span>
                <FiClipboard aria-hidden="true" />
              </span>
              <h2>Sem alterações registradas</h2>
              <p>As próximas mudanças feitas nesta campanha aparecerão aqui.</p>
            </div>
          )}
        </section>
      )}

      {showChannelDialog && (
        <ChannelDialog
          campaign={campaign}
          onClose={() => setShowChannelDialog(false)}
          onCreated={() => void loadCampaign()}
        />
      )}
      {showAssetDialog && (
        <AssetDialog
          campaign={campaign}
          onClose={() => setShowAssetDialog(false)}
          onCreated={() => void loadCampaign()}
        />
      )}
    </section>
  );
}
