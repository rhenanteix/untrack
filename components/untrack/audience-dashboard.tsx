"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiMail, FiMessageCircle, FiPlus, FiX } from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "./shared";
import styles from "./audience-dashboard.module.css";

type Exchange = {
  id: string;
  source: string;
  sourceLabel: string | null;
  intent: string | null;
  capturedAt: string;
  smartCard: { id: string; slug: string; firstName: string; lastName: string };
  campaign: { id: string; name: string } | null;
};

type FormSubmission = {
  id: string;
  source: string;
  medium: string | null;
  channel: string | null;
  values?: Record<string, string | boolean>;
  consentGiven?: boolean;
  consentText?: string | null;
  consentedAt?: string | null;
  submittedAt: string;
  form: {
    id: string;
    name: string;
    title?: string;
    fields?: Array<{ id: string; label: string; fieldType: string }>;
  };
  smartPage: { id: string; title: string; slug: string };
  campaign: { id: string; name: string } | null;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  company: string | null;
  jobTitle: string | null;
  city: string | null;
  creationSource: string;
  firstSource: string | null;
  lastSource: string | null;
  firstCampaign: string | null;
  lastCampaign: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  audienceStatus: "new" | "engaged" | "converted";
  engagementLevel: "low" | "medium" | "high";
  conversionCount: number;
  createdAt: string;
  status:
    "new_contact" | "interested" | "qualified" | "customer" | "not_interested";
  temperature: "cold" | "warm" | "hot";
  updatedAt: string;
  exchanges: Exchange[];
  formSubmissions: FormSubmission[];
  events?: {
    id: string;
    name: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }[];
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  notes?: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string };
  }>;
  conversions?: Array<{
    id: string;
    occurredAt: string;
    goal: { id: string; name: string };
    campaign: { id: string; name: string } | null;
    smartPage: { title: string } | null;
  }>;
  attribution?: {
    firstCampaign: string | null;
    lastCampaign: string | null;
    firstDistribution: {
      id: string;
      name: string;
      campaign: { name: string };
      channel: { name: string };
    } | null;
    lastDistribution: {
      id: string;
      name: string;
      campaign: { name: string };
      channel: { name: string };
    } | null;
    landingAsset: string | null;
    identifiedVia: string;
  };
  timeline?: Array<{
    id: string;
    kind: "event" | "note" | "contact" | "submission" | "exchange";
    name: string;
    occurredAt: string;
    content?: string;
    author?: string;
    context: {
      source?: string;
      smartPage?: string;
      smartCard?: string;
      form?: string;
      campaign?: string;
      distribution?: string;
    };
  }>;
  _count?: { events: number; exchanges: number };
};

const audienceStatusLabels = {
  new: "Novo",
  engaged: "Engajado",
  converted: "Convertido",
};
const engagementLabels = { low: "Baixo", medium: "Médio", high: "Alto" };

function nameOf(contact: Contact) {
  return (
    `${contact.firstName} ${contact.lastName}`.trim() || "Contato sem nome"
  );
}

function entryOf(contact: Contact) {
  const submission = contact.formSubmissions[0];
  if (submission) return submission.smartPage.title;
  const exchange = contact.exchanges[0];
  if (exchange)
    return `${exchange.smartCard.firstName} ${exchange.smartCard.lastName}`.trim();
  return "Não informado";
}

function sourceLabel(source: string | null | undefined) {
  if (!source || source.toLowerCase() === "direct") return "Direct";
  if (source.toLowerCase() === "qr") return "QR";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventLabel(event: { name: string }) {
  return (
    {
      smart_page_view: "Visitou Smart Page",
      smart_card_view: "Visitou Smart Card",
      card_view: "Visitou Smart Card",
      link_click: "Clicou em um link",
      link_clicked: "Clicou em um link",
      button_click: "Clicou em um botão",
      social_click: "Clicou em uma rede social",
      whatsapp_click: "Clicou no WhatsApp",
      whatsapp_clicked: "Clicou no WhatsApp",
      qr_scan: "Escaneou QR Code",
      form_view: "Visualizou formulário",
      form_submit: "Enviou formulário",
      form_submitted: "Enviou formulário",
      contact_captured: "Compartilhou contato",
      lead_created: "Lead capturado",
      goal_completed: "Completou objetivo",
      note_added: "Nota adicionada",
    }[event.name] ?? "Interagiu"
  );
}

function submittedValues(submission: FormSubmission) {
  return (submission.form.fields ?? []).flatMap((field) => {
    const value = submission.values?.[field.id];
    if (value === undefined) return [];
    return [
      {
        label: field.label,
        value: typeof value === "boolean" ? (value ? "Sim" : "Não") : value,
      },
    ];
  });
}

export function AudienceDashboard({
  initial,
  overview: initialOverview,
  filters: initialFilters,
  options,
  canEdit,
  managementLimit,
}: {
  initial: { items: Contact[]; page: number; total: number; hasMore: boolean };
  overview: {
    total: number;
    newContacts: number;
    converted: number;
    conversionRate: number;
    topSources: Array<{ source: string; count: number }>;
  };
  filters: {
    search: string;
    source?: string;
    campaignId?: string;
    campaignAssetId?: string;
    status?: "new" | "engaged" | "converted";
    conversion: "all" | "with";
    engagement?: "low" | "medium" | "high";
    tagId?: string;
    formId?: string;
    segmentId?: string;
    period: "all" | "7d" | "30d" | "90d" | "custom";
    from?: string;
    to?: string;
    sort: "recent" | "last_seen" | "oldest" | "name" | "engagement";
  };
  options: {
    sources: string[];
    campaigns: Array<{ id: string; name: string }>;
    tags: Array<{ id: string; name: string; color: string }>;
    forms: Array<{ id: string; name: string; title: string }>;
    distributions: Array<{
      id: string;
      name: string;
      campaign: { name: string };
      channel: { name: string };
    }>;
  };
  canEdit: boolean;
  managementLimit: { count: number; limit: number } | null;
}) {
  const [contacts, setContacts] = useState(initial.items);
  const [overview, setOverview] = useState(initialOverview);
  const [page, setPage] = useState(initial.page);
  const [total, setTotal] = useState(initial.total);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    analytics.track("audience_viewed");
  }, []);

  function queryFor(next: typeof filters, requestedPage = 1) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next))
      if (value)
        query.set(
          key === "campaignId"
            ? "campaign"
            : key === "campaignAssetId"
              ? "distribution"
              : key === "tagId"
                ? "tag"
                : key === "formId"
                  ? "form"
                  : key,
          value,
        );
    if (requestedPage > 1) query.set("page", String(requestedPage));
    return query;
  }

  async function loadContacts(next: typeof filters, requestedPage = 1) {
    setBusy(true);
    setError("");
    try {
      const query = queryFor(next, requestedPage);
      const [contactsResult, overviewResult] = await Promise.all([
        apiRequest<{
          items: Contact[];
          page: number;
          total: number;
          hasMore: boolean;
        }>(`/api/audience/contacts?${query}`),
        apiRequest<typeof overview>(`/api/audience/overview?${query}`),
      ]);
      setContacts(contactsResult.items);
      setPage(contactsResult.page);
      setTotal(contactsResult.total);
      setHasMore(contactsResult.hasMore);
      setOverview(overviewResult);
      const search = query.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${search ? `?${search}` : ""}`,
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível filtrar os contatos.");
    } finally {
      setBusy(false);
    }
  }

  async function applyFilters(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSelected(null);
    await loadContacts(filters);
    analytics.track("audience_filter_applied");
  }

  function clearFilters() {
    const next = {
      search: "",
      conversion: "all" as const,
      period: "all" as const,
      sort: "recent" as const,
    };
    setFilters(next);
    setSelected(null);
    void loadContacts(next);
  }

  async function openContact(contact: Contact) {
    setBusy(true);
    setError("");
    try {
      setSelected(
        await apiRequest<Contact>(`/api/audience/contacts/${contact.id}`),
      );
      analytics.track("contact_opened");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o contato.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!selected || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/api/audience/contacts/${selected.id}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ content: note.trim() }),
        },
      );
      setSelected(await apiRequest<Contact>(`/api/audience/contacts/${selected.id}`));
      setNote("");
      setNotice("Nota adicionada à timeline.");
      analytics.track("contact_note_created");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível atualizar o contato.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function addTag(tagId: string) {
    if (!selected || !canEdit || !tagId) return;
    setBusy(true);
    try {
      await apiRequest(`/api/audience/contacts/${selected.id}/tags`, {
        method: "POST",
        body: JSON.stringify({ tagId }),
      });
      setSelected(await apiRequest<Contact>(`/api/audience/contacts/${selected.id}`));
      analytics.track("contact_tag_added");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível adicionar a tag.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(tagId: string) {
    if (!selected || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/api/audience/contacts/${selected.id}/tags?tagId=${encodeURIComponent(tagId)}`,
        { method: "DELETE" },
      );
      setSelected(await apiRequest<Contact>(`/api/audience/contacts/${selected.id}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível remover a tag.");
    } finally {
      setBusy(false);
    }
  }

  const latestExchange = selected?.exchanges[0];
  const latestSubmission = selected?.formSubmissions[0];
  const hasLatestSubmission =
    latestSubmission !== undefined
      ? !latestExchange ||
        new Date(latestSubmission.submittedAt).getTime() >=
          new Date(latestExchange.capturedAt).getTime()
      : false;
  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Audience</span>
          <h1>Pessoas com contexto.</h1>
          <p>
            Pessoas identificadas com origem, campanha e histórico real.
          </p>
        </div>
        <div className={styles.headingActions}>
          <Link href="/untrack/audience" aria-current="page">Contatos</Link>
          <Link href="/untrack/audience/segments">Segmentos</Link>
          <Link href="/untrack/audience/forms">Formulários</Link>
        </div>
      </header>
      <dl className={styles.overview}>
        <div><dt>Total de contatos</dt><dd>{overview.total}</dd></div>
        <div><dt>Novos contatos</dt><dd>{overview.newContacts}</dd></div>
        <div><dt>Convertidos</dt><dd>{overview.converted}</dd></div>
        <div><dt>Taxa de conversão</dt><dd>{overview.conversionRate}%</dd></div>
        <div><dt>Principais origens</dt><dd>{overview.topSources.map((item) => `${item.source} (${item.count})`).join(" · ") || "Sem dados"}</dd></div>
      </dl>
      {managementLimit && <aside className={styles.limitNotice} role="status"><p>Você atingiu o limite de {managementLimit.limit} contatos disponíveis para gestão no plano Free. Novos contatos continuam sendo coletados.</p><Link className="button button-secondary" href="/upgrade">Conhecer Premium</Link></aside>}
      <form className={styles.filters} onSubmit={(event) => void applyFilters(event)}>
        <label>Buscar<input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nome, e-mail, telefone ou empresa" /></label>
        <label>Origem<select value={filters.source ?? ""} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value || undefined }))}><option value="">Todas</option>{options.sources.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}</select></label>
        <label>Campanha<select value={filters.campaignId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value || undefined }))}><option value="">Todas</option>{options.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label>Distribuição<select value={filters.campaignAssetId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, campaignAssetId: event.target.value || undefined }))}><option value="">Todas</option>{options.distributions.map((distribution) => <option key={distribution.id} value={distribution.id}>{distribution.name} · {distribution.campaign.name}</option>)}</select></label>
        <label>Formulário<select value={filters.formId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, formId: event.target.value || undefined }))}><option value="">Todos</option>{options.forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}</select></label>
        <label>Status<select value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: (event.target.value || undefined) as typeof current.status }))}><option value="">Todos</option>{Object.entries(audienceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Conversão<select value={filters.conversion} onChange={(event) => setFilters((current) => ({ ...current, conversion: event.target.value as typeof current.conversion }))}><option value="all">Todas</option><option value="with">Com conversão</option></select></label>
        <label>Engajamento<select value={filters.engagement ?? ""} onChange={(event) => setFilters((current) => ({ ...current, engagement: (event.target.value || undefined) as typeof current.engagement }))}><option value="">Todos</option>{Object.entries(engagementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Tag<select value={filters.tagId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, tagId: event.target.value || undefined }))}><option value="">Todas</option>{options.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
        <label>Período<select value={filters.period} onChange={(event) => setFilters((current) => ({ ...current, period: event.target.value as typeof current.period, ...(event.target.value === "custom" ? {} : { from: undefined, to: undefined }) }))}><option value="all">Todo período</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="custom">Personalizado</option></select></label>
        {filters.period === "custom" && <><label>De<input required type="date" value={filters.from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined }))} /></label><label>Até<input required type="date" value={filters.to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined }))} /></label></>}
        <label>Ordenar<select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as typeof current.sort }))}><option value="recent">Mais recentes</option><option value="last_seen">Última interação</option><option value="oldest">Mais antigos</option><option value="name">Nome</option></select></label>
        <button className="button button-secondary" type="submit" disabled={busy}>Aplicar</button>
      </form>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className={styles.workspace}>
        <section className={styles.list} aria-label="Contatos" aria-busy={busy}>
          <div className={styles.listTitle}>
            <h2>Contatos</h2>
            <span>{total}</span>
          </div>
          {contacts.length ? (
            contacts.map((contact) => {
              return (
                <button
                  className={styles.contactRow}
                  type="button"
                  key={contact.id}
                  aria-current={
                    selected?.id === contact.id ? "page" : undefined
                  }
                  onClick={() => void openContact(contact)}
                >
                  <span className={styles.avatar}>
                    {nameOf(contact)
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span>
                    <strong>{nameOf(contact)}</strong>
                    <small>{contact.email || contact.phone || contact.company || "Sem contato secundário"}</small>
                    <em>Origem: {sourceLabel(contact.firstSource)} · {contact.formSubmissions[0]?.campaign?.name || contact.firstCampaign || "Sem campanha"}</em>
                    <small>Entrada: {entryOf(contact)} · {contact.conversionCount ? "Convertido" : "Sem conversão"} · {formatDate(contact.lastSeenAt)}</small>
                  </span>
                  <i data-temperature={contact.engagementLevel}>
                    {engagementLabels[contact.engagementLevel]}
                  </i>
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>{total ? <><p>Nenhum contato encontrado.</p><button type="button" className="button button-secondary" onClick={clearFilters}>Limpar filtros</button></> : <><p>Seus contatos aparecerão aqui.</p><p>Adicione um formulário à sua Smart Page para transformar acessos em contatos.</p><Link className="button button-secondary" href="/untrack/smart-pages">Criar Smart Page</Link></>}</div>
          )}
          {(page > 1 || hasMore) && <nav className={styles.pagination} aria-label="Paginação dos contatos"><button type="button" className="button button-secondary" disabled={busy || page === 1} onClick={() => void loadContacts(filters, page - 1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button-secondary" disabled={busy || !hasMore} onClick={() => void loadContacts(filters, page + 1)}>Próxima</button></nav>}
        </section>
        {selected ? (
          <section className={styles.detail}>
            <header className={styles.detailHeader}>
              <div>
                <span className="eyebrow">Contato</span>
                <h2>{nameOf(selected)}</h2>
                <p>
                  {[selected.jobTitle, selected.company, selected.city]
                    .filter(Boolean)
                    .join(" · ") || "Dados compartilhados pelo contato"}
                </p>
              </div>
              <div className={styles.followUp}>
                {selected.whatsapp && (
                  <a
                    className="button button-secondary"
                    href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiMessageCircle aria-hidden="true" /> WhatsApp
                  </a>
                )}
                {selected.email && (
                  <a
                    className="button button-secondary"
                    href={`mailto:${selected.email}`}
                  >
                    <FiMail aria-hidden="true" /> E-mail
                  </a>
                )}
              </div>
            </header>
            <div className={styles.classification}>
              <strong>{audienceStatusLabels[selected.audienceStatus]}</strong>
              <span>Engajamento: {engagementLabels[selected.engagementLevel]}</span>
              <span>Primeira interação: {formatDate(selected.firstSeenAt)}</span>
              <span>Última interação: {formatDate(selected.lastSeenAt)}</span>
            </div>
            <section className={styles.context}>
              <h3>Identidade</h3>
              <dl>{[["E-mail", selected.email], ["Telefone", selected.phone || selected.whatsapp], ["Empresa", selected.company], ["Cargo", selected.jobTitle]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            </section>
            <section className={styles.context}>
              <h3>Atribuição</h3>
              <dl><div><dt>Origem inicial</dt><dd>{sourceLabel(selected.firstSource)}</dd></div><div><dt>Última origem</dt><dd>{sourceLabel(selected.lastSource)}</dd></div><div><dt>Campanha inicial</dt><dd>{selected.attribution?.firstCampaign || selected.firstCampaign || "Não informada"}</dd></div><div><dt>Campanha recente</dt><dd>{selected.attribution?.lastCampaign || selected.lastCampaign || "Não informada"}</dd></div><div><dt>Distribuição inicial</dt><dd>{selected.attribution?.firstDistribution?.name || "Não informada"}</dd></div><div><dt>Distribuição recente</dt><dd>{selected.attribution?.lastDistribution?.name || "Não informada"}</dd></div><div><dt>Ativo de entrada</dt><dd>{selected.attribution?.landingAsset || "Não informado"}</dd></div><div><dt>Identificado via</dt><dd>{{ form: "Formulário", smart_card_exchange: "Smart Card" }[selected.attribution?.identifiedVia || selected.creationSource] || "Não informado"}</dd></div></dl>
            </section>
            {(latestExchange || latestSubmission) && (
              <section className={styles.context}>
                <h3>Contexto da captura</h3>
                <dl>
                  {hasLatestSubmission && latestSubmission ? (
                    <>
                      <div>
                        <dt>Formulário</dt>
                        <dd>{latestSubmission.form.name}</dd>
                      </div>
                      <div>
                        <dt>Smart Page</dt>
                        <dd>{latestSubmission.smartPage.title}</dd>
                      </div>
                    </>
                  ) : (
                    latestExchange && (
                      <div>
                        <dt>Cartão</dt>
                        <dd>
                          {latestExchange.smartCard.firstName}{" "}
                          {latestExchange.smartCard.lastName}
                        </dd>
                      </div>
                    )
                  )}
                  <div>
                    <dt>Origem</dt>
                    <dd>
                      {hasLatestSubmission && latestSubmission
                        ? latestSubmission.source
                        : latestExchange?.sourceLabel || latestExchange?.source}
                    </dd>
                  </div>
                  <div>
                    <dt>{hasLatestSubmission ? "Canal" : "Interesse"}</dt>
                    <dd>
                      {hasLatestSubmission
                        ? latestSubmission?.channel || "Não informado"
                        : latestExchange?.intent || "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Campanha</dt>
                    <dd>
                      {(hasLatestSubmission
                        ? latestSubmission?.campaign
                        : latestExchange?.campaign
                      )?.name || "Sem campanha"}
                    </dd>
                  </div>
                  <div>
                    <dt>{hasLatestSubmission ? "Enviado" : "Capturado"}</dt>
                    <dd>
                      {formatDate(
                        hasLatestSubmission && latestSubmission
                          ? latestSubmission.submittedAt
                          : latestExchange!.capturedAt,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            )}
            <section className={styles.context}>
              <h3>Jornada</h3>
              <ol className={styles.journey}>
                <li>{sourceLabel(selected.firstSource)}</li>
                {(selected.attribution?.firstCampaign || selected.firstCampaign) && <li>{selected.attribution?.firstCampaign || selected.firstCampaign}</li>}
                {selected.attribution?.firstDistribution && <li>{selected.attribution.firstDistribution.name}</li>}
                {selected.formSubmissions[0]?.smartPage && <li>{selected.formSubmissions[0].smartPage.title}</li>}
                {selected.formSubmissions[0]?.form && <li>{selected.formSubmissions[0].form.name}</li>}
                <li>Lead capturado</li>
              </ol>
            </section>
            <section className={styles.context}>
              <h3>Conversões</h3>
              {selected.conversions?.length ? <dl>{selected.conversions.map((conversion) => <div key={conversion.id}><dt>{conversion.goal.name}</dt><dd>{[conversion.campaign?.name, conversion.smartPage?.title, formatDate(conversion.occurredAt)].filter(Boolean).join(" · ")}</dd></div>)}</dl> : <p>Sem objetivos concluídos.</p>}
            </section>
            {selected.formSubmissions.find((submission) => submission.consentGiven) && (
              <section className={styles.context}>
                <h3>Consentimento</h3>
                {selected.formSubmissions.filter((submission) => submission.consentGiven).slice(-1).map((submission) => <dl key={submission.id}><div><dt>Aceito</dt><dd>{formatDate(submission.consentedAt || submission.submittedAt)}</dd></div><div><dt>Formulário</dt><dd>{submission.form.name}</dd></div>{submission.consentText && <div><dt>Texto</dt><dd>{submission.consentText}</dd></div>}</dl>)}
              </section>
            )}
            <section className={styles.context}>
              <h3>Formulários</h3>
              {selected.formSubmissions.length ? <div className={styles.submissions}>{selected.formSubmissions.map((submission) => <details key={submission.id} className={styles.submission}><summary><span><strong>{submission.form.name}</strong><small>{submission.smartPage.title} · {formatDate(submission.submittedAt)}</small></span><span>{submission.consentGiven ? "Consentimento registrado" : "Sem consentimento"}</span></summary>{submittedValues(submission).length > 0 && <dl>{submittedValues(submission).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}</details>)}</div> : <p>Sem submissões de formulário.</p>}
            </section>
            <section className={styles.context}>
              <h3>Tags</h3>
              <div className={styles.tags}>
                {selected.tags?.map(({ tag }) => <span key={tag.id} style={{ borderColor: tag.color }}>{tag.name}{canEdit && <button type="button" title={`Remover ${tag.name}`} aria-label={`Remover ${tag.name}`} disabled={busy} onClick={() => void removeTag(tag.id)}><FiX aria-hidden="true" /></button>}</span>)}
                {canEdit && <select aria-label="Adicionar tag" defaultValue="" disabled={busy} onChange={(event) => { void addTag(event.target.value); event.currentTarget.value = ""; }}><option value="">+ Adicionar tag</option>{options.tags.filter((tag) => !selected.tags?.some((item) => item.tag.id === tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>}
              </div>
            </section>
            <section className={styles.timeline}>
              <h3>Timeline</h3>
              <ol>
                {selected.timeline?.length ? (
                  selected.timeline.map((event) => (
                    <li key={event.id}>
                      <time>{formatDate(event.occurredAt)}</time>
                      <div>
                        <strong>{eventLabel(event)}</strong>
                        {event.content && <p>{event.content}</p>}
                        {event.context.smartPage && <p>Smart Page: {event.context.smartPage}</p>}
                        {event.context.smartCard && <p>Smart Card: {event.context.smartCard}</p>}
                        {event.context.form && <p>Formulário: {event.context.form}</p>}
                        {event.context.campaign && <p>Campanha: {event.context.campaign}</p>}
                        {event.context.distribution && <p>Distribuição: {event.context.distribution}</p>}
                        {event.context.source && <p>Origem: {sourceLabel(event.context.source)}</p>}
                      </div>
                    </li>
                  ))
                ) : (
                  <li>
                    <div>
                      <strong>Sem interações posteriores ainda.</strong>
                    </div>
                  </li>
                )}
              </ol>
            </section>
            {canEdit && (
              <form
                className={styles.noteForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (note.trim()) void addNote();
                }}
              >
                <label>
                  Adicionar nota
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    placeholder="Registre um próximo passo ou contexto útil."
                  />
                </label>
                <button
                  className="button button-secondary"
                  type="submit"
                  disabled={busy || !note.trim()}
                >
                  <FiPlus aria-hidden="true" /> Adicionar nota
                </button>
              </form>
            )}
          </section>
        ) : (
          <section className={styles.placeholder}>
            <h2>Selecione um contato</h2>
            <p>Abra um contato para ver de onde veio e o que fez depois.</p>
          </section>
        )}
      </div>
    </section>
  );
}
