"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiCopy,
  FiDownload,
  FiEye,
  FiGrid,
  FiMail,
  FiMoreHorizontal,
  FiPlus,
  FiShare2,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { WalletConfigurationState } from "@/modules/smart-cards/wallet-config";
import {
  getSocialProvider,
  normalizeSocialUrl,
  socialProviders,
  type SocialProviderId,
} from "@/modules/social-providers";
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
  publicDetails: {
    phone: boolean;
    whatsapp: boolean;
    email: boolean;
    website: boolean;
  };
  intent: { enabled: boolean; label: string; options: string[] };
  primaryCta: "save_contact" | "share_contact" | "first_action";
};

type ContactPoint = {
  type: "phone" | "email";
  value: string;
  label?: string;
};

type SocialLink = {
  providerId: SocialProviderId;
  url: string;
  label?: string;
};

type WalletStatus = {
  providers: {
    provider: "apple" | "google";
    state: WalletConfigurationState;
    message: string;
    pass: {
      status: "pending_sync" | "synced" | "sync_failed" | "revoked";
      lastSyncedAt: string | null;
      lastError: string | null;
    } | null;
  }[];
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
  contactPoints: ContactPoint[];
  socialLinks: SocialLink[];
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
  qrScans: number;
  appleWalletClicks: number;
  googleWalletClicks: number;
  walletAddsConfirmed: number | null;
  uniqueVisitors: number;
  interactions: number;
  contacts: number;
  conversions: number;
  funnel: { key: string; label: string; value: number }[];
  topActions: { actionId: string; label: string; clicks: number }[];
  trafficSources: { name: string; views: number }[];
};

type Tab =
  "identity" | "contact" | "socials" | "appearance" | "wallet" | "analytics";
type Filter = "all" | "mine" | "team" | "active" | "archived";
type SaveStatus = "saved" | "saving" | "error";

type ContactDetailsDraft = {
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  websiteUrl: string | null;
  publicDetails: ContactForm["publicDetails"];
  contactPoints: ContactPoint[];
};

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
  publicDetails: {
    phone: true,
    whatsapp: true,
    email: true,
    website: true,
  },
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
    contactPoints: card.contactPoints,
    socialLinks: card.socialLinks,
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

function payloadSignature(card: SmartCard) {
  return JSON.stringify(toPayload(card));
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
  const [tab, setTab] = useState<Tab>("identity");
  const [previewMode, setPreviewMode] = useState<"web" | "apple" | "google">(
    "web",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(initial.items.length === 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [draggedAction, setDraggedAction] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [contactDetails, setContactDetails] =
    useState<ContactDetailsDraft | null>(null);
  const [socialPickerOpen, setSocialPickerOpen] = useState(false);
  const [socialSearch, setSocialSearch] = useState("");
  const [socialDraft, setSocialDraft] = useState<SocialLink | null>(null);
  const [socialError, setSocialError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const lastSavedPayload = useRef(
    initial.items[0] ? payloadSignature(initial.items[0]) : "",
  );
  const saving = useRef(false);

  const filtered = cards.filter((card) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [displayName(card), card.company, card.slug].some((value) =>
        value.toLowerCase().includes(query),
      );
    const matchesFilter =
      filter === "all" ||
      (filter === "mine" && card.ownerId === currentUserId) ||
      (filter === "team" && card.ownerId !== currentUserId) ||
      (filter === "active" && card.status === "published") ||
      (filter === "archived" && card.status === "archived");
    return matchesSearch && matchesFilter;
  });

  function selectCard(card: SmartCard) {
    const nextCard = {
      ...card,
      actions: card.actions.map((action) => ({ ...action })),
      contactForm: cloneForm(card.contactForm),
      contactPoints: card.contactPoints.map((point) => ({ ...point })),
      socialLinks: card.socialLinks.map((link) => ({ ...link })),
    };
    setSelected(nextCard);
    setDraft(nextCard);
    setMetrics(null);
    setWalletStatus(null);
    setQrDataUrl(card.qrAsset?.encodedUrl ?? "");
    setShowCreate(false);
    setNotice("");
    setError("");
    lastSavedPayload.current = payloadSignature(nextCard);
    setSaveStatus("saved");
  }

  function updateDraft(changes: Partial<SmartCard>) {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function editContactDetails(card: SmartCard) {
    setContactDetails({
      firstName: card.firstName,
      lastName: card.lastName,
      headline: card.headline,
      company: card.company,
      email: card.email,
      phone: card.phone,
      whatsapp: card.whatsapp,
      websiteUrl: card.websiteUrl,
      publicDetails: { ...card.contactForm.publicDetails },
      contactPoints: card.contactPoints.map((point) => ({ ...point })),
    });
  }

  function saveContactDetails() {
    if (!draft || !contactDetails) return;
    const invalidContactPoint = contactDetails.contactPoints.some((point) =>
      point.type === "phone"
        ? !/^\+?[0-9 ()-]{7,24}$/.test(point.value)
        : !/^\S+@\S+\.\S+$/.test(point.value),
    );
    if (invalidContactPoint) {
      setError("Complete os telefones e e-mails adicionais antes de salvar.");
      return;
    }
    updateDraft({
      firstName: contactDetails.firstName,
      lastName: contactDetails.lastName,
      headline: contactDetails.headline,
      company: contactDetails.company,
      email: contactDetails.email,
      phone: contactDetails.phone,
      whatsapp: contactDetails.whatsapp,
      websiteUrl: contactDetails.websiteUrl,
      contactPoints: contactDetails.contactPoints,
      contactForm: {
        ...draft.contactForm,
        publicDetails: { ...contactDetails.publicDetails },
      },
    });
    setContactDetails(null);
  }

  function saveSocialLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !socialDraft) return;
    const url = normalizeSocialUrl(socialDraft.providerId, socialDraft.url);
    if (!url) {
      setSocialError("Informe um endereço válido para esta rede.");
      return;
    }
    updateDraft({
      socialLinks: [
        ...draft.socialLinks.filter(
          (link) => link.providerId !== socialDraft.providerId,
        ),
        {
          ...socialDraft,
          url,
          ...(socialDraft.label?.trim()
            ? { label: socialDraft.label.trim() }
            : {}),
        },
      ],
    });
    setSocialDraft(null);
    setSocialError("");
  }

  async function saveCard() {
    if (!draft || !canEdit || saving.current) return;
    const cardToSave = draft;
    const savedSignature = payloadSignature(cardToSave);
    saving.current = true;
    setBusy(true);
    setSaveStatus("saving");
    setError("");
    try {
      const saved = await apiRequest<SmartCard>(
        `/api/smart-cards/${cardToSave.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(toPayload(cardToSave)),
        },
      );
      setCards((current) =>
        current.map((card) => (card.id === saved.id ? saved : card)),
      );
      setSelected(saved);
      setDraft((current) =>
        current && payloadSignature(current) === savedSignature
          ? saved
          : current,
      );
      lastSavedPayload.current = savedSignature;
      setSaveStatus("saved");
    } catch (requestError) {
      setSaveStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar as alterações.",
      );
    } finally {
      saving.current = false;
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

  async function loadWalletStatus() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      setWalletStatus(
        await apiRequest<WalletStatus>(
          `/api/smart-cards/${selected.id}/wallet`,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o status de Wallet.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function syncWallet(provider: "apple" | "google") {
    if (!selected || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/smart-cards/${selected.id}/wallet`, {
        method: "POST",
        body: JSON.stringify({ provider }),
      });
      setNotice(
        provider === "apple"
          ? "Apple Wallet sincronizado."
          : "Google Wallet sincronizado.",
      );
      await loadWalletStatus();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível sincronizar o passe.",
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

  async function shareCard(card: SmartCard) {
    const url = publicUrl(publicOrigin, card.slug);
    try {
      if (navigator.share) {
        await navigator.share({
          title: displayName(card),
          text: [card.headline, card.company].filter(Boolean).join(" · "),
          url,
        });
        setNotice("Cartão compartilhado.");
      } else {
        await copy(url, "Link público copiado.");
      }
    } catch {
      // Cancelling the native share sheet should not surface as an error.
    }
  }

  const saveDraftAutomatically = useEffectEvent(() => {
    void saveCard();
  });
  const draftSignature = draft ? payloadSignature(draft) : "";

  useEffect(() => {
    if (
      !draft ||
      !canEdit ||
      showCreate ||
      draftSignature === lastSavedPayload.current
    )
      return;
    setSaveStatus("saving");
    const timeout = window.setTimeout(saveDraftAutomatically, 700);
    return () => window.clearTimeout(timeout);
  }, [canEdit, draft, draftSignature, showCreate]);

  const activeCard = draft ?? selected;
  const qrPreviewUrl =
    qrDataUrl ||
    (activeCard?.qrAsset
      ? `/api/smart-cards/${activeCard.id}/qr?format=png`
      : "");

  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Smart Cards</span>
          <h1>Cartões profissionais preparados para Wallet.</h1>
          <p>Seu cartão profissional sempre com você.</p>
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
            <p className={styles.empty}>
              {cards.length
                ? "Nenhum cartão com este filtro."
                : "Crie seu primeiro Smart Card."}
            </p>
          )}
          {activeCard && (
            <nav className={styles.sectionNav} aria-label="Editor do cartão">
              <span>Configurações</span>
              {(
                [
                  "identity",
                  "contact",
                  "socials",
                  "appearance",
                  "wallet",
                  "analytics",
                ] as const
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-current={tab === value ? "page" : undefined}
                  onClick={() => {
                    setTab(value);
                    if (value === "analytics") void loadMetrics();
                    if (value === "wallet") void loadWalletStatus();
                  }}
                >
                  {
                    {
                      identity: "Identidade",
                      contact: "Contato",
                      socials: "Redes",
                      appearance: "Aparência",
                      wallet: "Wallet",
                      analytics: "Analytics",
                    }[value]
                  }
                </button>
              ))}
            </nav>
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
                <span
                  className={styles.saveStatus}
                  data-status={saveStatus}
                  role="status"
                >
                  {saveStatus === "saving"
                    ? "Salvando..."
                    : saveStatus === "error"
                      ? "Erro ao salvar"
                      : "Salvo"}
                </span>
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
                  <FiEye aria-hidden="true" /> <span>Visualizar</span>
                </a>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setShowShare(true)}
                >
                  <FiShare2 aria-hidden="true" /> <span>Compartilhar</span>
                </button>
                {canEdit && (
                  <details className={styles.moreMenu}>
                    <summary aria-label="Mais ações">
                      <FiMoreHorizontal aria-hidden="true" />
                    </summary>
                    <div>
                      <button type="button" disabled={busy} onClick={saveCard}>
                        Salvar agora
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={generateQr}
                      >
                        Gerar QR
                      </button>
                    </div>
                  </details>
                )}
              </div>
            </div>

            <div className={styles.editorGrid}>
              <div className={styles.editor}>
                {tab === "identity" && (
                  <div className={styles.panel}>
                    <h3>Identidade</h3>
                    <p>
                      Apresente sua identidade e mantenha os detalhes de contato
                      em um único lugar.
                    </p>
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
                    </div>
                  </div>
                )}

                {tab === "socials" && (
                  <div className={styles.panel}>
                    <div className={styles.socialHeading}>
                      <div>
                        <h3>Redes sociais</h3>
                        <p>
                          Adicione apenas os canais que fazem sentido para o
                          cartão profissional.
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => {
                            setSocialSearch("");
                            setSocialPickerOpen(true);
                          }}
                        >
                          <FiPlus aria-hidden="true" /> Adicionar rede
                        </button>
                      )}
                    </div>
                    {activeCard.socialLinks.length ? (
                      <ul className={styles.socialList}>
                        {activeCard.socialLinks.map((link) => {
                          const provider = getSocialProvider(link.providerId);
                          if (!provider) return null;
                          const Icon = provider.icon;
                          return (
                            <li key={link.providerId}>
                              <span className={styles.socialIcon}>
                                <Icon aria-hidden="true" />
                              </span>
                              <div>
                                <strong>{provider.name}</strong>
                                <small>{link.label || link.url}</small>
                              </div>
                              {canEdit && (
                                <div className={styles.socialTools}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSocialError("");
                                      setSocialDraft({ ...link });
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remover ${provider.name}`}
                                    title={`Remover ${provider.name}`}
                                    onClick={() =>
                                      updateDraft({
                                        socialLinks:
                                          activeCard.socialLinks.filter(
                                            (item) =>
                                              item.providerId !==
                                              link.providerId,
                                          ),
                                      })
                                    }
                                  >
                                    <FiTrash2 aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className={styles.empty}>
                        Nenhuma rede adicionada a este cartão.
                      </p>
                    )}
                    <section className={styles.linkActionsSection}>
                      <div className={styles.actionHeading}>
                        <div>
                          <h3>Links e CTAs</h3>
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
                            <FiPlus aria-hidden="true" /> Adicionar link
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
                                        ? {
                                            ...item,
                                            label: event.target.value,
                                          }
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
                                        ? {
                                            ...item,
                                            url: event.target.value,
                                          }
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
                    </section>
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
                        Texto
                        <input
                          disabled={!canEdit}
                          type="color"
                          value={activeCard.theme.textColor ?? "#17322c"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                textColor: event.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Texto dos botões
                        <input
                          disabled={!canEdit}
                          type="color"
                          value={activeCard.theme.buttonTextColor ?? "#ffffff"}
                          onChange={(event) =>
                            updateDraft({
                              theme: {
                                ...activeCard.theme,
                                buttonTextColor: event.target.value,
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
                      <label className={styles.full}>
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
                    </div>
                  </div>
                )}

                {tab === "contact" && (
                  <div className={styles.panel}>
                    <h3>Contato</h3>
                    <p>
                      Defina os dados que estarão disponíveis no cartão e na
                      Wallet.
                    </p>
                    <section className={styles.contactSummary}>
                      <div>
                        <span>Dados públicos</span>
                        <h4>Detalhes de contato</h4>
                        <p>
                          Telefones, e-mails e canais que visitantes podem
                          salvar.
                        </p>
                      </div>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={!canEdit}
                        onClick={() => editContactDetails(activeCard)}
                      >
                        Editar contato
                      </button>
                    </section>
                    <div className={styles.fieldGrid}>
                      <label>
                        Localização
                        <input
                          disabled={!canEdit}
                          value={activeCard.location ?? ""}
                          maxLength={160}
                          onChange={(event) =>
                            updateDraft({
                              location: event.target.value || null,
                            })
                          }
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
                    </div>
                    <details className={styles.advanced}>
                      <summary>Captura de contato (opcional)</summary>
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
                          <option value="save_contact">
                            Salvar meu contato
                          </option>
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
                                          ? {
                                              ...item,
                                              label: event.target.value,
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
                    </details>
                  </div>
                )}

                {tab === "wallet" && (
                  <div className={styles.panel}>
                    <h3>Wallet e distribuição</h3>
                    <p>
                      Seu cartão profissional pode ser emitido para Apple Wallet
                      e Google Wallet quando a integração estiver configurada.
                    </p>
                    {!walletStatus ? (
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busy}
                        onClick={loadWalletStatus}
                      >
                        Carregar status de Wallet
                      </button>
                    ) : (
                      <div className={styles.walletProviders}>
                        {walletStatus.providers.map((wallet) => {
                          const configured =
                            wallet.state === "test_mode" ||
                            wallet.state === "ready";
                          const stateLabel = {
                            not_configured: "Configuração necessária",
                            configuration_pending: "Configuração pendente",
                            test_mode: "Modo de teste",
                            ready: "Pronto",
                            error: "Erro de configuração",
                          }[wallet.state];
                          const passLabel = wallet.pass
                            ? {
                                pending_sync: "Pendente de sincronização",
                                synced: "Sincronizado",
                                sync_failed: "Falha na sincronização",
                                revoked: "Desativado",
                              }[wallet.pass.status]
                            : "Ainda não emitido";
                          return (
                            <section
                              key={wallet.provider}
                              className={styles.walletProvider}
                              data-state={wallet.state}
                            >
                              <div>
                                <strong>
                                  {wallet.provider === "apple"
                                    ? "Apple Wallet"
                                    : "Google Wallet"}
                                </strong>
                                <span>{stateLabel}</span>
                                <small>{wallet.message}</small>
                                <small>{passLabel}</small>
                              </div>
                              <button
                                className="button button-secondary"
                                type="button"
                                disabled={
                                  busy ||
                                  !canEdit ||
                                  !configured ||
                                  activeCard.status !== "published"
                                }
                                onClick={() => syncWallet(wallet.provider)}
                              >
                                {wallet.pass?.status === "synced"
                                  ? "Sincronizar"
                                  : "Emitir passe"}
                              </button>
                            </section>
                          );
                        })}
                      </div>
                    )}
                    <h4 className={styles.distributionTitle}>QR e link</h4>
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
                    <details className={styles.shareMoreOptions}>
                      <summary>Mais opções</summary>
                      <div>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FiShare2 aria-hidden="true" /> WhatsApp
                        </a>
                        <a
                          href={`mailto:?subject=${encodeURIComponent(displayName(activeCard))}&body=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                        >
                          <FiMail aria-hidden="true" /> E-mail
                        </a>
                      </div>
                    </details>
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
                            <span>QR rastreável</span>
                            <strong>{metrics.qrScans}</strong>
                          </div>
                          <div>
                            <span>Apple Wallet</span>
                            <strong>{metrics.appleWalletClicks}</strong>
                          </div>
                          <div>
                            <span>Google Wallet</span>
                            <strong>{metrics.googleWalletClicks}</strong>
                          </div>
                          {metrics.walletAddsConfirmed !== null && (
                            <div>
                              <span>Adições confirmadas</span>
                              <strong>{metrics.walletAddsConfirmed}</strong>
                            </div>
                          )}
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
                    {(["web", "apple", "google"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={previewMode === mode}
                        onClick={() => setPreviewMode(mode)}
                      >
                        {
                          {
                            web: "Web",
                            apple: "Apple Wallet",
                            google: "Google Wallet",
                          }[mode]
                        }
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className={styles.phone}
                  data-preview={previewMode === "web" ? "web" : "wallet"}
                >
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
                  className={styles.walletPreview}
                  data-active={previewMode !== "web"}
                >
                  <article
                    className={styles.walletPassPreview}
                    data-provider={previewMode}
                  >
                    <header>
                      <strong>
                        {previewMode === "apple"
                          ? "Apple Wallet"
                          : "Google Wallet"}
                      </strong>
                      <span>Smart Card</span>
                    </header>
                    <div className={styles.walletPassIdentity}>
                      {activeCard.avatarUrl ? (
                        <img src={activeCard.avatarUrl} alt="" />
                      ) : (
                        <span>{initials(activeCard)}</span>
                      )}
                      <div>
                        <strong>{displayName(activeCard)}</strong>
                        <span>{activeCard.headline}</span>
                        <small>{activeCard.company}</small>
                      </div>
                    </div>
                    <div className={styles.walletPassFields}>
                      {activeCard.email && <span>{activeCard.email}</span>}
                      {activeCard.phone && <span>{activeCard.phone}</span>}
                      {activeCard.websiteUrl && (
                        <span>{activeCard.websiteUrl}</span>
                      )}
                    </div>
                    <div className={styles.walletPassQr}>
                      {qrPreviewUrl ? (
                        <img
                          src={qrPreviewUrl}
                          alt={`QR Code de ${displayName(activeCard)}`}
                        />
                      ) : (
                        <>
                          <FiGrid aria-hidden="true" />
                          <span>QR rastreável ao emitir</span>
                        </>
                      )}
                    </div>
                  </article>
                  <p>
                    A Wallet usa os campos compatíveis do cartão; cores, fontes
                    e layout seguem a plataforma.
                  </p>
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

      {contactDetails && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => setContactDetails(null)}
        >
          <section
            className={styles.contactDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-card-contact-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Smart Card</span>
                <h2 id="smart-card-contact-title">Detalhes de contato</h2>
                <p>Escolha quais informações as pessoas poderão salvar.</p>
              </div>
              <button
                className={styles.dialogClose}
                type="button"
                aria-label="Fechar detalhes de contato"
                onClick={() => setContactDetails(null)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>
            <div className={styles.contactDialogBody}>
              <div className={styles.contactDialogGrid}>
                <label>
                  Nome
                  <input
                    value={contactDetails.firstName}
                    maxLength={80}
                    onChange={(event) =>
                      setContactDetails((current) =>
                        current
                          ? { ...current, firstName: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  Sobrenome
                  <input
                    value={contactDetails.lastName}
                    maxLength={80}
                    onChange={(event) =>
                      setContactDetails((current) =>
                        current
                          ? { ...current, lastName: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  Empresa
                  <input
                    value={contactDetails.company}
                    maxLength={120}
                    onChange={(event) =>
                      setContactDetails((current) =>
                        current
                          ? { ...current, company: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  Cargo
                  <input
                    value={contactDetails.headline}
                    maxLength={160}
                    onChange={(event) =>
                      setContactDetails((current) =>
                        current
                          ? { ...current, headline: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
              <div className={styles.contactDetailsList}>
                {(
                  [
                    ["email", "E-mail", "email"],
                    ["phone", "Telefone", "tel"],
                    ["whatsapp", "WhatsApp", "tel"],
                    ["websiteUrl", "Website", "url"],
                  ] as const
                ).map(([key, label, type]) => {
                  const visibilityKey = key === "websiteUrl" ? "website" : key;
                  return (
                    <label key={key}>
                      <span>{label}</span>
                      <div>
                        <input
                          type={type}
                          value={contactDetails[key] ?? ""}
                          onChange={(event) =>
                            setContactDetails((current) =>
                              current
                                ? {
                                    ...current,
                                    [key]: event.target.value || null,
                                  }
                                : current,
                            )
                          }
                        />
                        <span className={styles.contactVisibility}>
                          <input
                            type="checkbox"
                            checked={
                              contactDetails.publicDetails[visibilityKey]
                            }
                            onChange={(event) =>
                              setContactDetails((current) =>
                                current
                                  ? {
                                      ...current,
                                      publicDetails: {
                                        ...current.publicDetails,
                                        [visibilityKey]: event.target.checked,
                                      },
                                    }
                                  : current,
                              )
                            }
                          />
                          Público
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className={styles.contactPoints}>
                <div className={styles.contactPointHeader}>
                  <div>
                    <h3>Contatos adicionais</h3>
                    <p>
                      Inclua telefones ou e-mails alternativos, se necessário.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setContactDetails((current) =>
                          current
                            ? {
                                ...current,
                                contactPoints: [
                                  ...current.contactPoints,
                                  { type: "phone", value: "" },
                                ],
                              }
                            : current,
                        )
                      }
                    >
                      <FiPlus aria-hidden="true" /> Adicionar telefone
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setContactDetails((current) =>
                          current
                            ? {
                                ...current,
                                contactPoints: [
                                  ...current.contactPoints,
                                  { type: "email", value: "" },
                                ],
                              }
                            : current,
                        )
                      }
                    >
                      <FiPlus aria-hidden="true" /> Adicionar e-mail
                    </button>
                  </div>
                </div>
                {contactDetails.contactPoints.map((point, index) => (
                  <div
                    className={styles.contactPoint}
                    key={`${point.type}-${index}`}
                  >
                    <label>
                      {point.type === "phone" ? "Telefone" : "E-mail"}
                      <input
                        type={point.type === "phone" ? "tel" : "email"}
                        value={point.value}
                        onChange={(event) =>
                          setContactDetails((current) =>
                            current
                              ? {
                                  ...current,
                                  contactPoints: current.contactPoints.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, value: event.target.value }
                                        : item,
                                  ),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <label>
                      Rótulo opcional
                      <input
                        value={point.label ?? ""}
                        maxLength={80}
                        placeholder={
                          point.type === "phone" ? "Comercial" : "Trabalho"
                        }
                        onChange={(event) =>
                          setContactDetails((current) =>
                            current
                              ? {
                                  ...current,
                                  contactPoints: current.contactPoints.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            label:
                                              event.target.value || undefined,
                                          }
                                        : item,
                                  ),
                                }
                              : current,
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label={`Remover ${
                        point.type === "phone" ? "telefone" : "e-mail"
                      } adicional`}
                      title="Remover contato adicional"
                      onClick={() =>
                        setContactDetails((current) =>
                          current
                            ? {
                                ...current,
                                contactPoints: current.contactPoints.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              }
                            : current,
                        )
                      }
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <footer>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setContactDetails(null)}
              >
                Cancelar
              </button>
              <button
                className="button"
                type="button"
                onClick={saveContactDetails}
              >
                Salvar alterações
              </button>
            </footer>
          </section>
        </div>
      )}

      {activeCard && socialPickerOpen && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => setSocialPickerOpen(false)}
        >
          <section
            className={styles.socialDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-card-social-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Redes sociais</span>
                <h2 id="smart-card-social-picker-title">Adicionar rede</h2>
              </div>
              <button
                className={styles.dialogClose}
                type="button"
                aria-label="Fechar seletor de rede"
                onClick={() => setSocialPickerOpen(false)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>
            <label className={styles.socialSearch}>
              Buscar rede
              <input
                autoFocus
                value={socialSearch}
                placeholder="Instagram, GitHub, LinkedIn..."
                onChange={(event) => setSocialSearch(event.target.value)}
              />
            </label>
            <div className={styles.socialPickerList}>
              {socialProviders
                .filter(
                  (provider) =>
                    !activeCard.socialLinks.some(
                      (link) => link.providerId === provider.id,
                    ) &&
                    provider.name
                      .toLowerCase()
                      .includes(socialSearch.trim().toLowerCase()),
                )
                .map((provider) => {
                  const Icon = provider.icon;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setSocialDraft({ providerId: provider.id, url: "" });
                        setSocialPickerOpen(false);
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span>{provider.name}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {socialDraft && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => setSocialDraft(null)}
        >
          <form
            className={styles.socialDialog}
            onSubmit={saveSocialLink}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {(() => {
              const provider = getSocialProvider(socialDraft.providerId);
              if (!provider) return null;
              return (
                <>
                  <header>
                    <div>
                      <span className="eyebrow">{provider.name}</span>
                      <h2>Detalhes da rede</h2>
                    </div>
                    <button
                      className={styles.dialogClose}
                      type="button"
                      aria-label="Fechar detalhes da rede"
                      onClick={() => setSocialDraft(null)}
                    >
                      <FiX aria-hidden="true" />
                    </button>
                  </header>
                  <label className={styles.socialSearch}>
                    Endereço
                    <input
                      autoFocus
                      required
                      value={socialDraft.url}
                      placeholder={provider.placeholder}
                      onChange={(event) =>
                        setSocialDraft((current) =>
                          current
                            ? { ...current, url: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className={styles.socialSearch}>
                    Rótulo opcional
                    <input
                      value={socialDraft.label ?? ""}
                      maxLength={80}
                      onChange={(event) =>
                        setSocialDraft((current) =>
                          current
                            ? { ...current, label: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  {socialError && (
                    <p className="form-error" role="alert">
                      {socialError}
                    </p>
                  )}
                  <footer>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setSocialDraft(null)}
                    >
                      Cancelar
                    </button>
                    <button className="button" type="submit">
                      Adicionar rede
                    </button>
                  </footer>
                </>
              );
            })()}
          </form>
        </div>
      )}

      {activeCard && showShare && (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={() => setShowShare(false)}
        >
          <section
            className={styles.shareDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-card-share-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">Compartilhamento</span>
                <h2 id="smart-card-share-title">Seu Smart Card</h2>
              </div>
              <button
                className={styles.dialogClose}
                type="button"
                aria-label="Fechar compartilhamento"
                onClick={() => setShowShare(false)}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>
            <div className={styles.shareDialogContent}>
              <div className={styles.shareQr}>
                {qrDataUrl || activeCard.qrAsset ? (
                  <img
                    src={
                      qrDataUrl ||
                      `/api/smart-cards/${activeCard.id}/qr?format=png`
                    }
                    alt={`QR Code de ${displayName(activeCard)}`}
                  />
                ) : (
                  <div>
                    <FiGrid aria-hidden="true" />
                    <span>Gere seu QR rastreável</span>
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
                  </div>
                )}
              </div>
              <div>
                <strong>{displayName(activeCard)}</strong>
                <p>{publicUrl(publicOrigin, activeCard.slug)}</p>
                <div className={styles.shareDialogLink}>
                  <input
                    aria-label="Link público do Smart Card"
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
                    <FiCopy aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.shareChannels}>
                  <button
                    type="button"
                    onClick={() => void shareCard(activeCard)}
                  >
                    <FiShare2 aria-hidden="true" /> Compartilhar
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent(displayName(activeCard))}&body=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                  >
                    <FiMail aria-hidden="true" /> E-mail
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl(publicOrigin, activeCard.slug))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
            {activeCard.qrAsset && (
              <footer className={styles.shareDownloads}>
                <a href={`/api/smart-cards/${activeCard.id}/qr?format=png`}>
                  <FiDownload aria-hidden="true" /> PNG
                </a>
                <a href={`/api/smart-cards/${activeCard.id}/qr?format=svg`}>
                  <FiDownload aria-hidden="true" /> SVG
                </a>
                <a href={`/api/smart-cards/${activeCard.id}/qr?format=pdf`}>
                  Imprimir
                </a>
              </footer>
            )}
          </section>
        </div>
      )}

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
