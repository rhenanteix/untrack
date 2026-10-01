"use client";
import { GuestAccessNotice } from "@/components/guest-access-notice";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { analytics } from "@/lib/client/analytics";

const fields = [
  ["source", "Campaign Source", "google"],
  ["medium", "Campaign Medium", "cpc"],
  ["campaign", "Campaign Name", "black-friday"],
  ["term", "Campaign Term", "tênis masculino"],
  ["content", "Campaign Content", "banner-principal"],
] as const;

export function UtmBuilder() {
  const [values, setValues] = useState<Record<string, string>>({
    url: "",
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
  });
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult("");
    setLoading(true);
    try {
      const response = await fetch("/api/utm/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Revise os campos e tente novamente.");
      }
      setResult(data.url);
      analytics.track("utm_generated");
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Falha de conexão. Tente novamente."
          : cause instanceof Error
            ? cause.message
            : "Não conseguimos criar a UTM.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tool-stack">
      <form className="tool-card form-grid" onSubmit={submit}>
        <label className="full-field">
          <span>URL de destino</span>
          <input
            type="url"
            required
            placeholder="https://exemplo.com/produto"
            value={values.url}
            onChange={(e) => setValues({ ...values, url: e.target.value })}
          />
        </label>
        {fields.map(([name, label, placeholder]) => (
          <label key={name}>
            <span>
              {label}
              {(["source", "medium", "campaign"] as string[]).includes(name)
                ? " *"
                : ""}
            </span>
            <input
              required={(["source", "medium", "campaign"] as string[]).includes(
                name,
              )}
              placeholder={placeholder}
              value={values[name]}
              onChange={(e) => setValues({ ...values, [name]: e.target.value })}
            />
          </label>
        ))}
        <button className="button full-field" type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar URL com UTM"}
        </button>
        <GuestAccessNotice error={error} />
        {error && (
          <p className="form-error full-field" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && (
        <section className="result-card" aria-live="polite">
          <span className="success-badge">✓ UTM criada</span>
          <h2>Sua campanha está pronta.</h2>
          <div className="clean-url">
            <code>{result}</code>
          </div>
          <div className="action-row">
            <CopyButton value={result} />
            <a
              className="button button-secondary"
              href={result}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.track("link_opened")}
            >
              Abrir
            </a>
            <Link
              className="button button-secondary"
              href={`/gerar-qrcode?url=${encodeURIComponent(result)}`}
            >
              Gerar QR Code
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
