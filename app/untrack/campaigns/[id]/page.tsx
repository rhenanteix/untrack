"use client";
import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  apiRequest,
  useAction,
  ActionStatus,
} from "@/components/untrack/shared";
import type {
  CampaignStatus,
  ChannelType,
  ChecklistStatus,
  ChecklistSeverity,
  MonitorStatus,
  IncidentStatus,
} from "@/modules/campaigns/schemas";

interface Campaign {
  id: string;
  name: string;
  description: string;
  objective: string;
  status: CampaignStatus;
  startDate?: string | null;
  endDate?: string | null;
  client?: { name: string } | null;
  responsible?: { name: string } | null;
  channels: Channel[];
  checklistItems: ChecklistItem[];
  approvals: Approval[];
}

interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  destinationUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  monitorEnabled: boolean;
  monitorFrequencyMinutes: number;
}

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  status: ChecklistStatus;
  severity: ChecklistSeverity;
  checkedAt?: string | null;
}

interface Approval {
  id: string;
  action: string;
  notes: string;
  createdAt: string;
  approver: { name: string };
}

interface MonitorCheck {
  id: string;
  status: MonitorStatus;
  httpStatus?: number | null;
  responseTimeMs?: number | null;
  checkedAt: string;
}

interface Incident {
  id: string;
  code: string;
  message: string;
  status: IncidentStatus;
  severity: string;
  confirmed: boolean;
  createdAt: string;
}

type Tab =
  "overview" | "channels" | "checklist" | "monitor" | "incidents" | "history";

export default function CampaignDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const search = useSearchParams();
  const back = search.get("returnTo")?.startsWith("/untrack/campaigns?")
    ? search.get("returnTo")!
    : "/untrack/campaigns";
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [monitors, setMonitors] = useState<MonitorCheck[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const action = useAction();

  const loadCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ campaign: Campaign }>(
        `/api/campaigns?campaignId=${params.id}`,
      );
      setCampaign(data.campaign);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCampaign();
  }, [loadCampaign]);

  async function addChannel(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      type: (form.elements.namedItem("type") as HTMLSelectElement).value,
      destinationUrl: (
        form.elements.namedItem("destinationUrl") as HTMLInputElement
      ).value,
    };
    await action.run(async () => {
      const result = await apiRequest<Channel>(
        `/api/campaigns?action=channel`,
        {
          method: "POST",
          body: JSON.stringify({ campaignId: params.id, ...data }),
        },
      );
      setCampaign((prev) =>
        prev ? { ...prev, channels: [...prev.channels, result] } : prev,
      );
      form.reset();
    });
  }

  async function runChecklist() {
    await action.run(async () => {
      const result = await apiRequest<{ items: ChecklistItem[] }>(
        `/api/campaigns?action=checklist-run`,
        { method: "POST", body: JSON.stringify({ campaignId: params.id }) },
      );
      setCampaign((prev) =>
        prev ? { ...prev, checklistItems: result.items } : prev,
      );
    });
  }

  async function runMonitor() {
    await action.run(async () => {
      const result = await apiRequest<MonitorCheck>(
        `/api/campaigns?action=monitor-check`,
        { method: "POST", body: JSON.stringify({ campaignId: params.id }) },
      );
      setMonitors((prev) => [result, ...prev]);
    });
  }

  async function loadIncidents() {
    const data = await apiRequest<{ incidents: Incident[] }>(
      `/api/campaigns?action=incidents&campaignId=${params.id}`,
    );
    setIncidents(data.incidents);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "incidents") void loadIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, params.id]);

  if (loading)
    return (
      <section className="shell page-section">
        <p role="status">Carregando campanha...</p>
      </section>
    );
  if (error)
    return (
      <section className="shell page-section">
        <p role="alert">{error}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </section>
    );
  if (!campaign)
    return (
      <section className="shell page-section">
        <p>Campanha não encontrada.</p>
      </section>
    );

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "channels", label: "Canais" },
    { key: "checklist", label: "Checklist" },
    { key: "monitor", label: "Monitoramento" },
    { key: "incidents", label: "Incidentes" },
    { key: "history", label: "Histórico" },
  ];

  return (
    <section className="shell page-section">
      <Link className="back-link" href={back}>
        ← Voltar às campanhas
      </Link>
      <div className="page-heading">
        <span className="eyebrow">Untrack</span>
        <h1>{campaign.name}</h1>
        <p>{campaign.description || "Sem descrição."}</p>
      </div>

      <nav className="tab-nav" aria-label="Abas da campanha">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="tool-card">
          <h2>Visão geral</h2>
          <p>
            <strong>Objetivo:</strong> {campaign.objective || "—"}
          </p>
          <p>
            <strong>Cliente:</strong> {campaign.client?.name ?? "—"}
          </p>
          <p>
            <strong>Responsável:</strong> {campaign.responsible?.name ?? "—"}
          </p>
          <p>
            <strong>Período:</strong>{" "}
            {campaign.startDate
              ? new Date(campaign.startDate).toLocaleDateString("pt-BR")
              : "—"}{" "}
            a{" "}
            {campaign.endDate
              ? new Date(campaign.endDate).toLocaleDateString("pt-BR")
              : "—"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <span className="badge">{campaign.status}</span>
          </p>
          <div className="actions">
            <Link
              href={`/untrack/campaigns/${campaign.id}/kit`}
              className="button"
            >
              Kit de campanha
            </Link>
            <button
              className="button"
              onClick={runChecklist}
              disabled={action.busy}
            >
              Executar checklist
            </button>
          </div>
          <ActionStatus {...action} />
        </div>
      )}

      {tab === "channels" && (
        <div className="tool-card">
          <h2>Canais</h2>
          <form className="account-form" onSubmit={addChannel}>
            <label>
              Nome
              <input required maxLength={120} name="name" />
            </label>
            <label>
              Tipo
              <select required name="type">
                <option value="social">Social</option>
                <option value="email">Email</option>
                <option value="paid">Pago</option>
                <option value="organic">Orgânico</option>
                <option value="qr">QR</option>
                <option value="link">Link</option>
              </select>
            </label>
            <label>
              URL de destino
              <input required type="url" name="destinationUrl" />
            </label>
            <button className="button" disabled={action.busy}>
              Adicionar
            </button>
          </form>
          <ActionStatus {...action} />
          <ul className="resource-list">
            {campaign.channels.map((ch) => (
              <li key={ch.id} className="resource-card">
                <strong>{ch.name}</strong>
                <span className="badge">{ch.type}</span>
                <span>{ch.destinationUrl}</span>
                <span>
                  UTM: {ch.utmSource ?? "—"} / {ch.utmMedium ?? "—"} /{" "}
                  {ch.utmCampaign ?? "—"}
                </span>
                <span>
                  Monitor:{" "}
                  {ch.monitorEnabled
                    ? `A cada ${ch.monitorFrequencyMinutes}min`
                    : "Desativado"}
                </span>
              </li>
            ))}
            {campaign.channels.length === 0 && <p>Nenhum canal configurado.</p>}
          </ul>
        </div>
      )}

      {tab === "checklist" && (
        <div className="tool-card">
          <h2>Checklist pré-publicação</h2>
          <button
            className="button"
            onClick={runChecklist}
            disabled={action.busy}
          >
            Executar verificação
          </button>
          <ActionStatus {...action} />
          {campaign.checklistItems.length === 0 ? (
            <p>Nenhuma verificação registrada.</p>
          ) : (
            <ul className="resource-list">
              {campaign.checklistItems.map((item) => (
                <li key={item.id} className={`checklist-item ${item.severity}`}>
                  <span className={`badge ${item.status}`}>{item.status}</span>
                  <strong>{item.label}</strong>
                  <span>{item.category}</span>
                  <span>
                    {item.checkedAt
                      ? new Date(item.checkedAt).toLocaleString("pt-BR")
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "monitor" && (
        <div className="tool-card">
          <h2>Monitoramento</h2>
          <button
            className="button"
            onClick={runMonitor}
            disabled={action.busy}
          >
            Verificar agora
          </button>
          <ActionStatus {...action} />
          {monitors.length === 0 ? (
            <p>Sem verificações recentes.</p>
          ) : (
            <ul className="resource-list">
              {monitors.map((m) => (
                <li key={m.id} className="resource-card">
                  <span className={`badge ${m.status}`}>{m.status}</span>
                  <span>HTTP: {m.httpStatus ?? "—"}</span>
                  <span>Tempo: {m.responseTimeMs ?? "—"}ms</span>
                  <span>{new Date(m.checkedAt).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "incidents" && (
        <div className="tool-card">
          <h2>Incidentes</h2>
          <button className="button" onClick={loadIncidents}>
            Atualizar
          </button>
          {incidents.length === 0 ? (
            <p>Nenhum incidente.</p>
          ) : (
            <ul className="resource-list">
              {incidents.map((inc) => (
                <li key={inc.id} className="resource-card">
                  <span className={`badge ${inc.status}`}>{inc.status}</span>
                  <strong>{inc.code}</strong>
                  <span>{inc.message}</span>
                  <span>{inc.confirmed ? "Confirmado" : "Não confirmado"}</span>
                  <span>{new Date(inc.createdAt).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="tool-card">
          <h2>Histórico</h2>
          {campaign.approvals.length === 0 ? (
            <p>Sem histórico de aprovação.</p>
          ) : (
            <ul className="resource-list">
              {campaign.approvals.map((a) => (
                <li key={a.id} className="resource-card">
                  <span className={`badge ${a.action}`}>{a.action}</span>
                  <span>{a.approver.name}</span>
                  <span>{a.notes || "—"}</span>
                  <span>{new Date(a.createdAt).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
