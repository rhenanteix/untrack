"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "./shared";

type Goal = {
  id: string;
  name: string;
  description: string | null;
  eventName: string;
  assetType: string | null;
  assetId: string | null;
  active: boolean;
  _count: { events: number };
};

const events = [
  ["link_click", "Clique em link"],
  ["whatsapp_click", "Clique no WhatsApp"],
  ["form_submit", "Envio de formulário"],
  ["lead_created", "Lead criado"],
  ["qr_scan", "Leitura de QR Code"],
  ["smart_page_view", "Visualização de Smart Page"],
  ["checkout_started", "Checkout iniciado"],
  ["payment_completed", "Pagamento concluído"],
] as const;

export function AnalyticsGoals() {
  const [items, setItems] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setItems(await apiRequest<Goal[]>("/api/workspace/analytics/goals"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar objetivos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest<Goal[]>("/api/workspace/analytics/goals")
      .then((goals) => {
        if (active) setItems(goals);
      })
      .catch((loadError: Error) => {
        if (active)
          setError(
            loadError.message || "Não foi possível carregar objetivos.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest("/api/workspace/analytics/goals", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description") || undefined,
          eventName: data.get("eventName"),
          assetType: data.get("assetType") || undefined,
          assetId: data.get("assetId") || undefined,
        }),
      });
      event.currentTarget.reset();
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar objetivo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/workspace/analytics/goals", { method: "DELETE", body: JSON.stringify({ id }) });
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível remover objetivo.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="workspace-page analytics-goals-page"><header className="workspace-page-heading"><div><span className="eyebrow">Conversões</span><h1>Objetivos</h1><p>Defina interações reais que representam uma conversão.</p></div><button className="button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>+ Criar objetivo</button></header>{error && <p role="alert" className="form-error">{error}</p>}{open && <form className="workspace-panel analytics-goal-form" onSubmit={submit}><label>Nome<input name="name" required maxLength={120} /></label><label>Descrição opcional<input name="description" maxLength={500} /></label><label>Conversão quando<select name="eventName" defaultValue="link_click">{events.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Ativo específico opcional<select name="assetType" defaultValue=""><option value="">Qualquer ativo</option><option value="smart_page">Smart Page</option><option value="link">Link</option><option value="smart_card">Smart Card</option><option value="qr_code">QR Code</option><option value="campaign">Campanha</option><option value="product">Produto</option></select></label><label>ID do ativo<input name="assetId" maxLength={255} /></label><div><button className="button" type="submit" disabled={busy}>{busy ? "Criando..." : "Criar objetivo"}</button></div></form>}{loading ? <p role="status" className="analytics-muted">Carregando objetivos...</p> : items.length ? <section className="workspace-panel analytics-table-panel"><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Objetivo</th><th>Quando</th><th>Ativo</th><th>Conversões</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{items.map((goal) => <tr key={goal.id}><td><strong>{goal.name}</strong>{goal.description && <small>{goal.description}</small>}</td><td>{goal.eventName.replaceAll("_", " ")}</td><td>{goal.assetType ? `${goal.assetType}${goal.assetId ? `: ${goal.assetId}` : ""}` : "Qualquer ativo"}</td><td>{goal._count.events}</td><td><button className="analytics-icon-button" type="button" aria-label={`Remover ${goal.name}`} disabled={busy} onClick={() => void remove(goal.id)}>×</button></td></tr>)}</tbody></table></div></section> : <section className="workspace-empty-state"><h2>Crie seu primeiro objetivo para medir conversões.</h2><p>Objetivos relacionam cliques, formulários, leads e outras interações ao resultado que importa.</p></section>}</div>;
}