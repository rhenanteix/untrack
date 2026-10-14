"use client";

import { useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiSend, FiX } from "react-icons/fi";
import { ActionStatus, apiRequest, useAction } from "./shared";
import { analytics } from "@/lib/client/analytics";

type Charge = {
  id: string;
  description: string;
  amountInCents: number;
  currency: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  expiredAt: string | null;
  refundedAt: string | null;
  paidAt: string | null;
  customer: { id: string; firstName: string; lastName: string; email: string | null } | null;
  offer: { id: string; name: string; amount: number } | null;
};

type Offer = { id: string; name: string; amount: number };

type ChargesList = {
  items: Charge[];
  page: number;
  hasMore: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  paid: "Pago",
  expired: "Vencido",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "status-draft",
  pending: "status-pending",
  paid: "status-paid",
  expired: "status-expired",
  cancelled: "status-cancelled",
  refunded: "status-refunded",
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

export function PayDashboard({
  canEdit,
  initial,
  offers,
}: {
  canEdit: boolean;
  initial: ChargesList;
  offers: Offer[];
}) {
  const action = useAction();
  const [charges, setCharges] = useState<Charge[]>(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    description?: string;
    amountInCents?: string;
    dueAt?: string;
  }>({});
  const [showNewForm, setShowNewForm] = useState(false);
  const [newData, setNewData] = useState({
    description: "",
    amountInCents: "",
    currency: "BRL",
    offerId: "",
    dueAt: "",
    customerId: "",
  });

  const loadPage = (targetPage: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(targetPage));
    window.location.search = url.searchParams.toString();
  };

  function refresh() {
    setPage(0);
    void reloadCharges();
  }

  async function reloadCharges() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", "1");
      const result = await apiRequest<ChargesList>("/api/charges?" + url.searchParams.toString());
      setCharges(result.items);
      setPage(result.page);
      setHasMore(result.hasMore);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar.");
    }
  }

  function startEdit(charge: Charge) {
    setEditingId(charge.id);
    setEditData({
      description: charge.description,
      amountInCents: String(charge.amountInCents),
      dueAt: charge.dueAt ? new Date(charge.dueAt).toISOString().slice(0, 16) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function saveEdit() {
    if (!editingId) return;
    const amount = parseInt(editData.amountInCents as unknown as string, 10);
    const body = {
      description: editData.description,
      ...(amount > 0 ? { amountInCents: amount } : {}),
      ...(editData.dueAt ? { dueAt: new Date(editData.dueAt) } : {}),
    };
    try {
      await apiRequest(`/api/charges/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setCharges((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                description: body.description ?? c.description,
                amountInCents: body.amountInCents ?? c.amountInCents,
                ...(body.dueAt ? { dueAt: (body.dueAt as Date).toISOString() } : {}),
              }
            : c,
        ),
      );
      setEditingId(null);
      setEditData({});
      action.setNotice("Cobrança atualizada.");
    } catch {
      // Error handled by apiRequest throw
    }
  }

  async function submitNew(event: React.FormEvent) {
    event.preventDefault();
    const amount = parseInt(newData.amountInCents, 10);
    if (isNaN(amount) || amount < 0) return;
    const body = {
      description: newData.description,
      amountInCents: amount,
      currency: newData.currency,
      ...(newData.offerId ? { offerId: newData.offerId } : {}),
      ...(newData.dueAt ? { dueAt: new Date(newData.dueAt) } : {}),
    };
    try {
      await apiRequest("/api/charges", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setShowNewForm(false);
      setNewData({
        description: "",
        amountInCents: "",
        currency: "BRL",
        offerId: "",
        dueAt: "",
        customerId: "",
      });
      void reloadCharges();
      action.setNotice("Cobrança criada.");
      analytics.track("charge_created");
    } catch {
      // Error handled by apiRequest throw
    }
  }

  async function cancelCharge(charge: Charge) {
    if (!confirm("Cancelar esta cobrança?")) return;
    try {
      await apiRequest(`/api/charges/${charge.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "" }),
      });
      setCharges((prev) =>
        prev.map((c) =>
          c.id === charge.id
            ? { ...c, status: "cancelled", cancelledAt: new Date().toISOString() }
            : c,
        ),
      );
      action.setNotice("Cobrança cancelada.");
    } catch {
      // Error handled by apiRequest throw
    }
  }

  async function activateCharge(charge: Charge) {
    try {
      await apiRequest(`/api/charges/${charge.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "pending" }),
      });
      setCharges((prev) =>
        prev.map((c) => (c.id === charge.id ? { ...c, status: "pending" } : c)),
      );
      action.setNotice("Cobrança ativada e agora está pendente.");
    } catch {
      // Error handled by apiRequest throw
    }
  }

  const cancelableStatuses = new Set(["draft", "pending"]);

  return (
    <section className="workspace-page pay-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">LinkOr Pay</span>
          <h1>Cobranças</h1>
          <p>Gerencie cobranças recorrentes e avulsas da sua equipe.</p>
        </div>
        {canEdit && (
          <button
            className="button"
            onClick={() => setShowNewForm(!showNewForm)}
          >
            <FiPlus aria-hidden="true" /> Nova cobrança
          </button>
        )}
      </header>

      {showNewForm && canEdit && (
        <form
          className="workspace-panel pay-create-form"
          onSubmit={submitNew}
        >
          <div className="form-grid">
            <label>
              Descrição
              <input
                required
                maxLength={500}
                value={newData.description}
                onChange={(e) =>
                  setNewData({ ...newData, description: e.target.value })
                }
                placeholder="Descrição da cobrança"
              />
            </label>
            <label>
              Valor (centavos)
              <input
                required
                type="number"
                min={0}
                value={newData.amountInCents}
                onChange={(e) =>
                  setNewData({ ...newData, amountInCents: e.target.value })
                }
                placeholder="1500"
              />
            </label>
            <label>
              Oferta (opcional)
              <select
                value={newData.offerId}
                onChange={(e) =>
                  setNewData({ ...newData, offerId: e.target.value })
                }
              >
                <option value="">Nenhuma</option>
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.name} ({formatCurrency(offer.amount, "BRL")})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vencimento (opcional)
              <input
                type="datetime-local"
                value={newData.dueAt}
                onChange={(e) =>
                  setNewData({ ...newData, dueAt: e.target.value })
                }
              />
            </label>
          </div>
          <div className="action-row">
            <button
              type="submit"
              className="button"
              disabled={action.busy}
            >
              Criar
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setShowNewForm(false)}
            >
              <FiX aria-hidden="true" /> Cancelar
            </button>
          </div>
        </form>
      )}

      <ActionStatus {...action} />

      {error && (
        <section className="workspace-panel" role="alert">
          <p>{error}</p>
          <button className="button button-secondary" onClick={refresh}>
            Tentar novamente
          </button>
        </section>
      )}

      {!error && !charges.length && (
        <section className="workspace-panel pay-empty">
          <h2>Nenhuma cobrança ainda</h2>
          <p>Crie uma cobrança para começar a cobrar sua equipe.</p>
        </section>
      )}

      {!!charges.length && (
        <div className="pay-list">
          {charges.map((charge) => (
            <article className="pay-card" key={charge.id}>
              <div className="pay-card-header">
                <span
                  className={`pay-status-badge ${STATUS_COLORS[charge.status]}`}
                  aria-label={STATUS_LABELS[charge.status]}
                >
                  {STATUS_LABELS[charge.status]}
                </span>
                <strong className="pay-amount">
                  {formatCurrency(charge.amountInCents, charge.currency)}
                </strong>
              </div>

              {editingId === charge.id ? (
                <div className="pay-edit-form">
                  <label>
                    Descrição
                    <input
                      maxLength={500}
                      value={editData.description ?? ""}
                      onChange={(e) =>
                        setEditData({ ...editData, description: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Valor (centavos)
                    <input
                      type="number"
                      min="0"
                      value={editData.amountInCents ?? ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          amountInCents: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Vencimento
                    <input
                      type="datetime-local"
                      value={
                        (editData.dueAt as string | undefined) ?? ""
                      }
                      onChange={(e) =>
                        setEditData({ ...editData, dueAt: e.target.value })
                      }
                    />
                  </label>
                  <div className="action-row">
                    <button
                      className="button"
                      onClick={saveEdit}
                      disabled={action.busy}
                    >
                      Salvar
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="pay-description">{charge.description}</p>
                  <div className="pay-meta">
                    <span>Criada em {formatDate(charge.createdAt)}</span>
                    {charge.dueAt && (
                      <span>Vence em {formatDate(charge.dueAt)}</span>
                    )}
                    {charge.customer && (
                      <span>
                        Cliente: {charge.customer.firstName}{" "}
                        {charge.customer.lastName}
                      </span>
                    )}
                    {charge.offer && (
                      <span>Oferta: {charge.offer.name}</span>
                    )}
                  </div>

                  {charge.status === "draft" && canEdit && (
                    <div className="pay-actions">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => startEdit(charge)}
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Ativar cobrança"
                        onClick={() => void activateCharge(charge)}
                      >
                        <FiSend aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        title="Cancelar"
                        onClick={() => void cancelCharge(charge)}
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {cancelableStatuses.has(charge.status) &&
                    charge.status !== "draft" &&
                    canEdit && (
                      <div className="pay-actions">
                        <button
                          type="button"
                          title="Cancelar"
                          onClick={() => void cancelCharge(charge)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      </div>
                    )}
                </>
              )}
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="action-row">
          <button
            className="button button-secondary"
            onClick={() => loadPage(page + 1)}
          >
            Próxima página
          </button>
        </div>
      )}
    </section>
  );
}
