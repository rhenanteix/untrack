"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState, type DragEvent, type FormEvent } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiCopy,
  FiDownload,
  FiEye,
  FiGrid,
  FiPlus,
  FiShare2,
  FiTrash2,
} from "react-icons/fi";
import { apiRequest } from "./shared";
import styles from "./smart-cards-dashboard.module.css";

type ActionType =
  | "website"
  | "whatsapp"
  | "email"
  | "phone"
  | "calendar"
  | "smartPage"
  | "custom";

type CardAction = {
  id?: string;
  type: ActionType;
  label: string;
  url: string;
  visible: boolean;
  analyticsEnabled: boolean;
  position?: number;
};

type ContactField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "select";
  required: boolean;
  options: string[];
};

type ContactForm = {
  fields: ContactField[];
  intent: { enabled: boolean; label: string; options: string[] };
  primaryCta: "save_contact" | "share_contact" | "first_action";
};

type SmartCard = {
  id: string;
  ownerId: string;
  campaignId: string | null;
  slug: string;
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  bio: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  websiteUrl: string | null;
  location: string | null;
  theme: {
    preset:
      "minimal" | "professional" | "creator" | "dark" | "bold" | "corporate";
    background?: string;
    backgroundSecondary?: string;
    textColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    buttonRadius?: number;
    avatarShape?: "circle" | "rounded" | "square";
    font?: "sans" | "serif" | "mono";
  };
  contactForm: ContactForm;
  privacyPolicyUrl: string | null;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  actions: CardAction[];
  qrAsset: { id: string; encodedUrl: string } | null;
  _count: { contactExchanges: number };
};

type Metrics = {
  periodDays: number;
  views: number;
  uniqueVisitors: number;
  interactions: number;
  contacts: number;
  conversions: number;
  funnel: { key: string; label: string; value: number }[];
  topActions: { actionId: string; label: string; clicks: number }[];
  trafficSources: { name: string; views: number }[];
};

type Tab = "content" | "appearance" | "capture" | "sharing" | "analytics";
type Filter = "all" | "mine" | "team" | "active" | "archived";

const blankContactForm: ContactForm = {
  fields: [
    {
      key: "firstName",
      label: "Nome",
      type: "text",
      required: true,
      options: [],
    },
    {
      key: "email",
      label: "E-mail",
      type: "email",
      required: true,
      options: [],
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      type: "tel",
      required: false,
      options: [],
    },
  ],
  intent: {
    enabled: true,
    label: "Como posso ajudar?",
    options: [
      "Conhecer produto",
      "Solicitar orçamento",
      "Parceria",
      "Networking",
    ],
  },
  primaryCta: "share_contact",
};

function cloneForm(form: ContactForm): ContactForm {
  return JSON.parse(JSON.stringify(form)) as ContactForm;
}

function displayName(card: SmartCard) {
  return `${card.firstName} ${card.lastName}`.trim();
}

function publicUrl(origin: string, slug: string) {
  return `${origin}/c/${encodeURIComponent(slug)}`;
}

function toPayload(card: SmartCard) {
  return {
    slug: card.slug,
    firstName: card.firstName,
    lastName: card.lastName,
    headline: card.headline,
    company: card.company,
    bio: card.bio,
    avatarUrl: card.avatarUrl,
    logoUrl: card.logoUrl,
    phone: card.phone,
    whatsapp: card.whatsapp,
    email: card.email,
    websiteUrl: card.websiteUrl,
    location: card.location,
    theme: card.theme,
    contactForm: card.contactForm,
    privacyPolicyUrl: card.privacyPolicyUrl,
    campaignId: card.campaignId,
    actions: card.actions.map(
      ({ type, label, url, visible, analyticsEnabled }) => ({
        type,
        label,
        url,
        visible,
        analyticsEnabled,
      }),
    ),
  };
}

function initials(card: SmartCard) {
  return (
    `${card.firstName[0] ?? ""}${card.lastName[0] ?? ""}`.toUpperCase() || "SC"
  );
}

export function SmartCardsDashboard({
  initial,
  campaigns,
  currentUserId,
  currentUserName,
  publicOrigin,
  overview,
  canEdit,
}: {
  initial: { items: SmartCard[]; page: number; hasMore: boolean };
  campaigns: { id: string; name: string }[];
  currentUserId: string;
  currentUserName: string;
  publicOrigin: string;
  overview: {
    active: number;
    views: number;
    contacts: number;
    saves: number;
    conversions: number;
  };
  canEdit: boolean;
}) {
  const [cards, setCards] = useState(initial.items);
  const [selected, setSelected] = useState<SmartCard | null>(
    initial.items[0] ?? null,
  );
  const [draft, setDraft] = useState<SmartCard | null>(
    initial.items[0] ?? null,
  );
  const [tab, setTab] = useState<Tab>("content");
  const [previewMode, setPreviewMode] = useState<"mobile" | "desktop" | "qr">(
    "mobile",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(initial.items.length === 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [draggedAction, setDraggedAction] = useState<number | null>(null);

  const filtered = cards.filter((card) => {
    const matchesSearch = `${displayName(card)} ${card.company} ${card.slug}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "mine") return card.ownerId === currentUserId;
    if (filter === "team") return card.ownerId !== currentUserId;
    if (filter === "active") return card.status === "published";
    if (filter === "archived") return card.status === "archived";
    return true;
  });

  function selectCard(card: SmartCard) {
    setSelected(card);
    setDraft({
      ...card,
      actions: card.actions.map((action) => ({ ...action })),
      contactForm: cloneForm(card.contactForm),
    });
    setMetrics(null);
    setQrDataUrl("");
    setShowCreate(false);
    setNotice("");
    setError("");
  }

  function updateDraft(change: Partial<SmartCard>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
  }

  async function saveCard() {
    if (!draft || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<SmartCard>(
        `/api/smart-cards/${draft.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(toPayload(draft)),
        },
      );
      setCards((current) =>
        current.map((card) => (card.id === saved.id ? saved : card)),
      );
      setSelected(saved);
      setDraft(saved);
      setNotice("Alterações salvas.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar o cartão.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function publishCard() {
    if (!draft || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<SmartCard>(
        `/api/smart-cards/${draft.id}/publish`,
        {
          method: "POST",
          body: JSON.stringify({ published: draft.status !== "published" }),
        },
      );
      setCards((current) =>
        current.map((card) => (card.id === saved.id ? saved : card)),
      );
      setSelected(saved);
      setDraft(saved);
      setNotice(
        saved.status === "published"
          ? "Cartão publicado."
          : "Cartão voltou para rascunho.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível publicar o cartão.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const words = String(values.get("name") ?? currentUserName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    setBusy(true);
    setError("");
    try {
      const card = await apiRequest<SmartCard>("/api/smart-cards", {
        method: "POST",
        body: JSON.stringify({
          slug: values.get("slug"),
          firstName: words[0] ?? "Seu",
          lastName: words.slice(1).join(" "),
          headline: values.get("headline") ?? "",
          company: values.get("company") ?? "",
          contactForm: blankContactForm,
          theme: { preset: "professional" },
          actions: [],
        }),
      });
      setCards((current) => [card, ...current]);
      selectCard(card);
      setNotice(
        "Cartão criado. Complete os detalhes e publique quando estiver pronto.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar o cartão.",
      );
    } finally {
      setBusy(false);
    }
  }

  function replaceActions(actions: CardAction[]) {
    updateDraft({ actions });
  }

  function moveAction(from: number, to: number) {
    if (!draft || to < 0 || to >= draft.actions.length || from === to) return;
    const actions = [...draft.actions];
    const [moved] = actions.splice(from, 1);
    actions.splice(to, 0, moved);
    replaceActions(actions);
  }

  function dropAction(event: DragEvent<HTMLLIElement>, target: number) {
    event.preventDefault();
    if (draggedAction !== null) moveAction(draggedAction, target);
    setDraggedAction(null);
  }

  async function loadMetrics() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      setMetrics(
        await apiRequest<Metrics>(
          `/api/smart-cards/${selected.id}/analytics?days=30`,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar as métricas.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function generateQr() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{
        qr: SmartCard["qrAsset"];
        dataUrl?: string;
      }>(`/api/smart-cards/${selected.id}/qr`, { method: "POST" });
      setQrDataUrl(result.dataUrl ?? "");
      const saved = { ...selected, qrAsset: result.qr };
      setCards((current) =>
        current.map((card) => (card.id === saved.id ? saved : card)),
      );
      setSelected(saved);
      setDraft((current) =>
        current && current.id === saved.id
          ? { ...current, qrAsset: result.qr }
          : current,
      );
      setNotice("QR dinâmico pronto para compartilhar.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível gerar o QR.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setError(
        "Não foi possível copiar. Selecione o endereço e copie manualmente.",
      );
    }
  }

  const activeCard = draft ?? selected;

  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Smart Cards</span>
          <h1>Transforme cada encontro em uma conexão mensurável.</h1>
          <p>
            Compartilhe sua identidade, capture interesse e acompanhe o que
            acontece depois.
          </p>
        </div>
        {canEdit && (
          <button
            className="button"
            type="button"
            onClick={() => {
              setShowCreate(true);
              setSelected(null);
              setDraft(null);
            }}
          >
            {" "}
            <FiPlus aria-hidden="true" /> Criar cartão
          </button>
        )}
      </header>

      <section className={styles.kpis} aria-label="Resumo dos cartões">
        <div>
          <span>Cartões ativos</span>
          <strong>{overview.active}</strong>
        </div>
        <div>
          <span>Visualizações</span>
          <strong>{overview.views}</strong>
        </div>
        <div>
          <span>Contatos recebidos</span>
          <strong>{overview.contacts}</strong>
        </div>
        <div>
          <span>Contatos salvos</span>
          <strong>{overview.saves}</strong>
        </div>
        <div>
          <span>Conversões</span>
          <strong>{overview.conversions}</strong>
        </div>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Filtros de cartões">
          {(["all", "mine", "team", "active", "archived"] as const).map(
            (value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {
                  {
                    all: "Todos",
                    mine: "Meus cartões",
                    team: "Equipe",
                    active: "Ativos",
                    archived: "Arquivados",
                  }[value]
                }
              </button>
            ),
          )}
        </div>
        <label className={styles.search}>
          <span>Buscar cartão</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cartão..."
          />
        </label>
      </div>

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

      {showCreate && canEdit && (
        <form className={styles.create} onSubmit={createCard}>
          <div>
            <h2>Novo Smart Card</h2>
            <p>
              Comece pela identidade. O restante pode ser refinado no editor.
            </p>
          </div>
          <label>
            Nome
            <input
              name="name"
              defaultValue={currentUserName}
              required
              maxLength={160}
            />
          </label>
          <label>
            Endereço
            <input
              name="slug"
              required
              minLength={3}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="ana-silva"
            />
          </label>
          <label>
            Cargo
            <input
              name="headline"
              maxLength={160}
              placeholder="Consultora de produto"
            />
          </label>
          <label>
            Empresa
            <input name="company" maxLength={120} placeholder="Sua empresa" />
          </label>
          <button className="button" disabled={busy} type="submit">
            {busy ? "Criando..." : "Criar e editar"}
          </button>
        </form>
      )}

      <div className={styles.workspace}>
        <aside className={styles.library} aria-label="Seus cartões">
          <div className={styles.libraryTitle}>
            <h2>Cartões</h2>
            <span>{filtered.length}</span>
          </div>
          {filtered.length ? (
            filtered.map((card) => (
              <button
                key={card.id}
                type="button"
                className={styles.cardRow}
                aria-current={selected?.id === card.id ? "page" : undefined}
                onClick={() => selectCard(card)}
              >
                {card.avatarUrl ? (
                  <img src={card.avatarUrl} alt="" />
                ) : (
                  <span>{initials(card)}</span>
                )}
                <b>{displayName(card)}</b>
                <small>
                  {card.company || card.headline || "Sem descrição"}
                </small>
                <em>
                  {card.status === "published"
                    ? "Ativo"
                    : card.status === "archived"
                      ? "Arquivado"
                      : "Rascunho"}
                </em>
              </button>
            ))
          ) : (
            <p className={styles.empty}>Nenhum cartão com este filtro.</p>
          )}
        </aside>

        {activeCard ? (
          <div className={styles.studio}>
            <div className={styles.studioHeader}>
              <div>
                <span className="eyebrow">Editor</span>
                <h2>{displayName(activeCard)}</h2>
              </div>
              <div className={styles.editorActions}>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() =>
                    copy(
                      publicUrl(publicOrigin, activeCard.slug),
                      "Link público copiado.",
                    )
                  }
                  title="Copiar link público"
                >
                  <FiCopy aria-hidden="true" /> <span>Copiar</span>
                </button>
                <a
                  className="button button-secondary"
                  href={publicUrl(publicOrigin, activeCard.slug)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FiEye aria-hidden="true" /> <span>Ver</span>
                </a>
                {canEdit && (
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={saveCard}
                  >
                    {busy ? "Salvando..." : "Salvar"}
                  </button>
                )}
              </div>
            </div>

            <div className={styles.editorGrid}>
              <div className={styles.editor}>
                <div
                  className={styles.tabs}
                  role="tablist"
                  aria-label="Configurações do cartão"
                >
                  {(
                    [
                      "content",
                      "appearance",
                      "capture",
                      "sharing",
                      "analytics",
                    ] as const
                  ).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      onClick={() => {
                        setTab(value);
                        if (value === "analytics") void loadMetrics();
                      }}
                    >
                      {
                        {
                          content: "Conteúdo",
                          appearance: "Aparência",
                          capture: "Captura",
                          sharing: "Compartilhamento",
                          analytics: "Analytics",
                        }[value]
                      }
                    </button>
                  ))}
                </div>

                {tab === "content" && (
                  <div className={styles.panel}>
                    <h3>Perfil e ações</h3>
                    <div className={styles.fieldGrid}>
                      <label>
                        Nome
                        <input
                          disabled={!canEdit}
                          value={activeCard.firstName}
                          onChange={(event) =>
                            updateDraft({ firstName: event.target.value })
                          }
                          maxLength={80}
                        />
                      </label>
                      <label>
                        Sobrenome
                        <input
                          disabled={!canEdit}
                          value={activeCard.lastName}
                          onChange={(event) =>
                            updateDraft({ lastName: event.target.value })
                          }
                          maxLength={80}
                        />
                      </label>
                      <label className={styles.full}>
                        Cargo
                        <input
                          disabled={!canEdit}
                          value={activeCard.headline}
                          onChange={(event) =>
                            updateDraft({ headline: event.target.value })
                          }
                          maxLength={160}
                        />
                      </label>
                      <label>
                        Empresa
                        <input
                          disabled={!canEdit}
                          value={activeCard.company}
                          onChange={(event) =>
                            updateDraft({ company: event.target.value })
                          }
                          maxLength={120}
                        />
                      </label>
                      <label>
                        Localização
                        <input
                          disabled={!canEdit}
                          value={activeCard.location ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              location: event.target.value || null,
                            })
                          }
                          maxLength={160}
                        />
                      </label>
                      <label>
                        Campanha
                        <select
                          disabled={!canEdit}
                          value={activeCard.campaignId ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              campaignId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">Sem campanha</option>
                          {campaigns.map((campaign) => (
                            <option key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.full}>
                        Descrição
                        <textarea
                          disabled={!canEdit}
                          value={activeCard.bio}
                          onChange={(event) =>
                            updateDraft({ bio: event.target.value })
                          }
                          maxLength={500}
                        />
                      </label>
                      <label>
                        Foto (URL)
                        <input
                          disabled={!canEdit}
                          type="url"
                          value={activeCard.avatarUrl ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              avatarUrl: event.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        Logo (URL)
                        <input
                          disabled={!canEdit}
                          type="url"
                          value={activeCard.logoUrl ?? ""}
                          onChange={(event) =>
                            updateDraft({ logoUrl: event.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        Telefone
                        <input
                          disabled={!canEdit}
                          type="tel"
                          value={activeCard.phone ?? ""}
                          onChange={(event) =>
                            updateDraft({ phone: event.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        WhatsApp
                        <input
                          disabled={!canEdit}
                          type="tel"
                          value={activeCard.whatsapp ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              whatsapp: event.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label>
                        E-mail
                        <input
                          disabled={!canEdit}
                          type="email"
                          value={activeCard.email ?? ""}
                          onChange={(event) =>
                            updateDraft({ email: event.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        Site
                        <input
                          disabled={!canEdit}
                          type="url"
                          value={activeCard.websiteUrl ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              websiteUrl: event.target.value || null,
                            })
                          }
                        />
                      </label>
                    </div>
                    <div className={styles.actionHeading}>
                      <div>
                        <h3>Ações</h3>
                        <p>Arraste para ordenar como aparecem no cartão.</p>
                      </div>
                      {canEdit && (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() =>
                            replaceActions([
                              ...activeCard.actions,
                              {
                                type: "website",
                                label: "Novo link",
                                url: "https://",
                                visible: true,
                                analyticsEnabled: true,
                              },
                            ])
                          }
                        >
                          <FiPlus aria-hidden="true" /> Adicionar
                        </button>
                      )}
                    </div>
                    <ul className={styles.actionList}>
                      {activeCard.actions.map((action, index) => (
                        <li
                          key={`${action.id ?? "new"}-${index}`}
                          draggable={canEdit}
                          onDragStart={() => setDraggedAction(index)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => dropAction(event, index)}
                        >
                          <span
                            className={styles.dragHandle}
                            aria-hidden="true"
                          >
                            ⠿
                          </span>
                          <label>
                            Rótulo
                            <input
                              disabled={!canEdit}
                              value={action.label}
                              maxLength={80}
                              onChange={(event) =>
                                replaceActions(
                                  activeCard.actions.map((item, position) =>
                                    position === index
                                      ? { ...item, label: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Destino
                            <input
                              disabled={!canEdit}
                              value={action.url}
                              maxLength={4096}
                              onChange={(event) =>
                                replaceActions(
                                  activeCard.actions.map((item, position) =>
                                    position === index
                                      ? { ...item, url: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Tipo
                            <select
                              disabled={!canEdit}
                              value={action.type}
                              onChange={(event) =>
                                replaceActions(
                                  activeCard.actions.map((item, position) =>
                                    position === index
                                      ? {
                                          ...item,
                                          type: event.target
                                            .value as ActionType,
                                        }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {[
                                "website",
                                "whatsapp",
                                "email",
                                "phone",
                                "calendar",
                                "smartPage",
                                "custom",
                              ].map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </label>
                          {canEdit && (
                            <div className={styles.actionTools}>
                              <button
                                type="button"
                                title="Mover ação para cima"
                                aria-label="Mover ação para cima"
                                onClick={() => moveAction(index, index - 1)}
                              >
                                <FiArrowUp />
                              </button>
                              <button
                                type="button"
                                title="Mover ação para baixo"
                                aria-label="Mover ação para baixo"
                                onClick={() => moveAction(index, index + 1)}
                              >
                                <FiArrowDown />
                              </button>
                              <button
                                type="button"
                                title="Remover ação"
                                aria-label="Remover ação"
                                onClick={() =>
                                  replaceActions(
                                    activeCard.actions.filter(
                                      (_, position) => position !== index,
                                    ),
                                  )
                                }
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tab === "appearance" && (
                  <div className={styles.panel}>
                    <h3>Aparência</h3>
                    <p>
                      Escolha uma direção visual e refine apenas o que precisa.
                    </p>
                    <div className={styles.presetGrid}>
                      {(
                        [
                          "minimal",
                          "professional",
                          "creator",
                          "dark",
                          "bold",
                          "corporate",
                        ] as const
                      ).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={!canEdit}
                          data-preset={preset}
                          aria-pressed={activeCard.theme.preset === preset}
                          onClick={() =>
                            updateDraft({
                              theme: { ...activeCard.theme, preset },
                            })
                          }
                        >
                          <span />
                          <strong>
                            {
                              {
                                minimal: "Minimal",
                                professional: "Professional",
                                creator: "Creator",
                                dark: "Dark",
                                bold: "Bold",
                                corporate: "Corporate",
                              }[preset]
                            }
                          </strong>
                        </button>
                      ))}
                    </div>
                    <div className={styles.fieldGrid}>
                      <label>
                        Fundo
                        <input
                          disabled={!canEdit}
                          type="color"
                          value={activeCard.theme.background ?? "#f7f8f1"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                background: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Botões
                        <input
                          disabled={!canEdit}
                          type="color"
                          value={activeCard.theme.buttonColor ?? "#1f5a45"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                buttonColor: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Tipografia
                        <select
                          disabled={!canEdit}
                          value={activeCard.theme.font ?? "sans"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                font: event.target.value as
                                  "sans" | "serif" | "mono",
                              },
                            })
                          }
                        >
                          <option value="sans">Sans</option>
                          <option value="serif">Serif</option>
                          <option value="mono">Mono</option>
                        </select>
                      </label>
                      <label>
                        Avatar
                        <select
                          disabled={!canEdit}
                          value={activeCard.theme.avatarShape ?? "circle"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                avatarShape: event.target.value as
                                  "circle" | "rounded" | "square",
                              },
                            })
                          }
                        >
                          <option value="circle">Circular</option>
                          <option value="rounded">Arredondado</option>
                          <option value="square">Quadrado</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {tab === "capture" && (
                  <div className={styles.panel}>
                    <h3>Troca de contatos</h3>
                    <p>
                      Peça somente o necessário. O contexto do cartão é
                      registrado automaticamente.
                    </p>
                    <label className={styles.primaryCta}>
                      CTA principal
                      <select
                        disabled={!canEdit}
                        value={activeCard.contactForm.primaryCta}
                        onChange={(event) =>
                          updateDraft({
                            contactForm: {
                              ...activeCard.contactForm,
                              primaryCta: event.target
                                .value as ContactForm["primaryCta"],
                            },
                          })
                        }
                      >
                        <option value="share_contact">
                          Compartilhar seus dados
                        </option>
                        <option value="save_contact">Salvar meu contato</option>
                        <option value="first_action">Primeira ação</option>
                      </select>
                    </label>
                    <div className={styles.captureFields}>
                      {activeCard.contactForm.fields.map((field, index) => (
                        <div key={field.key} className={styles.captureField}>
                          <label>
                            Campo
                            <input
                              disabled={!canEdit}
                              value={field.label}
                              onChange={(event) => {
                                const fields =
                                  activeCard.contactForm.fields.map(
                                    (item, position) =>
                                      position === index
                                        ? { ...item, label: event.target.value }
                                        : item,
                                  );
                                updateDraft({
                                  contactForm: {
                                    ...activeCard.contactForm,
                                    fields,
                                  },
                                });
                              }}
                            />
                          </label>
                          <label>
                            Tipo
                            <select
                              disabled={!canEdit}
                              value={field.type}
                              onChange={(event) => {
                                const fields =
                                  activeCard.contactForm.fields.map(
                                    (item, position) =>
                                      position === index
                                        ? {
                                            ...item,
                                            type: event.target
                                              .value as ContactField["type"],
                                          }
                                        : item,
                                  );
                                updateDraft({
                                  contactForm: {
                                    ...activeCard.contactForm,
                                    fields,
                                  },
                                });
                              }}
                            >
                              <option value="text">Texto</option>
                              <option value="email">E-mail</option>
                              <option value="tel">Telefone</option>
                              <option value="select">Seleção</option>
                            </select>
                          </label>
                          <label className={styles.toggle}>
                            <input
                              disabled={!canEdit}
                              type="checkbox"
                              checked={field.required}
                              onChange={(event) => {
                                const fields =
                                  activeCard.contactForm.fields.map(
                                    (item, position) =>
                                      position === index
                                        ? {
                                            ...item,
                                            required: event.target.checked,
                                          }
                                        : item,
                                  );
                                updateDraft({
                                  contactForm: {
                                    ...activeCard.contactForm,
                                    fields,
                                  },
                                });
                              }}
                            />{" "}
                            Obrigatório
                          </label>
                          {canEdit && index > 0 && (
                            <button
                              type="button"
                              title="Remover campo"
                              aria-label="Remover campo"
                              onClick={() =>
                                updateDraft({
                                  contactForm: {
                                    ...activeCard.contactForm,
                                    fields:
                                      activeCard.contactForm.fields.filter(
                                        (_, position) => position !== index,
                                      ),
                                  },
                                })
                              }
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {canEdit && activeCard.contactForm.fields.length < 10 && (
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() =>
                          updateDraft({
                            contactForm: {
                              ...activeCard.contactForm,
                              fields: [
                                ...activeCard.contactForm.fields,
                                {
                                  key: `custom${activeCard.contactForm.fields.length + 1}`,
                                  label: "Novo campo",
                                  type: "text",
                                  required: false,
                                  options: [],
                                },
                              ],
                            },
                          })
                        }
                      >
                        <FiPlus aria-hidden="true" /> Adicionar campo
                      </button>
                    )}
                    <details className={styles.advanced}>
                      <summary>Interesse e privacidade</summary>
                      <label className={styles.toggle}>
                        <input
                          disabled={!canEdit}
                          type="checkbox"
                          checked={activeCard.contactForm.intent.enabled}
                          onChange={(event) =>
                            updateDraft({
                              contactForm: {
                                ...activeCard.contactForm,
                                intent: {
                                  ...activeCard.contactForm.intent,
                                  enabled: event.target.checked,
                                },
                              },
                            })
                          }
                        />{" "}
                        Perguntar interesse
                      </label>
                      <label>
                        Pergunta
                        <input
                          disabled={!canEdit}
                          value={activeCard.contactForm.intent.label}
                          onChange={(event) =>
                            updateDraft({
                              contactForm: {
                                ...activeCard.contactForm,
                                intent: {
                                  ...activeCard.contactForm.intent,
                                  label: event.target.value,
                                },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Opções, uma por linha
                        <textarea
                          disabled={!canEdit}
                          value={activeCard.contactForm.intent.options.join(
                            "\n",
                          )}
                          onChange={(event) =>
                            updateDraft({
                              contactForm: {
                                ...activeCard.contactForm,
                                intent: {
                                  ...activeCard.contactForm.intent,
                                  options: event.target.value
                                    .split("\n")
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Política de privacidade
                        <input
                          disabled={!canEdit}
                          type="url"
                          value={activeCard.privacyPolicyUrl ?? ""}
                          onChange={(event) =>
                            updateDraft({
                              privacyPolicyUrl: event.target.value || null,
                            })
                          }
                        />
                      </label>
                    </details>
                  </div>
                )}

                {tab === "sharing" && (
                  <div className={styles.panel}>
                    <h3>Compartilhamento</h3>
                    <p>
                      Seu QR aponta para uma URL gerenciada: atualize o cartão
                      sem reimprimir o código.
                    </p>
                    <div className={styles.shareUrl}>
                      <input
                        readOnly
                        value={publicUrl(publicOrigin, activeCard.slug)}
                      />
                      <button
                        type="button"
                        title="Copiar link"
                        aria-label="Copiar link"
                        onClick={() =>
                          copy(
                            publicUrl(publicOrigin, activeCard.slug),
                            "Link público copiado.",
                          )
                        }
                      >
                        <FiCopy />
                      </button>
                    </div>
                    <div className={styles.qrArea}>
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`QR Code de ${displayName(activeCard)}`}
                        />
                      ) : (
                        <div className={styles.qrPlaceholder}>
                          <FiGrid aria-hidden="true" />
                          <span>Gere o QR rastreável</span>
                        </div>
                      )}
                      <div>
                        <button
                          className="button"
                          type="button"
                          disabled={busy || !canEdit}
                          onClick={generateQr}
                        >
                          <FiGrid aria-hidden="true" />{" "}
                          {activeCard.qrAsset
                            ? "Atualizar visualização"
                            : "Gerar QR"}
                        </button>
                        {activeCard.qrAsset && (
                          <div className={styles.downloads}>
                            <a
                              href={`/api/smart-cards/${activeCard.id}/qr?format=png`}
                            >
                              <FiDownload aria-hidden="true" /> PNG
                            </a>
                            <a
                              href={`/api/smart-cards/${activeCard.id}/qr?format=svg`}
                            >
                              <FiDownload aria-hidden="true" /> SVG
                            </a>
                            <a
                              href={`/api/smart-cards/${activeCard.id}/qr?format=pdf`}
                            >
                              <FiDownload aria-hidden="true" /> Imprimir
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <a
                      className="button button-secondary"
                      href={`https://wa.me/?text=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiShare2 aria-hidden="true" /> Compartilhar por WhatsApp
                    </a>
                    <a
                      className="button button-secondary"
                      href={`mailto:?subject=${encodeURIComponent(displayName(activeCard))}&body=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                    >
                      Compartilhar por e-mail
                    </a>
                  </div>
                )}

                {tab === "analytics" && (
                  <div className={styles.panel}>
                    <div className={styles.analyticsHeader}>
                      <div>
                        <h3>Relacionamento nos últimos 30 dias</h3>
                        <p>
                          Mostramos apenas etapas que este cartão pode
                          registrar.
                        </p>
                      </div>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busy}
                        onClick={loadMetrics}
                      >
                        Atualizar
                      </button>
                    </div>
                    {!metrics ? (
                      <p className={styles.empty}>
                        Carregando as métricas quando você abre esta aba.
                      </p>
                    ) : (
                      <>
                        <div className={styles.cardMetrics}>
                          <div>
                            <span>Visitas</span>
                            <strong>{metrics.views}</strong>
                            <small>{metrics.uniqueVisitors} únicas</small>
                          </div>
                          <div>
                            <span>Interações</span>
                            <strong>{metrics.interactions}</strong>
                          </div>
                          <div>
                            <span>Contatos</span>
                            <strong>{metrics.contacts}</strong>
                          </div>
                          <div>
                            <span>Conversões</span>
                            <strong>{metrics.conversions}</strong>
                          </div>
                        </div>
                        <ol className={styles.funnel}>
                          {metrics.funnel.map((step, index) => (
                            <li key={step.key}>
                              <span>{index + 1}</span>
                              <div>
                                <strong>{step.value}</strong>
                                <small>{step.label}</small>
                              </div>
                            </li>
                          ))}
                        </ol>
                        <div className={styles.analyticsLists}>
                          <section>
                            <h4>Ações mais clicadas</h4>
                            {metrics.topActions.length ? (
                              <ul>
                                {metrics.topActions.map((action) => (
                                  <li key={action.actionId}>
                                    <span>{action.label}</span>
                                    <b>{action.clicks}</b>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>Ainda não há cliques registrados.</p>
                            )}
                          </section>
                          <section>
                            <h4>Origem dos acessos</h4>
                            {metrics.trafficSources.length ? (
                              <ul>
                                {metrics.trafficSources.map((source) => (
                                  <li key={source.name}>
                                    <span>{source.name}</span>
                                    <b>{source.views}</b>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>Ainda não há origens registradas.</p>
                            )}
                          </section>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className={styles.publishBar}>
                  <span>
                    {activeCard.status === "published"
                      ? "Publicado e pronto para compartilhar"
                      : "Rascunho: publique quando o cartão estiver pronto"}
                  </span>
                  {canEdit && (
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      onClick={publishCard}
                    >
                      {activeCard.status === "published"
                        ? "Despublicar"
                        : "Publicar cartão"}
                    </button>
                  )}
                </div>
              </div>

              <aside className={styles.previewPanel}>
                <div className={styles.previewHeader}>
                  <span>Preview ao vivo</span>
                  <div className={styles.previewModes}>
                    {(["mobile", "desktop", "qr"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={previewMode === mode}
                        onClick={() => setPreviewMode(mode)}
                      >
                        {
                          { mobile: "Mobile", desktop: "Desktop", qr: "QR" }[
                            mode
                          ]
                        }
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.phone} data-preview={previewMode}>
                  <div
                    className={styles.phoneScreen}
                    style={{
                      background: activeCard.theme.background ?? "#f7f8f1",
                      color: activeCard.theme.textColor ?? "#17322c",
                      fontFamily:
                        activeCard.theme.font === "serif"
                          ? "Georgia, serif"
                          : activeCard.theme.font === "mono"
                            ? "Courier New, monospace"
                            : undefined,
                    }}
                  >
                    <div className={styles.previewLogo}>
                      {activeCard.logoUrl ? (
                        <img src={activeCard.logoUrl} alt="" />
                      ) : (
                        "LinkOr"
                      )}
                    </div>
                    {activeCard.avatarUrl ? (
                      <img
                        className={styles.previewAvatar}
                        src={activeCard.avatarUrl}
                        alt=""
                      />
                    ) : (
                      <span className={styles.previewAvatarFallback}>
                        {initials(activeCard)}
                      </span>
                    )}
                    <strong>{displayName(activeCard)}</strong>
                    <small>
                      {[activeCard.headline, activeCard.company]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                    <p>{activeCard.bio}</p>
                    <button
                      style={{
                        background: activeCard.theme.buttonColor ?? "#1f5a45",
                        color: activeCard.theme.buttonTextColor ?? "#fff",
                        borderRadius: activeCard.theme.buttonRadius ?? 10,
                      }}
                    >
                      {activeCard.contactForm.primaryCta === "save_contact"
                        ? "Salvar meu contato"
                        : activeCard.contactForm.primaryCta ===
                              "first_action" && activeCard.actions[0]
                          ? activeCard.actions[0].label
                          : "Compartilhar seus dados"}
                    </button>
                    {activeCard.actions.slice(0, 3).map((action, index) => (
                      <span
                        className={styles.previewLink}
                        key={`${action.label}-${index}`}
                      >
                        {action.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className={styles.previewQr}
                  data-active={previewMode === "qr"}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code de ${displayName(activeCard)}`}
                    />
                  ) : (
                    <>
                      <FiGrid aria-hidden="true" />
                      <span>Gere o QR para visualizar aqui.</span>
                      {canEdit && (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={busy}
                          onClick={generateQr}
                        >
                          Gerar QR
                        </button>
                      )}
                    </>
                  )}
                </div>
              </aside>
            </div>
          </div>
        ) : !showCreate ? (
          <section className={styles.blank}>
            <h2>Selecione um cartão</h2>
            <p>Escolha um cartão à esquerda ou crie um para começar.</p>
          </section>
        ) : null}
      </div>

      <section className={styles.audienceHint}>
        <div>
          <span className="eyebrow">Audience</span>
          <h2>Contatos recebidos ficam no seu Audience.</h2>
          <p>
            Veja origem, interesse, cartão, campanha e a linha do tempo de cada
            relacionamento.
          </p>
        </div>
        <Link className="button button-secondary" href="/untrack/audience">
          Abrir contatos
        </Link>
      </section>
    </section>
  );
}
