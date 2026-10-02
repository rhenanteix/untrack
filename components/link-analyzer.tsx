"use client";

import { type FormEvent, useState } from "react";
import {
  GuestAccessNotice,
  GuestSignupPrompt,
} from "@/components/guest-access-notice";
import { analytics } from "@/lib/client/analytics";
import type { LinkAnalysis } from "@/modules/link-analyzer/types";
import { ToolCrossSell } from "@/components/tool-cross-sell";

function AnalysisResult({ analysis }: { analysis: LinkAnalysis }) {
  return (
    <section
      className="result-card analyzer-result"
      aria-label="Resultado da análise"
    >
      <div className="result-heading">
        <div>
          <span className="success-badge">Análise concluída</span>
          <h2>{analysis.hostname ?? "URL analisada"}</h2>
        </div>
        <strong className="analyzer-score">{analysis.healthScore}/100</strong>
      </div>
      <dl className="analyzer-summary">
        <div>
          <dt>Domínio</dt>
          <dd>{analysis.domain ?? "Não identificado"}</dd>
        </div>
        <div>
          <dt>HTTPS</dt>
          <dd>{analysis.https ? "Ativo" : "Não identificado"}</dd>
        </div>
        <div>
          <dt>Resposta</dt>
          <dd>{analysis.httpStatus ?? "Não disponível"}</dd>
        </div>
        <div>
          <dt>Redirects</dt>
          <dd>{analysis.redirectCount}</dd>
        </div>
      </dl>
      {analysis.issues.length > 0 ? (
        <div className="analyzer-issues">
          <h3>Sinais encontrados</h3>
          <ul>
            {analysis.issues.map((issue) => (
              <li key={issue.code} data-severity={issue.severity}>
                <strong>{issue.message}</strong>
                <span>{issue.recommendation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="status-success">
          Nenhum sinal crítico foi identificado nesta análise.
        </p>
      )}
      <details className="analyzer-details">
        <summary>Ver parâmetros identificados</summary>
        <p>
          Tracking: {analysis.tracking.length}. Funcionais:{" "}
          {analysis.functionalParameters.length}. Desconhecidos:{" "}
          {analysis.unknownParameters.length}.
        </p>
      </details>
      <ToolCrossSell
        product="analisar-link"
        title="Quer continuar acompanhando este link?"
        description="Use o Monitoring no workspace para acompanhar sinais de saúde e agir quando algo mudar."
        label="Monitorar este link"
        href="/cadastro?next=/untrack/link-health"
      />
    </section>
  );
}

export function LinkAnalyzer() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<LinkAnalysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAnalysis(null);
    setLoading(true);
    try {
      const response = await fetch("/api/link-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: { analysis?: LinkAnalysis; error?: string } =
        await response.json();
      if (!response.ok || !data.analysis) {
        throw new Error(data.error ?? "Não foi possível analisar este link.");
      }
      setAnalysis(data.analysis);
      if (response.headers.get("X-Untrack-Anonymous-Use") === "consumed") {
        analytics.track("anonymous_usage_consumed");
        analytics.track("free_tool_completed");
        setShowSignupPrompt(true);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível analisar este link.",
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
      <form className="tool-card account-form" onSubmit={submit}>
        <label htmlFor="analyzer-url">
          <span>URL para analisar</span>
          <input
            id="analyzer-url"
            type="url"
            inputMode="url"
            required
            maxLength={4096}
            placeholder="https://exemplo.com/campanha"
            value={url}
            disabled={loading}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Analisando..." : "Analisar link"}
        </button>
        <GuestAccessNotice error={error} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div aria-live="polite" aria-busy={loading}>
        {analysis && <AnalysisResult analysis={analysis} />}
      </div>
    </div>
  );
}
