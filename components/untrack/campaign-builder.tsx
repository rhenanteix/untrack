"use client";

import { useState, type FormEvent } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from "react-icons/fi";
import { apiRequest } from "./shared";

type Client = { id: string; name: string };
type Member = { user: { id: string; name: string } };
type SmartPage = { id: string; title: string; slug: string };

type BuilderContext = {
  clients: Client[];
  members: Member[];
  smartPages: SmartPage[];
};

type ChannelOption = {
  name: string;
  type:
    | "social"
    | "email"
    | "paid"
    | "organic"
    | "qr"
    | "link"
    | "whatsapp"
    | "partner"
    | "offline"
    | "other";
  category: string;
};

const objectives = [
  ["sales", "Vendas"],
  ["leads", "Leads"],
  ["traffic", "Tráfego"],
  ["registrations", "Inscrições"],
  ["event", "Evento"],
  ["whatsapp", "WhatsApp"],
  ["engagement", "Engajamento"],
  ["awareness", "Divulgação"],
  ["other", "Outro"],
] as const;

const channelOptions: ChannelOption[] = [
  { name: "Instagram", type: "social", category: "Social" },
  { name: "Facebook", type: "social", category: "Social" },
  { name: "TikTok", type: "social", category: "Social" },
  { name: "LinkedIn", type: "social", category: "Social" },
  { name: "YouTube", type: "social", category: "Social" },
  { name: "WhatsApp", type: "whatsapp", category: "Mensagens" },
  { name: "E-mail", type: "email", category: "Mensagens" },
  { name: "SMS", type: "other", category: "Mensagens" },
  { name: "Meta Ads", type: "paid", category: "Publicidade" },
  { name: "Google Ads", type: "paid", category: "Publicidade" },
  { name: "TikTok Ads", type: "paid", category: "Publicidade" },
  { name: "QR Code", type: "qr", category: "Offline" },
  { name: "Material impresso", type: "offline", category: "Offline" },
  { name: "Evento", type: "offline", category: "Offline" },
  { name: "Parceiro", type: "partner", category: "Parcerias" },
  { name: "Influenciador", type: "partner", category: "Parcerias" },
  { name: "Site", type: "organic", category: "Outros" },
  { name: "Personalizado", type: "other", category: "Outros" },
];

type Draft = {
  objectiveType: (typeof objectives)[number][0] | "";
  objectiveDescription: string;
  name: string;
  description: string;
  clientId: string;
  responsibleId: string;
  startDate: string;
  endDate: string;
  noEndDate: boolean;
  primaryDestinationType:
    "url" | "smart_page" | "whatsapp" | "product" | "landing_page" | "other";
  primaryDestinationId: string;
  primaryDestinationUrl: string;
  channels: ChannelOption[];
};

const initialDraft: Draft = {
  objectiveType: "",
  objectiveDescription: "",
  name: "",
  description: "",
  clientId: "",
  responsibleId: "",
  startDate: "",
  endDate: "",
  noEndDate: false,
  primaryDestinationType: "url",
  primaryDestinationId: "",
  primaryDestinationUrl: "",
  channels: [],
};

const destinationOptions = [
  ["url", "Website ou URL"],
  ["smart_page", "Smart Page"],
  ["whatsapp", "WhatsApp"],
  ["product", "Produto"],
  ["landing_page", "Landing Page"],
  ["other", "Outro"],
] as const;

function cardClass(selected: boolean) {
  return selected ? "campaign-choice is-selected" : "campaign-choice";
}

export function CampaignBuilder({
  context,
  onClose,
  onCreated,
}: {
  context: BuilderContext;
  onClose: () => void;
  onCreated: (campaign: { id: string }) => void;
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleChannel(option: ChannelOption) {
    update(
      "channels",
      draft.channels.some((channel) => channel.name === option.name)
        ? draft.channels.filter((channel) => channel.name !== option.name)
        : [...draft.channels, option],
    );
  }

  function chooseSmartPage(page: SmartPage) {
    update("primaryDestinationId", page.id);
    update("primaryDestinationUrl", `${window.location.origin}/${page.slug}`);
  }

  function canContinue() {
    if (step === 1) return Boolean(draft.objectiveType);
    if (step === 2) return Boolean(draft.name.trim());
    if (step === 3)
      return (
        !draft.startDate ||
        draft.noEndDate ||
        !draft.endDate ||
        draft.endDate >= draft.startDate
      );
    if (step === 4) return Boolean(draft.primaryDestinationUrl);
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const campaign = await apiRequest<{ id: string }>(
        "/api/campaigns?action=builder",
        {
          method: "POST",
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            clientId: draft.clientId || null,
            responsibleId: draft.responsibleId || null,
            objectiveType: draft.objectiveType,
            objectiveDescription: draft.objectiveDescription,
            startDate: draft.startDate || null,
            endDate: draft.noEndDate ? null : draft.endDate || null,
            primaryDestinationType: draft.primaryDestinationType,
            primaryDestinationId: draft.primaryDestinationId || null,
            primaryDestinationUrl: draft.primaryDestinationUrl,
            channels: draft.channels.map(({ name, type }) => ({ name, type })),
          }),
        },
      );
      setStep(6);
      onCreated(campaign);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível criar a campanha.",
      );
    } finally {
      setBusy(false);
    }
  }

  const visibleChannels = channelOptions.filter((channel) =>
    channel.name
      .toLocaleLowerCase("pt-BR")
      .includes(channelSearch.toLocaleLowerCase("pt-BR")),
  );

  return (
    <div className="campaign-dialog-backdrop" role="presentation">
      <section
        className="campaign-dialog campaign-builder"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-builder-title"
      >
        <header className="campaign-dialog-header">
          <div>
            <span className="campaign-dialog-step">
              Passo {Math.min(step, 5)} de 5
            </span>
            <h2 id="campaign-builder-title">
              {step === 1
                ? "O que você quer alcançar?"
                : step === 2
                  ? "Dê um contexto à campanha"
                  : step === 3
                    ? "Quando a campanha acontece?"
                    : step === 4
                      ? "Para onde você quer levar as pessoas?"
                      : step === 5
                        ? "Onde essa campanha será divulgada?"
                        : "Sua campanha está pronta"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar criador de campanha"
          >
            <FiX aria-hidden="true" />
          </button>
        </header>

        {step < 6 ? (
          <form className="campaign-dialog-body" onSubmit={submit}>
            {step === 1 && (
              <>
                <p className="campaign-dialog-copy">
                  Escolha o resultado que melhor descreve esta iniciativa.
                </p>
                <div className="campaign-choice-grid">
                  {objectives.map(([value, label]) => (
                    <button
                      key={value}
                      className={cardClass(draft.objectiveType === value)}
                      type="button"
                      onClick={() => update("objectiveType", value)}
                    >
                      {draft.objectiveType === value && (
                        <FiCheck aria-hidden="true" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
                <label className="campaign-field">
                  <span>
                    Detalhe do objetivo <em>opcional</em>
                  </span>
                  <textarea
                    value={draft.objectiveDescription}
                    maxLength={1000}
                    placeholder="Ex.: gerar inscrições para as novas aulas."
                    onChange={(event) =>
                      update("objectiveDescription", event.target.value)
                    }
                  />
                </label>
              </>
            )}

            {step === 2 && (
              <div className="campaign-form-grid">
                <label className="campaign-field campaign-field-wide">
                  <span>Nome da campanha</span>
                  <input
                    value={draft.name}
                    required
                    maxLength={120}
                    placeholder="Ex.: Aulas de Yoga"
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="campaign-field">
                  <span>
                    Cliente ou projeto <em>opcional</em>
                  </span>
                  <select
                    value={draft.clientId}
                    onChange={(event) => update("clientId", event.target.value)}
                  >
                    <option value="">Sem cliente</option>
                    {context.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-field">
                  <span>
                    Responsável <em>opcional</em>
                  </span>
                  <select
                    value={draft.responsibleId}
                    onChange={(event) =>
                      update("responsibleId", event.target.value)
                    }
                  >
                    <option value="">Sem responsável</option>
                    {context.members.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campaign-field campaign-field-wide">
                  <span>
                    Descrição <em>opcional</em>
                  </span>
                  <textarea
                    value={draft.description}
                    maxLength={2000}
                    placeholder="Contexto que ajuda sua equipe a reconhecer a campanha."
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                  />
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="campaign-form-grid">
                <label className="campaign-field">
                  <span>Data inicial</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(event) =>
                      update("startDate", event.target.value)
                    }
                  />
                </label>
                <label className="campaign-field">
                  <span>Data final</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    disabled={draft.noEndDate}
                    min={draft.startDate || undefined}
                    onChange={(event) => update("endDate", event.target.value)}
                  />
                </label>
                <label className="campaign-checkbox campaign-field-wide">
                  <input
                    type="checkbox"
                    checked={draft.noEndDate}
                    onChange={(event) =>
                      update("noEndDate", event.target.checked)
                    }
                  />
                  <span>Sem data final</span>
                </label>
              </div>
            )}

            {step === 4 && (
              <>
                <div className="campaign-choice-grid campaign-choice-grid-compact">
                  {destinationOptions.map(([value, label]) => (
                    <button
                      key={value}
                      className={cardClass(
                        draft.primaryDestinationType === value,
                      )}
                      type="button"
                      onClick={() => {
                        update("primaryDestinationType", value);
                        update("primaryDestinationId", "");
                      }}
                    >
                      {draft.primaryDestinationType === value && (
                        <FiCheck aria-hidden="true" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
                {draft.primaryDestinationType === "smart_page" &&
                  context.smartPages.length > 0 && (
                    <div
                      className="campaign-resource-picker"
                      role="listbox"
                      aria-label="Smart Pages publicadas"
                    >
                      {context.smartPages.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          className={
                            draft.primaryDestinationId === page.id
                              ? "is-selected"
                              : ""
                          }
                          onClick={() => chooseSmartPage(page)}
                        >
                          <strong>{page.title}</strong>
                          <span>/{page.slug}</span>
                        </button>
                      ))}
                    </div>
                  )}
                <label className="campaign-field">
                  <span>Destino principal</span>
                  <input
                    type="url"
                    value={draft.primaryDestinationUrl}
                    required
                    placeholder="https://..."
                    onChange={(event) =>
                      update("primaryDestinationUrl", event.target.value)
                    }
                  />
                </label>
              </>
            )}

            {step === 5 && (
              <>
                <label className="campaign-field">
                  <span>Pesquisar canal</span>
                  <input
                    value={channelSearch}
                    placeholder="Instagram, WhatsApp, QR Code..."
                    onChange={(event) => setChannelSearch(event.target.value)}
                  />
                </label>
                <div className="campaign-channel-grid">
                  {visibleChannels.map((channel) => {
                    const selected = draft.channels.some(
                      (item) => item.name === channel.name,
                    );
                    return (
                      <button
                        key={channel.name}
                        type="button"
                        className={cardClass(selected)}
                        onClick={() => toggleChannel(channel)}
                      >
                        <small>{channel.category}</small>
                        <strong>{channel.name}</strong>
                        {selected && <FiCheck aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <p className="campaign-selection-note">
                  {draft.channels.length
                    ? `${draft.channels.length} canal(is) selecionado(s). Os links e QR Codes só serão criados quando você adicionar um ponto de distribuição.`
                    : "Você pode criar canais agora ou adicioná-los depois."}
                </p>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        ) : (
          <div className="campaign-dialog-body campaign-builder-complete">
            <span className="campaign-complete-mark">
              <FiCheck aria-hidden="true" />
            </span>
            <p>Estrutura criada</p>
            <p>Tracking preparado</p>
            <p>Canais configurados</p>
            <strong>
              Agora adicione os pontos de distribuição que serão compartilhados.
            </strong>
          </div>
        )}

        <footer className="campaign-dialog-footer">
          {step > 1 && step < 6 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setStep((current) => current - 1)}
              disabled={busy}
            >
              <FiArrowLeft aria-hidden="true" /> Voltar
            </button>
          ) : (
            <span />
          )}
          {step < 5 && (
            <button
              className="button"
              type="button"
              disabled={!canContinue()}
              onClick={() => setStep((current) => current + 1)}
            >
              Continuar <FiArrowRight aria-hidden="true" />
            </button>
          )}
          {step === 5 && (
            <button
              className="button"
              type="button"
              disabled={!canContinue() || busy}
              onClick={(event) => void submit(event as unknown as FormEvent)}
            >
              Criar campanha {busy ? "..." : <FiCheck aria-hidden="true" />}
            </button>
          )}
          {step === 6 && (
            <button className="button" type="button" onClick={onClose}>
              Ir para campanha
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
