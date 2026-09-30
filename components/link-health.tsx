"use client";

import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/client/api";
import type { LinkHealthReport } from "@/modules/link-health/types";

const statusLabels = {
  pass: "Check atendido",
  fail: "Sinal encontrado",
  unknown: "Inconclusivo",
};
const availabilityLabels = {
  available: "Confirmada nesta amostra",
  "not-confirmed": "Não confirmada nesta amostra",
  "not-checked": "Check incompleto",
};

export function HealthResult({ report }: { report: LinkHealthReport }) {
  const { measurements } = report;
  return (
    <section
      className="result-card health-result"
      aria-label="Resultado Link Health"
    >
      <h2>
        Health Score: {report.healthScore}/{report.maxScore}
      </h2>
      <p>{report.scope}</p>
      <p>
        Política {report.policyVersion} · Disponibilidade:{" "}
        {availabilityLabels[report.availability]}
      </p>
      <p>
        <strong>URL analisada:</strong> <code>{measurements.input}</code>
      </p>
      <h3>Checks e razões dos pontos</h3>
      <ul>
        {report.checks.map((check) => (
          <li key={check.id}>
            <strong>
              {check.label}: +{check.points}/{check.maxPoints}
            </strong>{" "}
            — {statusLabels[check.status]}
            <p>{check.reason}</p>
          </li>
        ))}
      </ul>
      <h3>Problemas</h3>
      {report.problems.length ? (
        <ul>
          {report.problems.map((finding) => (
            <li key={finding.code}>{finding.message}</li>
          ))}
        </ul>
      ) : (
        <p>Nenhum problema identificado pelos checks executados.</p>
      )}
      <h3>Avisos</h3>
      {report.warnings.length ? (
        <ul>
          {report.warnings.map((finding) => (
            <li key={finding.code}>{finding.message}</li>
          ))}
        </ul>
      ) : (
        <p>Nenhum aviso nesta amostra.</p>
      )}
      <h3>Recomendações</h3>
      {report.recommendations.length ? (
        <ul>
          {report.recommendations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>Repita os checks se o link ou as condições de acesso mudarem.</p>
      )}
      <h3>Resposta e destinos</h3>
      <dl>
        <dt>HTTP status</dt>
        <dd>{measurements.httpStatus ?? "Não observado"}</dd>
        <dt>Response time (inspeção total)</dt>
        <dd>{measurements.responseTimeMs} ms</dd>
        <dt>Redirect count</dt>
        <dd>{measurements.redirectCount}</dd>
        <dt>Final destination</dt>
        <dd>{measurements.finalDestination ?? "Não confirmado"}</dd>
      </dl>
      <h3>Redirect chain</h3>
      {measurements.redirectChain.length ? (
        <ol>
          {measurements.redirectChain.map((hop, index) => (
            <li key={index}>
              <code>{hop.url}</code> → HTTP {hop.status} →{" "}
              <code>{hop.destination ?? "Location inválido ou ausente"}</code>
            </li>
          ))}
        </ol>
      ) : (
        <p>Nenhum redirect observado.</p>
      )}
      <p>
        Destinos anunciados nos redirects podem ter sido bloqueados antes do
        acesso.
      </p>
      <details>
        <summary>Estrutura e parâmetros</summary>
        <dl>
          <dt>Protocolo</dt>
          <dd>{measurements.protocol ?? "Não identificado"}</dd>
          <dt>Hostname</dt>
          <dd>{measurements.hostname ?? "Não identificado"}</dd>
          <dt>Domínio</dt>
          <dd>{measurements.domain ?? "Não identificado"}</dd>
          <dt>Path</dt>
          <dd>{measurements.path ?? "Não identificado"}</dd>
          <dt>Query</dt>
          <dd>{measurements.query || "Ausente"}</dd>
          <dt>Fragment</dt>
          <dd>{measurements.fragment || "Ausente"}</dd>
        </dl>
        <h4>Tracking parameters</h4>
        {measurements.tracking.length ? (
          <ul>
            {measurements.tracking.map((parameter, index) => (
              <li key={index}>
                <code>{parameter.name}</code>: {parameter.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum parâmetro identificado pelo catálogo.</p>
        )}
        <p>
          Parâmetros funcionais: {measurements.functionalParameters.length}.
          Desconhecidos: {measurements.unknownParameters.length}. Todos foram
          preservados.
        </p>
      </details>
    </section>
  );
}

export function LinkHealth() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<LinkHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setReport(null);
    setError("");
    setLoading(true);
    try {
      const { health } = await apiRequest<{ health: LinkHealthReport }>(
        "/api/link-health",
        { method: "POST", body: JSON.stringify({ url }) },
      );
      setReport(health);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível executar os checks.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="tool-stack">
      <form className="tool-card account-form" onSubmit={submit}>
        <label>
          <span>URL para Link Health</span>
          <input
            type="text"
            inputMode="url"
            required
            maxLength={4096}
            placeholder="https://exemplo.com/pagina"
            value={url}
            disabled={loading}
            onChange={(event) => {
              setUrl(event.target.value);
              setReport(null);
            }}
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Executando checks..." : "Avaliar health do link"}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <div aria-live="polite" aria-busy={loading}>
        {report && <HealthResult report={report} />}
      </div>
    </div>
  );
}
