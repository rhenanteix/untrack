"use client";

import { useEffect, useState } from "react";
import { analytics } from "@/lib/client/analytics";
import styles from "./public-smart-card.module.css";

type CardAction = {
  id: string;
  type:
    | "website"
    | "whatsapp"
    | "email"
    | "phone"
    | "calendar"
    | "smartPage"
    | "custom";
  label: string;
  url: string;
};

type ContactField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "select";
  required: boolean;
  options: string[];
};

type PublicSmartCardData = {
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
  privacyPolicyUrl: string | null;
  actions: CardAction[];
};

type ContactForm = {
  fields: ContactField[];
  intent: { enabled: boolean; label: string; options: string[] };
  primaryCta: "save_contact" | "share_contact" | "first_action";
};

function contactKey(slug: string) {
  return `untrack:smart-card-contact:${slug}`;
}

function savedContactId(slug: string) {
  try {
    return window.localStorage.getItem(contactKey(slug)) ?? undefined;
  } catch {
    return undefined;
  }
}

function persistContactId(slug: string, contactId: string) {
  try {
    window.localStorage.setItem(contactKey(slug), contactId);
  } catch {
    /* The public card remains usable when storage is unavailable. */
  }
}

function initials(card: PublicSmartCardData) {
  return `${card.firstName[0] ?? ""}${card.lastName[0] ?? ""}`.toUpperCase();
}

function actionEvent(action: CardAction) {
  if (action.type === "whatsapp") return "whatsapp_click";
  if (action.type === "calendar") return "booking_click";
  return "link_click";
}

type PublicCardEvent =
  | "card_view"
  | "card_share"
  | "qr_scan"
  | "nfc_open"
  | "contact_save"
  | "contact_form_open"
  | "link_click"
  | "whatsapp_click"
  | "booking_click";

function track(
  event: PublicCardEvent,
  slug: string,
  source: string,
  actionId?: string,
) {
  return analytics.trackSmartCard(
    event,
    slug,
    source,
    actionId,
    savedContactId(slug),
  );
}

export function PublicSmartCard({
  card,
  contactForm,
  theme,
  source,
}: {
  card: PublicSmartCardData;
  contactForm: ContactForm;
  theme: {
    preset: string;
    background?: string;
    backgroundSecondary?: string;
    textColor?: string;
    buttonColor?: string;
    buttonTextColor?: string;
    buttonRadius?: number;
    avatarShape?: "circle" | "rounded" | "square";
    font?: "sans" | "serif" | "mono";
  };
  source: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const displayName = `${card.firstName} ${card.lastName}`.trim();
  const firstAction = card.actions[0];
  const cardStyle = {
    "--card-background": theme.background ?? "#f7f8f1",
    "--card-background-secondary": theme.backgroundSecondary ?? "#dff0d5",
    "--card-ink": theme.textColor ?? "#17322c",
    "--card-action": theme.buttonColor ?? "#1f5a45",
    "--card-action-text": theme.buttonTextColor ?? "#ffffff",
    "--card-radius": `${theme.buttonRadius ?? 10}px`,
  } as React.CSSProperties;

  useEffect(() => {
    void track("card_view", card.slug, source);
    if (source === "qr") void track("qr_scan", card.slug, source);
  }, [card.slug, source]);

  function openContactForm() {
    setFormOpen(true);
    setFormError("");
    void track("contact_form_open", card.slug, source);
  }

  async function shareCard() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: displayName, text: card.headline, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      void track("card_share", card.slug, source);
    } catch {
      /* Cancelling the native dialog should not surface an error. */
    }
  }

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      contactForm.fields.map((field) => [
        field.key,
        String(formData.get(field.key) ?? ""),
      ]),
    );
    try {
      const response = await fetch(
        `/api/smart-cards/public/${encodeURIComponent(card.slug)}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values,
            intent: contactForm.intent.enabled
              ? String(formData.get("intent") ?? "")
              : undefined,
            source,
            visitorId: analytics.identity().visitorId ?? crypto.randomUUID(),
            consent: true,
          }),
        },
      );
      const payload = (await response.json()) as {
        contact?: { id: string };
        message?: string;
      };
      if (!response.ok || !payload.contact)
        throw new Error(
          payload.message ?? "Não foi possível compartilhar agora.",
        );
      persistContactId(card.slug, payload.contact.id);
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível compartilhar agora.",
      );
    } finally {
      setBusy(false);
    }
  }

  const primary =
    contactForm.primaryCta === "first_action" && firstAction
      ? { kind: "action" as const, action: firstAction }
      : contactForm.primaryCta === "save_contact"
        ? { kind: "save" as const }
        : { kind: "share" as const };

  return (
    <main
      className={`${styles.page} ${styles[`preset${theme.preset[0]?.toUpperCase() ?? "P"}${theme.preset.slice(1)}`] ?? ""}`}
      style={cardStyle}
      data-font={theme.font ?? "sans"}
    >
      <section className={styles.card} aria-label={`Cartão de ${displayName}`}>
        <div className={styles.topline}>
          {card.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.logo}
              src={card.logoUrl}
              alt={card.company || "Logo"}
            />
          ) : (
            <span className={styles.brand}>LinkOr</span>
          )}
          <button
            className={styles.share}
            type="button"
            onClick={shareCard}
            aria-label="Compartilhar cartão"
          >
            Compartilhar
          </button>
        </div>

        <div className={styles.identity}>
          {card.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.avatar}
              data-shape={theme.avatarShape ?? "circle"}
              src={card.avatarUrl}
              alt={displayName}
            />
          ) : (
            <span
              className={styles.avatarFallback}
              data-shape={theme.avatarShape ?? "circle"}
            >
              {initials(card)}
            </span>
          )}
          <div>
            <h1>{displayName}</h1>
            {(card.headline || card.company) && (
              <p className={styles.headline}>
                {[card.headline, card.company].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>

        {card.bio && <p className={styles.bio}>{card.bio}</p>}
        {card.location && <p className={styles.location}>{card.location}</p>}

        <div className={styles.primaryActions}>
          {primary.kind === "share" ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={openContactForm}
            >
              Compartilhar seus dados
            </button>
          ) : primary.kind === "save" ? (
            <a
              className={styles.primaryButton}
              href={`/c/${encodeURIComponent(card.slug)}/contact.vcf`}
              onClick={() => void track("contact_save", card.slug, source)}
            >
              Salvar meu contato
            </a>
          ) : (
            <a
              className={styles.primaryButton}
              href={primary.action.url}
              onClick={() =>
                void track(
                  actionEvent(primary.action),
                  card.slug,
                  source,
                  primary.action.id,
                )
              }
            >
              {primary.action.label}
            </a>
          )}
          <div className={styles.secondaryActions}>
            <a
              href={`/c/${encodeURIComponent(card.slug)}/contact.vcf`}
              onClick={() => void track("contact_save", card.slug, source)}
            >
              Salvar contato
            </a>
            <button type="button" onClick={openContactForm}>
              Trocar contatos
            </button>
          </div>
        </div>

        {card.actions.length > 0 && (
          <div className={styles.linkList}>
            {card.actions.map((action) => (
              <a
                key={action.id}
                href={action.url}
                onClick={() =>
                  void track(actionEvent(action), card.slug, source, action.id)
                }
              >
                <span>{action.label}</span>
                <span aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        )}

        <footer className={styles.footer}>Feito com LinkOr</footer>
      </section>

      {formOpen && (
        <div
          className={styles.sheetBackdrop}
          role="presentation"
          onMouseDown={() => setFormOpen(false)}
        >
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-exchange-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.sheetClose}
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Fechar"
            >
              Fechar
            </button>
            {submitted ? (
              <div className={styles.submitted}>
                <h2 id="contact-exchange-title">Dados compartilhados</h2>
                <p>{displayName} poderá entrar em contato com você.</p>
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => setFormOpen(false)}
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={submitContact} className={styles.contactForm}>
                <h2 id="contact-exchange-title">Compartilhe seus dados</h2>
                <p>{`Seus dados serão compartilhados com ${card.company || displayName} para que possa entrar em contato.`}</p>
                {contactForm.fields.map((field) => (
                  <label key={field.key}>
                    <span>
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    {field.type === "select" ? (
                      <select
                        name={field.key}
                        required={field.required}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {field.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={field.key}
                        type={field.type}
                        required={field.required}
                        autoComplete={
                          field.key === "email"
                            ? "email"
                            : field.key === "firstName"
                              ? "given-name"
                              : field.key === "lastName"
                                ? "family-name"
                                : field.type === "tel"
                                  ? "tel"
                                  : "off"
                        }
                      />
                    )}
                  </label>
                ))}
                {contactForm.intent.enabled && (
                  <label>
                    <span>{contactForm.intent.label}</span>
                    <select name="intent" defaultValue="">
                      <option value="">Selecione</option>
                      {contactForm.intent.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {card.privacyPolicyUrl && (
                  <a className={styles.privacy} href={card.privacyPolicyUrl}>
                    Política de privacidade
                  </a>
                )}
                {formError && (
                  <p className={styles.formError} role="alert">
                    {formError}
                  </p>
                )}
                <button
                  className={styles.primaryButton}
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Compartilhando..." : "Compartilhar contato"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
