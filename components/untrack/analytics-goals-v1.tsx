"use client";

import { startTransition, useEffect, useState } from "react";
import { FiArchive, FiPause, FiPlay, FiPlus, FiStar } from "react-icons/fi";
import { apiRequest } from "./shared";

type GoalType =
  | "LINK_CLICK"
  | "WHATSAPP_CLICK"
  | "FORM_SUBMIT"
  | "LEAD_CREATED"
  | "QR_SCAN"
  | "PAGE_VIEW"
  | "BUTTON_CLICK";

type AssetType = "smart_page" | "smart_card" | "link" | "qr_code";

type Goal = {
  id: string;
  name: string;
  description: string | null;
  goalType: GoalType;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  scopeType: "WORKSPACE" | "CAMPAIGN" | "ASSET" | "ELEMENT";
  scopeId: string | null;
  conditions: { assetType?: AssetType };
  scopeName: string;
  isPrimary: boolean;
  conversions: number;
  uniqueVisitors: number;
  conversionRate: number;
};

type ScopeOption = { id: string; name: string };
type ScopeOptions = Record<AssetType | "campaign", ScopeOption[]>;

const goalTypes: Array<{
  type: GoalType;
  label: string;
  detail: string;
  assetTypes: AssetType[];
}> = [
  {
    type: "LINK_CLICK",
    label: "Clique em link",
    detail: "Quando alguém abre um link",
    assetTypes: ["smart_page", "smart_card", "link", "qr_code"],
  },
  {
    type: "WHATSAPP_CLICK",
    label: "WhatsApp",
    detail: "Quando alguém toca no WhatsApp",
    assetTypes: ["smart_page", "smart_card", "link"],
  },
  {
    type: "FORM_SUBMIT",
    label: "Formulário",
    detail: "Quando um formulário é enviado",
    assetTypes: ["smart_page", "smart_card"],
  },
  {
    type: "LEAD_CREATED",
    label: "Lead",
    detail: "Quando um lead é capturado",
    assetTypes: ["smart_page", "smart_card"],
  },
  {
    type: "QR_SCAN",
    label: "QR Code",
    detail: "Quando um QR Code é escaneado",
    assetTypes: ["qr_code"],
  },
  {
    type: "PAGE_VIEW",
    label: "Visita",
    detail: "Quando uma página recebe uma visita",
    assetTypes: ["smart_page"],
  },
  {
    type: "BUTTON_CLICK",
    label: "Botão",
    detail: "Quando alguém clica em um botão",
    assetTypes: ["smart_page", "smart_card"],
  },
];

const assetLabels: Record<AssetType | "campaign", string> = {
  smart_page: "Smart Page",
  smart_card: "Smart Card",
  link: "Link",
  qr_code: "QR Code",
  campaign: "Campanha",
};

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function scopeLabel(goal: Goal) {
  return goal.scopeName;
}

export function AnalyticsGoalsV1() {
  const [items, setItems] = useState<Goal[]>([]);
  const [options, setOptions] = useState<ScopeOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [scopeType, setScopeType] = useState<
    "WORKSPACE" | "CAMPAIGN" | "ASSET"
  >("WORKSPACE");
  const [assetType, setAssetType] = useState<AssetType>("smart_page");
  const [scopeId, setScopeId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [goals, scopeOptions] = await Promise.all([
      apiRequest<Goal[]>("/api/workspace/analytics/goals"),
      apiRequest<ScopeOptions>("/api/workspace/analytics/goals?view=options"),
    ]);
    setItems(goals);
    setOptions(scopeOptions);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<Goal[]>("/api/workspace/analytics/goals"),
      apiRequest<ScopeOptions>("/api/workspace/analytics/goals?view=options"),
    ])
      .then(([goals, scopeOptions]) => {
        if (!active) return;
        setItems(goals);
        setOptions(scopeOptions);
      })
      .catch((loadError: Error) => {
        if (active)
          setError(loadError.message || "Não foi possível carregar objetivos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedType = goalTypes.find((item) => item.type === goalType);
  const selectedOptions =
    options?.[scopeType === "CAMPAIGN" ? "campaign" : assetType] ?? [];

  function begin() {
    setOpen(true);
    setStep(1);
    setGoalType(null);
    setScopeType("WORKSPACE");
    setAssetType("smart_page");
    setScopeId("");
    setName("");
    setDescription("");
    setIsPrimary(false);
    setError("");
  }

  function chooseGoal(type: GoalType) {
    const definition = goalTypes.find((item) => item.type === type)!;
    startTransition(() => {
      setGoalType(type);
      setName(definition.label);
      setAssetType(definition.assetTypes[0]);
      setScopeId("");
      setStep(2);
    });
  }

  function chooseSuggestedGoal(type: GoalType) {
    begin();
    chooseGoal(type);
  }

  function chooseScope(
    nextScope: "WORKSPACE" | "CAMPAIGN" | "ASSET",
    nextAssetType = assetType,
  ) {
    startTransition(() => {
      setScopeType(nextScope);
      setAssetType(nextAssetType);
      setScopeId("");
    });
  }

  async function createGoal() {
    if (!goalType) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/workspace/analytics/goals", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          goalType,
          scopeType,
          scopeId: scopeType === "WORKSPACE" ? undefined : scopeId,
          conditions: scopeType === "ASSET" ? { assetType } : {},
          isPrimary,
        }),
      });
      setOpen(false);
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar objetivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateGoal(id: string, update: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/workspace/analytics/goals", {
        method: "PATCH",
        body: JSON.stringify({ id, ...update }),
      });
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível atualizar objetivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function archiveGoal(id: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/workspace/analytics/goals", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await load();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Não foi possível arquivar objetivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-page analytics-goals-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Conversões</span>
          <h1>Objetivos</h1>
          <p>Defina quais ações representam resultados para você.</p>
        </div>
        <button className="button" type="button" onClick={begin}>
          <FiPlus aria-hidden="true" /> Criar objetivo
        </button>
      </header>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {open && (
        <section className="workspace-panel analytics-goal-wizard">
          <div className="workspace-panel-heading">
            <div>
              <h2>
                {
                  [
                    "O que você quer medir?",
                    "Onde isso acontece?",
                    "Dê um nome ao objetivo",
                    "Revise o objetivo",
                  ][step - 1]
                }
              </h2>
              <p>Passo {step} de 4</p>
            </div>
          </div>

          {step === 1 && (
            <div className="analytics-goal-choices">
              {goalTypes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="analytics-goal-choice"
                  onClick={() => chooseGoal(item.type)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && selectedType && (
            <div className="analytics-goal-step">
              <div className="analytics-goal-choices analytics-goal-scopes">
                <button
                  type="button"
                  className="analytics-goal-choice"
                  aria-pressed={scopeType === "WORKSPACE"}
                  onClick={() => chooseScope("WORKSPACE")}
                >
                  <strong>Todos os ativos</strong>
                  <span>Qualquer ocorrência compatível</span>
                </button>
                <button
                  type="button"
                  className="analytics-goal-choice"
                  aria-pressed={scopeType === "CAMPAIGN"}
                  onClick={() => chooseScope("CAMPAIGN")}
                >
                  <strong>Campanha específica</strong>
                  <span>Somente uma campanha</span>
                </button>
                {selectedType.assetTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="analytics-goal-choice"
                    aria-pressed={scopeType === "ASSET" && assetType === type}
                    onClick={() => chooseScope("ASSET", type)}
                  >
                    <strong>{assetLabels[type]} específica</strong>
                    <span>Somente um ativo</span>
                  </button>
                ))}
              </div>
              {scopeType !== "WORKSPACE" && (
                <label className="analytics-goal-select">
                  {scopeType === "CAMPAIGN"
                    ? "Campanha"
                    : assetLabels[assetType]}
                  <select
                    value={scopeId}
                    onChange={(event) => setScopeId(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {selectedOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="analytics-goal-wizard-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={scopeType !== "WORKSPACE" && !scopeId}
                  onClick={() => setStep(3)}
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 3 && selectedType && (
            <div className="analytics-goal-step">
              <label className="analytics-goal-select">
                Nome
                <input
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="analytics-goal-select">
                Descrição opcional
                <input
                  value={description}
                  maxLength={500}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="analytics-goal-checkbox">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                />{" "}
                Objetivo principal deste escopo
              </label>
              <div className="analytics-goal-wizard-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  Voltar
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={!name.trim()}
                  onClick={() => setStep(4)}
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {step === 4 && selectedType && (
            <div className="analytics-goal-step">
              <p className="analytics-goal-summary">
                Quando alguém realizar{" "}
                <strong>{selectedType.label.toLowerCase()}</strong>
                {scopeType === "WORKSPACE"
                  ? " em qualquer ativo compatível"
                  : ` em ${scopeType === "CAMPAIGN" ? "uma campanha selecionada" : `uma ${assetLabels[assetType]} selecionada`}`}
                , será registrada uma conversão para <strong>{name}</strong>.
              </p>
              <div className="analytics-goal-wizard-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setStep(3)}
                >
                  Voltar
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={busy}
                  onClick={createGoal}
                >
                  {busy ? "Criando..." : "Criar objetivo"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <p role="status" className="analytics-muted">
          Carregando objetivos...
        </p>
      ) : items.length ? (
        <section className="workspace-panel analytics-table-panel">
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Tipo</th>
                  <th>Aplicado em</th>
                  <th>Conversões</th>
                  <th>Taxa</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((goal) => (
                  <tr key={goal.id}>
                    <td>
                      <strong>{goal.name}</strong>
                      {goal.description && <small>{goal.description}</small>}
                    </td>
                    <td>
                      {goalTypes.find((item) => item.type === goal.goalType)
                        ?.label ?? goal.goalType}
                    </td>
                    <td>{scopeLabel(goal)}</td>
                    <td>{goal.conversions.toLocaleString("pt-BR")}</td>
                    <td
                      title={`${goal.conversions} conversões por ${goal.uniqueVisitors} visitantes únicos`}
                    >
                      {percent(goal.conversionRate)}
                    </td>
                    <td>
                      <span
                        className={`analytics-goal-status analytics-goal-status-${goal.status.toLowerCase()}`}
                      >
                        {goal.status === "ACTIVE"
                          ? "Ativo"
                          : goal.status === "PAUSED"
                            ? "Pausado"
                            : "Arquivado"}
                      </span>
                    </td>
                    <td>
                      <div className="analytics-goal-actions">
                        {goal.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            className="analytics-icon-button analytics-primary-button"
                            title={
                              goal.isPrimary
                                ? "Remover como objetivo principal"
                                : "Definir como objetivo principal"
                            }
                            onClick={() =>
                              updateGoal(goal.id, {
                                isPrimary: !goal.isPrimary,
                              })
                            }
                            disabled={busy}
                          >
                            <FiStar aria-hidden="true" />
                          </button>
                        )}
                        {goal.status === "ACTIVE" && (
                          <button
                            type="button"
                            className="analytics-icon-button"
                            title="Pausar objetivo"
                            onClick={() =>
                              updateGoal(goal.id, { status: "PAUSED" })
                            }
                            disabled={busy}
                          >
                            <FiPause aria-hidden="true" />
                          </button>
                        )}
                        {goal.status === "PAUSED" && (
                          <button
                            type="button"
                            className="analytics-icon-button"
                            title="Reativar objetivo"
                            onClick={() =>
                              updateGoal(goal.id, { status: "ACTIVE" })
                            }
                            disabled={busy}
                          >
                            <FiPlay aria-hidden="true" />
                          </button>
                        )}
                        {goal.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            className="analytics-icon-button"
                            title="Arquivar objetivo"
                            onClick={() => archiveGoal(goal.id)}
                            disabled={busy}
                          >
                            <FiArchive aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="workspace-empty-state">
          <h2>Você ainda não definiu nenhum objetivo.</h2>
          <p>Escolha quais ações representam resultados para você.</p>
          <div
            className="analytics-goal-suggestions"
            aria-label="Sugestões de objetivos"
          >
            {(
              [
                "WHATSAPP_CLICK",
                "LEAD_CREATED",
                "FORM_SUBMIT",
                "LINK_CLICK",
              ] as GoalType[]
            ).map((type) => (
              <button
                key={type}
                type="button"
                className="analytics-goal-suggestion"
                onClick={() => chooseSuggestedGoal(type)}
              >
                {goalTypes.find((item) => item.type === type)?.label}
              </button>
            ))}
          </div>
          <div className="workspace-empty-actions">
            <button className="button" type="button" onClick={begin}>
              <FiPlus aria-hidden="true" /> Criar primeiro objetivo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
