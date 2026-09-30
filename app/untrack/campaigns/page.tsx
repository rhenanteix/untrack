"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest, useAction, ActionStatus } from "@/components/untrack/shared";
import type { CampaignStatus } from "@/modules/campaigns/schemas";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  client?: { name: string } | null;
  responsible?: { name: string } | null;
  createdAt: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const action = useAction();

  useEffect(() => {
    apiRequest<{ campaigns: Campaign[] }>("/api/campaigns")
      .then((data) => { setCampaigns(data.campaigns); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function createCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    await action.run(async () => {
      const result = await apiRequest<{ id: string; name: string }>("/api/campaigns", { method: "POST", body: JSON.stringify({ name }) });
      setCampaigns((prev) => [{ id: result.id, name: result.name, status: "draft", createdAt: new Date().toISOString() }, ...prev]);
      form.reset();
    });
  }

  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Untrack</span>
        <h1>Campanhas</h1>
        <p>Organize campanhas, canais, UTMs e monitoramento em um só lugar.</p>
      </div>

      <form className="tool-card account-form" onSubmit={createCampaign}>
        <h2>Nova campanha</h2>
        <label>Nome<input required maxLength={120} name="name" /></label>
        <button className="button" disabled={action.busy}>Criar</button>
        <ActionStatus {...action} />
      </form>

      {error && <p role="alert" className="error">{error}</p>}
      {loading ? <p role="status">Carregando...</p> : (
        <ul className="resource-list">
          {campaigns.map((c) => (
            <li key={c.id} className="resource-card">
              <Link href={`/untrack/campaigns/${c.id}`} className="resource-link">
                <strong>{c.name}</strong>
                <span className="badge">{c.status}</span>
                <span>{c.client?.name ?? "—"}</span>
                <span>{c.responsible?.name ?? "—"}</span>
                <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
              </Link>
            </li>
          ))}
          {campaigns.length === 0 && <p>Nenhuma campanha encontrada.</p>}
        </ul>
      )}
    </section>
  );
}
