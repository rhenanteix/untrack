"use client";
import {
  GuestAccessNotice,
  GuestSignupPrompt,
} from "@/components/guest-access-notice";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { analytics } from "@/lib/client/analytics";
import { ToolCrossSell } from "@/components/tool-cross-sell";

const fields = [
  ["source", "Origem (utm_source)", "google"],
  ["medium", "Meio (utm_medium)", "cpc"],
  ["campaign", "Campanha (utm_campaign)", "black-friday"],
  ["term", "Termo (utm_term)", "tênis masculino"],
  ["content", "Conteúdo (utm_content)", "banner-principal"],
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
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

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
      if (response.headers.get("X-Untrack-Anonymous-Use") === "consumed") {
        analytics.track("anonymous_usage_consumed");
        analytics.track("free_tool_completed");
        setShowSignupPrompt(true);
      }
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
      <GuestSignupPrompt
        open={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
      />
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
        {fields.slice(0, 3).map(([name, label, placeholder]) => (
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
        <details className="full-field utm-advanced">
          <summary>Parâmetros opcionais</summary>
          <p className="muted">
            Identifique palavras-chave e variações de conteúdo quando precisar
            comparar anúncios.
          </p>
          <div className="form-grid">
            {fields.slice(3).map(([name, label, placeholder]) => (
              <label key={name}>
                <span>
                  {label}
                  {(["source", "medium", "campaign"] as string[]).includes(name)
                    ? " *"
                    : ""}
                </span>
                <input
                  required={(
                    ["source", "medium", "campaign"] as string[]
                  ).includes(name)}
                  placeholder={placeholder}
                  value={values[name]}
                  onChange={(e) =>
                    setValues({ ...values, [name]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </details>
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
          <ToolCrossSell
            product="utm-builder"
            title="Quer organizar esta URL dentro de uma campanha?"
            description="Crie uma campanha para reunir canais, links e resultados no mesmo lugar."
            label="Criar campanha"
            href="/cadastro?next=/untrack/campaigns"
          />
        </section>
      )}
    </div>
  );
}
