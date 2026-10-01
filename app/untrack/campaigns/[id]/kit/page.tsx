"use client";
import { use, useEffect, useState, useCallback } from "react";
import { apiRequest, useAction, ActionStatus } from "@/components/untrack/shared";
import type { CampaignKitProposal } from "@/modules/campaigns/schemas";

interface Campaign { id: string; name: string; }

export default function CampaignKitPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [destination, setDestination] = useState("");
  const [channels, setChannels] = useState<Array<{ type: string; name: string }>>([{ type: "link", name: "Canal 1" }]);
  const [proposal, setProposal] = useState<CampaignKitProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const action = useAction();

  const loadCampaign = useCallback(async () => {
    try {
      const data = await apiRequest<{ campaign: Campaign }>(`/api/campaigns?campaignId=${params.id}`);
      setCampaign(data.campaign);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, [params.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadCampaign(); }, [loadCampaign]);

  function addChannel() { setChannels((prev) => [...prev, { type: "link", name: `Canal ${prev.length + 1}` }]); }
  function removeChannel(index: number) { setChannels((prev) => prev.filter((_, i) => i !== index)); }
  function updateChannel(index: number, field: string, value: string) { setChannels((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c)); }

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    await action.run(async () => {
      const result = await apiRequest<CampaignKitProposal>(`/api/campaigns?action=kit-propose`, { method: "POST", body: JSON.stringify({ input: { destination, channels, campaignName: campaign?.name } }) });
      setProposal(result);
    });
  }

  async function save() {
    if (!proposal) return;
    await action.run(async () => {
      await apiRequest(`/api/campaigns?action=kit-save`, { method: "POST", body: JSON.stringify({ campaignId: params.id, proposal }) });
      alert("Kit salvo com sucesso!");
    });
  }

  if (loading) return <section className="shell page-section"><p role="status">Carregando...</p></section>;
  if (error) return <section className="shell page-section"><p role="alert">{error}</p></section>;
  if (!campaign) return <section className="shell page-section"><p>Campanha não encontrada.</p></section>;

  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Untrack</span>
        <h1>Kit de campanha: {campaign.name}</h1>
        <p>Informe o destino e os canais para gerar UTMs, links e QR Codes.</p>
      </div>

      <form className="tool-card account-form" onSubmit={propose}>
        <h2>Configuração</h2>
        <label>URL de destino<input required type="url" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="https://exemplo.com" /></label>
        {channels.map((ch, i) => (
          <div key={i} className="channel-row">
            <label>Tipo<select value={ch.type} onChange={(e) => updateChannel(i, "type", e.target.value)}><option value="social">Social</option><option value="email">Email</option><option value="paid">Pago</option><option value="organic">Orgânico</option><option value="qr">QR</option></select></label>
            <label>Nome<input required value={ch.name} onChange={(e) => updateChannel(i, "name", e.target.value)} /></label>
            {channels.length > 1 && <button type="button" className="button secondary" onClick={() => removeChannel(i)}>Remover</button>}
          </div>
        ))}
        <button type="button" className="button secondary" onClick={addChannel}>Adicionar canal</button>
        <button className="button" disabled={action.busy}>Gerar proposta</button>
        <ActionStatus {...action} />
      </form>

      {proposal && (
        <div className="tool-card">
          <h2>Proposta gerada</h2>
          {proposal.channels.map((ch, i) => (
            <div key={i} className="resource-card">
              <strong>{ch.name}</strong>
              <span className="badge">{ch.type}</span>
              <span>Destino: {ch.destinationUrl}</span>
              <span>UTM: {ch.utmSource} / {ch.utmMedium} / {ch.utmCampaign}</span>
              <span>Slug: {ch.shortLinkSlug}</span>
              <span>QR: {ch.qrToken}</span>
            </div>
          ))}
          <button className="button" onClick={save} disabled={action.busy}>Salvar kit na campanha</button>
        </div>
      )}
    </section>
  );
}
