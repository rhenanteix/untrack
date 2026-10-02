"use client";

import { useState } from "react";
import { FiMail, FiMessageCircle, FiPlus } from "react-icons/fi";
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
  status:
    "new_contact" | "interested" | "qualified" | "customer" | "not_interested";
  temperature: "cold" | "warm" | "hot";
  updatedAt: string;
  exchanges: Exchange[];
  events?: {
    id: string;
    name: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }[];
  _count?: { events: number; exchanges: number };
};

const statusLabels = {
  new_contact: "Novo",
  interested: "Interessado",
  qualified: "Qualificado",
  customer: "Cliente",
  not_interested: "Sem interesse",
};

const temperatureLabels = { cold: "Frio", warm: "Morno", hot: "Quente" };

function nameOf(contact: Contact) {
  return (
    `${contact.firstName} ${contact.lastName}`.trim() || "Contato sem nome"
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventLabel(
  event: Contact["events"] extends (infer Item)[] | undefined ? Item : never,
) {
  if (event.name === "contact_captured") return "Compartilhou contato";
  if (event.name === "card_viewed") return "Retornou ao cartão";
  if (event.name === "link_clicked") return "Abriu um link";
  if (event.name === "whatsapp_clicked") return "Clicou em WhatsApp";
  if (event.name === "booking_clicked") return "Abriu agendamento";
  if (event.name === "note_added") return "Nota adicionada";
  return event.name;
}

export function AudienceDashboard({
  initial,
  canEdit,
}: {
  initial: { items: Contact[]; page: number; hasMore: boolean };
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState(initial.items);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");

  const filtered = contacts.filter((contact) =>
    `${nameOf(contact)} ${contact.email ?? ""} ${contact.company ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  async function openContact(contact: Contact) {
    setBusy(true);
    setError("");
    try {
      setSelected(
        await apiRequest<Contact>(`/api/audience/contacts/${contact.id}`),
      );
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

  async function updateContact(change: {
    status?: Contact["status"];
    temperature?: Contact["temperature"];
    note?: string;
  }) {
    if (!selected || !canEdit) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest<Contact>(
        `/api/audience/contacts/${selected.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(change),
        },
      );
      setContacts((current) =>
        current.map((contact) =>
          contact.id === saved.id ? { ...contact, ...saved } : contact,
        ),
      );
      if (change.note) {
        setSelected(
          await apiRequest<Contact>(`/api/audience/contacts/${selected.id}`),
        );
        setNote("");
      } else
        setSelected((current) =>
          current ? { ...current, ...saved } : current,
        );
      setNotice(
        change.note
          ? "Nota adicionada à timeline."
          : "Classificação atualizada.",
      );
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

  const latestExchange = selected?.exchanges[0];
  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Audience</span>
          <h1>Contatos com contexto, não só uma planilha.</h1>
          <p>
            Todo compartilhamento de Smart Card chega com origem, interesse,
            campanha e histórico.
          </p>
        </div>
        <label>
          <span>Buscar contato</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, e-mail ou empresa"
          />
        </label>
      </header>
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
        <section className={styles.list} aria-label="Contatos">
          <div className={styles.listTitle}>
            <h2>Contatos</h2>
            <span>{filtered.length}</span>
          </div>
          {filtered.length ? (
            filtered.map((contact) => {
              const exchange = contact.exchanges[0];
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
                    <small>
                      {contact.company || contact.email || "Sem empresa"}
                    </small>
                    <em>
                      {exchange?.smartCard
                        ? `${exchange.smartCard.firstName} ${exchange.smartCard.lastName}`
                        : "Smart Card"}
                    </em>
                  </span>
                  <i data-temperature={contact.temperature}>
                    {temperatureLabels[contact.temperature]}
                  </i>
                </button>
              );
            })
          ) : (
            <p className={styles.empty}>Nenhum contato encontrado.</p>
          )}
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
              <label>
                Status
                <select
                  disabled={!canEdit || busy}
                  value={selected.status}
                  onChange={(event) =>
                    void updateContact({
                      status: event.target.value as Contact["status"],
                    })
                  }
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Temperatura
                <select
                  disabled={!canEdit || busy}
                  value={selected.temperature}
                  onChange={(event) =>
                    void updateContact({
                      temperature: event.target.value as Contact["temperature"],
                    })
                  }
                >
                  {Object.entries(temperatureLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {latestExchange && (
              <section className={styles.context}>
                <h3>Contexto da captura</h3>
                <dl>
                  <div>
                    <dt>Cartão</dt>
                    <dd>
                      {latestExchange.smartCard.firstName}{" "}
                      {latestExchange.smartCard.lastName}
                    </dd>
                  </div>
                  <div>
                    <dt>Origem</dt>
                    <dd>
                      {latestExchange.sourceLabel || latestExchange.source}
                    </dd>
                  </div>
                  <div>
                    <dt>Interesse</dt>
                    <dd>{latestExchange.intent || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Campanha</dt>
                    <dd>{latestExchange.campaign?.name || "Sem campanha"}</dd>
                  </div>
                  <div>
                    <dt>Capturado</dt>
                    <dd>{formatDate(latestExchange.capturedAt)}</dd>
                  </div>
                </dl>
              </section>
            )}
            <section className={styles.timeline}>
              <h3>Timeline</h3>
              <ol>
                {selected.events?.length ? (
                  selected.events.map((event) => (
                    <li key={event.id}>
                      <time>{formatDate(event.occurredAt)}</time>
                      <div>
                        <strong>{eventLabel(event)}</strong>
                        {event.name === "note_added" &&
                          typeof event.metadata.note === "string" && (
                            <p>{event.metadata.note}</p>
                          )}
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
                  if (note.trim()) void updateContact({ note: note.trim() });
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
