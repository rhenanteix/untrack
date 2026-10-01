"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Image from "next/image";
import {
  FiArchive,
  FiCopy,
  FiExternalLink,
  FiGrid,
  FiLink,
  FiMessageCircle,
  FiPlus,
} from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";
import { buildWhatsAppUrl } from "@/modules/whatsapp/domain";
import { apiRequest } from "./shared";

type Campaign = { id: string; name: string };
type Tracking = {
  enabled: boolean;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};
type WhatsAppLink = {
  id: string;
  name: string;
  phoneNumber: string;
  message: string;
  whatsappUrl: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  campaign: Campaign | null;
  campaignId: string | null;
  trackingConfig: Tracking;
  smartLink: { id: string; slug: string; url: string; clicks: number; isActive: boolean } | null;
  score: { score: number; checks: { label: string; configured: boolean; points: number }[] };
  createdAt: string;
  updatedAt: string;
};
type QrResult = { dataUrl: string };

const initialForm = {
  name: "",
  phoneNumber: "",
  message: "",
  campaignId: "",
  trackingEnabled: true,
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
};

function formatPhone(phoneNumber: string) {
  return `+${phoneNumber}`;
}

export function WhatsAppIntelligence() {
  const [links, setLinks] = useState<WhatsAppLink[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qrByLink, setQrByLink] = useState<Record<string, string>>({});
  const [utmByLink, setUtmByLink] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await apiRequest<{ items: WhatsAppLink[] }>(
          `/api/whatsapp/links?search=${encodeURIComponent(deferredSearch)}`,
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setLinks(result.items);
      } catch (loadError) {
        if (!controller.signal.aborted)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os links do WhatsApp.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [deferredSearch]);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: Campaign[] }>("/api/workspace/campaigns?page=1", {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setCampaigns(result.items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  let previewUrl = "";
  try {
    if (form.phoneNumber)
      previewUrl = buildWhatsAppUrl(form.phoneNumber, form.message);
  } catch {
    previewUrl = "";
  }

  function updateForm(field: keyof typeof initialForm, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const trackingConfig: Tracking = {
        enabled: form.trackingEnabled,
        ...(form.source ? { source: form.source } : {}),
        ...(form.medium ? { medium: form.medium } : {}),
        ...(form.campaign ? { campaign: form.campaign } : {}),
        ...(form.content ? { content: form.content } : {}),
        ...(form.term ? { term: form.term } : {}),
      };
      const link = await apiRequest<WhatsAppLink>("/api/whatsapp/links", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phoneNumber: form.phoneNumber,
          message: form.message,
          campaignId: form.campaignId || null,
          trackingConfig,
        }),
      });
      setLinks((current) => [link, ...current]);
      setForm(initialForm);
      setShowAdvanced(false);
      setNotice("Seu link inteligente do WhatsApp está pronto.");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Não foi possível criar o link do WhatsApp.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copySmartLink(link: WhatsAppLink) {
    if (!link.smartLink) return;
    setError("");
    try {
      await navigator.clipboard.writeText(link.smartLink.url);
      analytics.track("whatsapp_link_copied");
      setNotice("Link inteligente copiado.");
    } catch {
      setError("Não foi possível copiar o link. Selecione e copie manualmente.");
    }
  }

  async function generateQr(link: WhatsAppLink) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<QrResult>(`/api/whatsapp/links/${link.id}/qr`, {
        method: "POST",
      });
      setQrByLink((current) => ({ ...current, [link.id]: result.dataUrl }));
      setNotice("QR Code gerado para o link inteligente.");
    } catch (qrError) {
      setError(
        qrError instanceof Error
          ? qrError.message
          : "Não foi possível gerar o QR Code.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateUtm(link: WhatsAppLink) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest<{ url: string }>(
        `/api/whatsapp/links/${link.id}/utm`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setUtmByLink((current) => ({ ...current, [link.id]: result.url }));
      setNotice("UTM governada gerada para este smart link.");
    } catch (utmError) {
      setError(
        utmError instanceof Error
          ? utmError.message
          : "Não foi possível gerar a UTM.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function archiveLink(link: WhatsAppLink) {
    if (!window.confirm(`Arquivar “${link.name}”? O smart link deixará de redirecionar.`))
      return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/whatsapp/links/${link.id}`, { method: "DELETE" });
      setLinks((current) =>
        current.map((item) =>
          item.id === link.id ? { ...item, status: "ARCHIVED", smartLink: item.smartLink ? { ...item.smartLink, isActive: false } : null } : item,
        ),
      );
      setNotice("Link arquivado.");
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Não foi possível arquivar o link.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-page whatsapp-intelligence">
      <div className="workspace-page-heading whatsapp-heading">
        <div>
          <span className="eyebrow">WhatsApp Intelligence</span>
          <h1>WhatsApp Intelligence</h1>
          <p>
            Crie links para WhatsApp, acompanhe de onde vêm os cliques e transforme campanhas em canais mensuráveis.
          </p>
        </div>
      </div>

      <div className="whatsapp-builder-grid">
        <form className="workspace-panel whatsapp-builder" onSubmit={createLink}>
          <div className="workspace-panel-heading">
            <div>
              <h2>Criar link para WhatsApp</h2>
              <p>Comece pelo essencial.</p>
            </div>
            <FiMessageCircle aria-hidden="true" />
          </div>
          <label>
            Nome
            <input
              required
              maxLength={120}
              value={form.name}
              placeholder="Vendas Instagram"
              onChange={(event) => updateForm("name", event.target.value)}
            />
          </label>
          <label>
            Número do WhatsApp
            <input
              required
              inputMode="tel"
              maxLength={80}
              value={form.phoneNumber}
              placeholder="+55 (11) 99999-9999"
              onChange={(event) => updateForm("phoneNumber", event.target.value)}
            />
          </label>
          <label>
            Mensagem do WhatsApp
            <textarea
              maxLength={4096}
              rows={5}
              value={form.message}
              placeholder="Olá! Gostaria de saber mais."
              onChange={(event) => updateForm("message", event.target.value)}
            />
            <small>{form.message.length} / 4096</small>
          </label>
          <details open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}>
            <summary>Opções avançadas</summary>
            <div className="whatsapp-advanced-fields">
              <label>
                Campanha
                <select value={form.campaignId} onChange={(event) => updateForm("campaignId", event.target.value)}>
                  <option value="">Sem campanha</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </label>
              <label className="whatsapp-toggle">
                <input
                  type="checkbox"
                  checked={form.trackingEnabled}
                  onChange={(event) => updateForm("trackingEnabled", event.target.checked)}
                />
                <span>Ativar tracking</span>
              </label>
              {form.trackingEnabled && (
                <div className="whatsapp-source-grid">
                  <label>
                    Origem
                    <input value={form.source} maxLength={120} placeholder="Instagram" onChange={(event) => updateForm("source", event.target.value)} />
                  </label>
                  <label>
                    Meio
                    <input value={form.medium} maxLength={120} placeholder="social" onChange={(event) => updateForm("medium", event.target.value)} />
                  </label>
                  <label>
                    Campanha UTM
                    <input value={form.campaign} maxLength={120} placeholder="black-friday" onChange={(event) => updateForm("campaign", event.target.value)} />
                  </label>
                  <label>
                    Conteúdo
                    <input value={form.content} maxLength={120} placeholder="whatsapp-cta" onChange={(event) => updateForm("content", event.target.value)} />
                  </label>
                  <label>
                    Termo
                    <input value={form.term} maxLength={120} placeholder="oferta" onChange={(event) => updateForm("term", event.target.value)} />
                  </label>
                </div>
              )}
            </div>
          </details>
          <button className="button" disabled={busy}>
            <FiPlus aria-hidden="true" /> Criar link
          </button>
        </form>

        <section className="workspace-panel whatsapp-preview" aria-live="polite">
          <span className="eyebrow">Prévia</span>
          <h2>WhatsApp Preview</h2>
          <div className="whatsapp-preview-message">
            {form.message || "Sua mensagem aparecerá aqui."}
          </div>
          <dl>
            <div>
              <dt>Destino</dt>
              <dd>{form.phoneNumber ? formatPhone(form.phoneNumber.replace(/\D/g, "")) : "Número não informado"}</dd>
            </div>
            <div>
              <dt>URL oficial</dt>
              <dd>{previewUrl || "Informe um número válido para gerar a URL."}</dd>
            </div>
          </dl>
          <p className="whatsapp-preview-note">Cliques no smart link são rastreados. Eles não representam conversas iniciadas.</p>
        </section>
      </div>

      <div className="whatsapp-library-heading">
        <div>
          <h2>Seus links do WhatsApp</h2>
          <p>Cliques registrados no link inteligente.</p>
        </div>
        <label className="whatsapp-search">
          <span className="sr-only">Buscar links do WhatsApp</span>
          <input
            type="search"
            value={search}
            maxLength={120}
            placeholder="Buscar por nome, número ou campanha"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div aria-live="polite" className="whatsapp-feedback">
        {busy && <p role="status">Processando...</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      {loading ? <p role="status">Carregando links...</p> : null}
      {!loading && !error && !links.length ? (
        <section className="workspace-panel whatsapp-empty">
          <FiMessageCircle aria-hidden="true" />
          <h2>Nenhum link do WhatsApp ainda</h2>
          <p>Crie seu primeiro link e comece a acompanhar de onde vêm os cliques.</p>
        </section>
      ) : null}
      {!loading && links.length ? (
        <div className="whatsapp-table-wrap">
          <table className="whatsapp-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Destino</th>
                <th>Campanha</th>
                <th>Cliques</th>
                <th>Score</th>
                <th>Status</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td data-label="Nome"><strong>{link.name}</strong><small>{link.trackingConfig.source || "Direto"}</small></td>
                  <td data-label="Destino">{formatPhone(link.phoneNumber)}</td>
                  <td data-label="Campanha">{link.campaign?.name ?? "Sem campanha"}</td>
                  <td data-label="Cliques">{link.smartLink?.clicks ?? 0}</td>
                  <td data-label="Score"><span className="whatsapp-score">{link.score.score}</span></td>
                  <td data-label="Status"><span className={`whatsapp-status ${link.status.toLowerCase()}`}>{link.status === "ACTIVE" ? "Ativo" : link.status === "DRAFT" ? "Rascunho" : "Arquivado"}</span></td>
                  <td className="whatsapp-actions">
                    {link.smartLink && link.status === "ACTIVE" && <>
                      <button className="icon-button" type="button" title="Copiar link inteligente" aria-label="Copiar link inteligente" onClick={() => void copySmartLink(link)}><FiCopy aria-hidden="true" /></button>
                      <a className="icon-button" title="Abrir link inteligente" aria-label="Abrir link inteligente" href={link.smartLink.url} target="_blank" rel="noreferrer"><FiExternalLink aria-hidden="true" /></a>
                      <button className="icon-button" type="button" title="Gerar UTM governada" aria-label="Gerar UTM governada" disabled={busy} onClick={() => void generateUtm(link)}><FiLink aria-hidden="true" /></button>
                      <button className="icon-button" type="button" title="Gerar QR Code" aria-label="Gerar QR Code" disabled={busy} onClick={() => void generateQr(link)}><FiGrid aria-hidden="true" /></button>
                    </>}
                    {link.status !== "ARCHIVED" && <button className="icon-button danger" type="button" title="Arquivar link" aria-label="Arquivar link" disabled={busy} onClick={() => void archiveLink(link)}><FiArchive aria-hidden="true" /></button>}
                    {qrByLink[link.id] && <Image className="whatsapp-qr" src={qrByLink[link.id]} alt={`QR Code de ${link.name}`} width={94} height={94} unoptimized />}
                    {utmByLink[link.id] && <a className="whatsapp-utm-link" href={utmByLink[link.id]} target="_blank" rel="noreferrer">Abrir UTM</a>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}