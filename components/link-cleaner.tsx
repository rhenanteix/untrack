"use client";
import {
  GuestAccessNotice,
  GuestSignupPrompt,
} from "@/components/guest-access-notice";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { analytics } from "@/lib/client/analytics";
import {
  addHistory,
  HistoryItem,
  readHistory,
  removeHistory,
} from "@/lib/client/history";

interface Analysis {
  historySaved?: boolean;
  originalUrl: string;
  cleanUrl: string;
  statistics: {
    totalParameters: number;
    trackingParameters: number;
    preservedParameters: number;
    originalLength: number;
    cleanLength: number;
    charactersRemoved: number;
  };
  removedParameters: string[];
  preservedParameters: string[];
}

interface CheckResult {
  reachable: boolean;
  statusCode: number | null;
  responseTime: number;
  error?: string;
  code?: string;
}

const categoryOptions = [
  ["utm", "UTMs"],
  ["google", "Google tracking"],
  ["meta", "Meta tracking"],
  ["microsoft", "Microsoft tracking"],
  ["tiktok", "TikTok tracking"],
  ["twitter", "Twitter/X tracking"],
  ["mailchimp", "Mailchimp"],
  ["analytics", "Analytics"],
  ["generic", "Outros rastreadores"],
] as const;

type CategoryId = (typeof categoryOptions)[number][0];

export function LinkCleaner() {
  const [url, setUrl] = useState("");
  const [categories, setCategories] = useState(
    categoryOptions.map(([id]) => id),
  );
  const [result, setResult] = useState<Analysis | null>(null);
  const [status, setStatus] = useState<CheckResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHistory(readHistory()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus(null);
    setLoading(true);
    analytics.track("link_submitted");
    try {
      const response = await fetch("/api/links/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, categories }),
      });
      const data: Analysis | { error?: string } = await response.json();
      if (!response.ok || !("cleanUrl" in data)) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Esse link parece estar incompleto.",
        );
      }
      setResult(data);
      setHistory(
        addHistory({ originalUrl: data.originalUrl, cleanUrl: data.cleanUrl }),
      );
      analytics.track("link_analyzed");
      analytics.track("link_cleaned");
      if (response.headers.get("X-Untrack-Anonymous-Use") === "consumed") {
        analytics.track("anonymous_usage_consumed");
        analytics.track("free_tool_completed");
        setShowSignupPrompt(true);
      }
    } catch (cause) {
      setResult(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não conseguimos arrumar esse link agora. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkUrl() {
    if (!result) return;
    setChecking(true);
    setStatus(null);
    analytics.track("url_check_requested");
    try {
      const response = await fetch("/api/links/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.cleanUrl }),
      });
      const data: CheckResult = await response.json();

      // A rate limit (429) or an unavailable limiter (503) also answers with a
      // `reachable: false` body, so distinguish transport failures from a link
      // that genuinely could not be reached.
      if (!response.ok) {
        setStatus({
          reachable: false,
          statusCode: null,
          responseTime: data.responseTime ?? 0,
          error: data.error ?? "Não conseguimos verificar esse endereço agora.",
          code: data.code,
        });
        return;
      }

      setStatus(data);
      analytics.track("url_check_completed");
    } catch {
      setStatus({
        reachable: false,
        statusCode: null,
        responseTime: 0,
        error: "Não conseguimos acessar esse endereço.",
      });
    } finally {
      setChecking(false);
    }
  }

  function toggleCategory(id: CategoryId) {
    setCategories((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  return (
    <div className="tool-stack">
      <GuestSignupPrompt
        open={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
      />
      <form className="tool-card" onSubmit={submit} noValidate>
        <label className="input-label" htmlFor="url">
          Cole seu link aqui
        </label>
        <div className="input-row">
          <input
            id="url"
            name="url"
            type="url"
            inputMode="url"
            placeholder="https://exemplo.com/produto?utm_source=..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
            maxLength={4096}
            aria-describedby={error ? "url-error" : undefined}
          />
          <button className="button" disabled={loading} type="submit">
            {loading ? "Arrumando..." : "Arrumar meu link"}
          </button>
        </div>
        <fieldset className="category-fieldset">
          <legend>O que você quer remover?</legend>
          <div className="category-grid">
            {categoryOptions.map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={categories.includes(id)}
                  onChange={() => toggleCategory(id)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <GuestAccessNotice error={error} />
        {error && (
          <p className="form-error" id="url-error" role="alert">
            {error}
          </p>
        )}
        <p className="privacy-note">
          Sem conta, o histórico fica neste navegador. Ao entrar, seus
          resultados também são salvos na sua conta.
        </p>
      </form>

      {result && (
        <section
          className="result-card"
          aria-live="polite"
          aria-labelledby="resultado"
        >
          <div className="result-heading">
            <div>
              <span className="success-badge">✓ Pronto</span>
              <h2 id="resultado">Seu link está limpo.</h2>
            </div>
            <span className="saved-count">
              {result.statistics.charactersRemoved} caracteres removidos
            </span>
          </div>
          <div className="clean-url">
            <code>{result.cleanUrl}</code>
          </div>
          <div className="action-row">
            <CopyButton value={result.cleanUrl} />
            <a
              className="button button-secondary"
              href={result.cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.track("link_opened")}
            >
              Abrir
            </a>
            <Link
              className="button button-secondary"
              href={`/gerar-qrcode?url=${encodeURIComponent(result.cleanUrl)}`}
            >
              Gerar QR Code
            </Link>
            <Link
              className="button button-secondary"
              href={`/encurtar?url=${encodeURIComponent(result.cleanUrl)}`}
            >
              Encurtar e compartilhar
            </Link>
            <button
              className="button button-quiet"
              type="button"
              onClick={checkUrl}
              disabled={checking}
            >
              {checking ? "Verificando..." : "Verificar acesso"}
            </button>
          </div>
          {result.historySaved && (
            <p className="status-success">Salvo no histórico da sua conta.</p>
          )}
          {status && (
            <p
              className={status.reachable ? "status-success" : "status-warning"}
              role="status"
            >
              {status.reachable
                ? `✓ Link acessível · Status ${status.statusCode} · ${status.responseTime} ms`
                : `⚠ ${status.error ?? "Não conseguimos acessar esse endereço."}`}
            </p>
          )}
          <div className="stats-grid">
            <div>
              <strong>{result.statistics.totalParameters}</strong>
              <span>parâmetros encontrados</span>
            </div>
            <div>
              <strong>{result.statistics.trackingParameters}</strong>
              <span>rastreadores removidos</span>
            </div>
            <div>
              <strong>{result.statistics.preservedParameters}</strong>
              <span>parâmetros preservados</span>
            </div>
          </div>
          <div className="comparison-grid">
            <div>
              <span className="comparison-label">
                Antes · {result.statistics.originalLength} caracteres
              </span>
              <code>{result.originalUrl}</code>
            </div>
            <div>
              <span className="comparison-label">
                Depois · {result.statistics.cleanLength} caracteres
              </span>
              <code>{result.cleanUrl}</code>
            </div>
          </div>
          <div className="parameter-grid">
            <ParameterList
              title="Removidos"
              values={result.removedParameters}
              tone="removed"
            />
            <ParameterList
              title="Preservados"
              values={result.preservedParameters}
              tone="preserved"
            />
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section className="history-card" aria-labelledby="historico">
          <div className="history-heading">
            <h2 id="historico">Histórico recente</h2>
            <span>Salvo somente neste dispositivo</span>
          </div>
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <button
                  className="history-url"
                  type="button"
                  onClick={() => setUrl(item.cleanUrl)}
                >
                  {new URL(item.cleanUrl).hostname}
                  {new URL(item.cleanUrl).pathname}
                </button>
                <CopyButton value={item.cleanUrl} label="Copiar" />
                <a
                  href={item.cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => analytics.track("link_opened")}
                >
                  Abrir
                </a>
                <button
                  className="remove-button"
                  type="button"
                  aria-label={`Remover ${item.cleanUrl} do histórico`}
                  onClick={() => setHistory(removeHistory(item.id))}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ParameterList({
  title,
  values,
  tone,
}: {
  title: string;
  values: string[];
  tone: string;
}) {
  return (
    <div>
      <h3>{title}</h3>
      {values.length ? (
        <ul className={`tag-list ${tone}`}>
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Nenhum parâmetro</p>
      )}
    </div>
  );
}
