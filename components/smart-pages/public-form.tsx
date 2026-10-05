"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { analytics } from "@/lib/client/analytics";
import styles from "./themes.module.css";

export type PublicSmartPageFormData = {
  id: string;
  name: string;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  privacyPolicyUrl: string | null;
  status: "active" | "inactive";
  fields: Array<{
    id: string;
    fieldType: string;
    label: string;
    placeholder: string | null;
    required: boolean;
    options: unknown;
  }>;
};

type FormValue = string | boolean;

function inputType(fieldType: string) {
  if (fieldType === "email") return "email";
  if (fieldType === "phone") return "tel";
  return "text";
}

function options(value: unknown) {
  return Array.isArray(value)
    ? value.filter((option): option is string => typeof option === "string")
    : [];
}

function stringValue(value: FormValue | undefined) {
  return typeof value === "string" ? value : "";
}

function hasFormViewInSession(key: string) {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markFormViewInSession(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
}

function frontendErrors(
  form: PublicSmartPageFormData,
  values: Record<string, FormValue>,
) {
  const errors: Record<string, string> = {};
  for (const field of form.fields) {
    const value = values[field.id];
    if (
      field.required &&
      (value === undefined || value === "" || value === false)
    )
      errors[field.id] = "Este campo é obrigatório.";
    if (typeof value === "string" && value) {
      if (field.fieldType === "email" && !/^\S+@\S+\.\S+$/.test(value))
        errors[field.id] = "Informe um e-mail válido.";
      if (field.fieldType === "phone" && !/^\+?[0-9 ()-]{7,24}$/.test(value))
        errors[field.id] = "Informe um telefone válido.";
    }
  }
  return errors;
}

export function SmartPageForm({
  slug,
  blockId,
  form,
  preview = false,
}: {
  slug: string;
  blockId: string;
  form: PublicSmartPageFormData;
  preview?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => {
    if (
      preview ||
      !formRef.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const viewKey = `linkor:form-view:${slug}:${blockId}`;
    if (hasFormViewInSession(viewKey)) return;
    let tracked = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (tracked || !entry?.isIntersecting) return;
        tracked = true;
        observer.disconnect();
        markFormViewInSession(viewKey);
        void analytics.trackSmartPage("form_view", slug, blockId);
      },
      { threshold: 0.5 },
    );
    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, [blockId, preview, slug]);

  function changeValue(fieldId: string, value: FormValue) {
    setValues((current) => ({ ...current, [fieldId]: value }));
    setErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || submitting) return;
    const nextErrors = frontendErrors(form, values);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSubmitting(true);
    setFailure("");
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(
        `/api/smart-pages/public/${encodeURIComponent(slug)}/forms/${encodeURIComponent(form.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            values,
            honeypot,
            idempotencyKey: idempotencyKey.current,
            ...analytics.publicContext(),
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setFailure(
          payload?.error ?? "Não foi possível enviar agora. Tente novamente.",
        );
        return;
      }
      setSubmitted(true);
      idempotencyKey.current = null;
    } catch {
      setFailure("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted)
    return (
      <section className={styles.publicForm} aria-live="polite">
        <p className={styles.publicFormSuccess}>{form.successMessage}</p>
      </section>
    );

  return (
    <form
      ref={formRef}
      className={styles.publicForm}
      onSubmit={submit}
      noValidate
    >
      <div className={styles.publicFormHeading}>
        <h2>{form.title}</h2>
        {form.description && <p>{form.description}</p>}
      </div>
      <div className={styles.publicFormFields}>
        {form.fields.map((field) => {
          const error = errors[field.id];
          const describedBy = error ? `${field.id}-error` : undefined;
          if (field.fieldType === "consent" || field.fieldType === "checkbox")
            return (
              <label key={field.id} className={styles.publicFormCheck}>
                <input
                  type="checkbox"
                  checked={values[field.id] === true}
                  required={field.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    changeValue(field.id, event.target.checked)
                  }
                />
                <span>{field.label}</span>
                {error && <small id={describedBy}>{error}</small>}
              </label>
            );
          if (field.fieldType === "select")
            return (
              <label key={field.id} className={styles.publicFormField}>
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                <select
                  value={stringValue(values[field.id])}
                  required={field.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    changeValue(field.id, event.target.value)
                  }
                >
                  <option value="">Selecione uma opção</option>
                  {options(field.options).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {error && <small id={describedBy}>{error}</small>}
              </label>
            );
          return (
            <label key={field.id} className={styles.publicFormField}>
              <span>
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.fieldType === "message" ||
              field.fieldType === "textarea" ? (
                <textarea
                  value={stringValue(values[field.id])}
                  placeholder={field.placeholder ?? undefined}
                  required={field.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  rows={4}
                  onChange={(event) =>
                    changeValue(field.id, event.target.value)
                  }
                />
              ) : (
                <input
                  type={inputType(field.fieldType)}
                  inputMode={field.fieldType === "phone" ? "tel" : undefined}
                  autoComplete={
                    field.fieldType === "name"
                      ? "name"
                      : field.fieldType === "email"
                        ? "email"
                        : field.fieldType === "phone"
                          ? "tel"
                          : field.fieldType === "company"
                            ? "organization"
                            : field.fieldType === "job_title"
                              ? "organization-title"
                              : undefined
                  }
                  value={stringValue(values[field.id])}
                  placeholder={field.placeholder ?? undefined}
                  required={field.required}
                  aria-invalid={Boolean(error)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    changeValue(field.id, event.target.value)
                  }
                />
              )}
              {error && <small id={describedBy}>{error}</small>}
            </label>
          );
        })}
      </div>
      <label className={styles.publicFormHoneypot} aria-hidden="true">
        Site
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </label>
      {failure && (
        <p className={styles.publicFormFailure} role="alert">
          {failure}
        </p>
      )}
      <button type={preview ? "button" : "submit"} disabled={submitting}>
        {submitting ? "Enviando..." : form.submitLabel}
      </button>
      {form.privacyPolicyUrl && (
        <a
          className={styles.publicFormPrivacy}
          href={form.privacyPolicyUrl}
          target="_blank"
          rel="noreferrer"
        >
          Política de Privacidade
        </a>
      )}
    </form>
  );
}
