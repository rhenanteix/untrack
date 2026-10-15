"use client";

import { FiCopy, FiDownload, FiShare2 } from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";

type Charge = {
  id: string;
  description: string;
  amountInCents: number;
  currency: string;
  status: string;
  dueAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  refundedAt: Date | null;
  paidAt: Date | null;
  shareToken: string | null;
  customer: { firstName: string; lastName: string; email: string | null } | null;
  offer: { name: string; amount: number } | null;
  workspace: { name: string; notifications: unknown };
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Em rascunho",
  pending: "Pendente",
  paid: "Pago",
  expired: "Vencido",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("pt-BR");
}

export function PublicChargePage({
  charge,
  message,
}: {
  charge?: Charge;
  message?: string;
}) {
  if (!charge)
    return (
      <section className="pay-public pay-public-error">
        <h1>{message}</h1>
        <p>Não foi possível localizar esta cobrança.</p>
      </section>
    );

  const { id, description, amountInCents, currency, status, dueAt, offer, workspace } = charge;
  const isPaid = status === "paid";
  const isCancelled = status === "cancelled";
  const isExpired = status === "expired" || status === "refunded";
  const paymentUnavailable = isCancelled || isExpired;

  async function shareWhatsApp() {
    const url = window.location.href;
    const text = encodeURIComponent(
      `Olá! Sege o link para consultar sua cobrança de ${formatCurrency(amountInCents, currency)} referente a ${description}.`,
    );
    const shareUrl = `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
    analytics.track("payment_link_shared");
  }

  async function copyLink() {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    analytics.track("payment_link_shared");
  }

  async function downloadQr() {
    const url = window.location.href;
    const response = await fetch("/api/qr/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format: "dataUrl" }),
    });
    const { dataUrl } = (await response.json()) as { dataUrl: string };
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `cobranca-${id.slice(-6)}.png`;
    link.click();
  }

  return (
    <section className="pay-public">
      <div className="pay-public-card">
          <header className="pay-public-header">
          <span className="eyebrow">LinkOr Pay</span>
          <h1>{workspace.name}</h1>
        </header>

        <div className="pay-public-body">
          <p className="pay-public-description">{description}</p>
          <strong className="pay-public-amount">
            {formatCurrency(amountInCents, currency)}
          </strong>

          {dueAt && (
            <p className="pay-public-due">Vence em {formatDate(dueAt)}</p>
          )}

          <span
            className={`pay-public-status badge-${status}`}
            aria-label={STATUS_LABEL[status]}
          >
            {STATUS_LABEL[status]}
          </span>

          {offer && (
            <p className="pay-public-offer">Oferta: {offer.name}</p>
          )}
        </div>

        <footer className="pay-public-footer">
          {paymentUnavailable ? (
            <p className="pay-unavailable">
              Esta cobrança não está disponível para pagamento.
            </p>
          ) : isPaid ? (
            <p className="pay-paid">Pagamento recebido.</p>
          ) : (
            <button className="button pay-checkout-button" disabled>
              Pagar agora
            </button>
          )}
          <p className="pay-checkout-note">
            Pagamento processado apenas quando um provedor estiver conectado.
          </p>

          <div className="pay-public-actions">
            <button
              className="button button-secondary button-small"
              onClick={copyLink}
            >
              <FiCopy aria-hidden="true" /> Copiar link
            </button>
            <button
              className="button button-secondary button-small"
              onClick={downloadQr}
            >
              <FiDownload aria-hidden="true" /> Baixar QR Code
            </button>
            <button
              className="button button-secondary button-small"
              onClick={shareWhatsApp}
            >
              <FiShare2 aria-hidden="true" /> Compartilhar WhatsApp
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}
