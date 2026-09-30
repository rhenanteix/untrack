import type { LinkAnalysis } from "@/modules/link-analyzer/types";
import {
  LINK_HEALTH_CONFIG,
  validateHealthConfig,
  type HealthConfig,
  type HealthCheckId,
} from "./config";
import type { HealthCheck, HealthFinding, LinkHealthReport } from "./types";

/** Pure scoring: no requests, no mutation, no use of the Analyzer's legacy score. */
export function evaluateLinkHealth(
  analysis: LinkAnalysis,
  config: HealthConfig = LINK_HEALTH_CONFIG,
): LinkHealthReport {
  validateHealthConfig(config);
  const checks: HealthCheck[] = [];
  const problems: HealthFinding[] = [];
  const warnings: HealthFinding[] = [];
  const completed = analysis.networkStatus === "completed";
  const hasTerminalResponse =
    completed &&
    analysis.finalDestination !== null &&
    analysis.httpStatus !== null;
  const successful =
    hasTerminalResponse &&
    analysis.httpStatus! >= config.successfulStatus.min &&
    analysis.httpStatus! <= config.successfulStatus.max;
  const unavailableReason = `Check inconclusivo: inspeção ${analysis.networkStatus}; não há evidência completa para conceder pontos.`;
  const add = (
    id: HealthCheckId,
    label: string,
    status: HealthCheck["status"],
    reason: string,
    recommendation: string,
    severity: "problem" | "warning" = "warning",
  ) => {
    checks.push({
      id,
      label,
      status,
      points: status === "pass" ? config.points[id] : 0,
      maxPoints: config.points[id],
      reason,
    });
    if (status !== "pass")
      (status === "fail" && severity === "problem" ? problems : warnings).push({
        code: id,
        message: reason,
        recommendation,
      });
  };

  const observedHttp =
    analysis.protocol === "http" ||
    analysis.redirectChain.some(
      (hop) =>
        hop.url.startsWith("http:") || hop.destination?.startsWith("http:"),
    ) ||
    analysis.finalDestination?.startsWith("http:");
  const httpsStatus = !analysis.valid
    ? "unknown"
    : observedHttp
      ? "fail"
      : hasTerminalResponse && analysis.https
        ? "pass"
        : "unknown";
  add(
    "https",
    "HTTPS",
    httpsStatus,
    httpsStatus === "pass"
      ? "URL inicial, cadeia observada e destino final utilizam HTTPS."
      : httpsStatus === "fail"
        ? "Foi encontrado HTTP sem TLS na URL inicial ou na cadeia de destinos."
        : unavailableReason,
    "Utilize HTTPS na URL inicial e em todos os destinos dos redirects.",
  );

  add(
    "httpStatus",
    "HTTP status",
    !hasTerminalResponse ? "unknown" : successful ? "pass" : "fail",
    hasTerminalResponse
      ? `HTTP ${analysis.httpStatus}: ${successful ? "dentro" : "fora"} da faixa de sucesso configurada (${config.successfulStatus.min}–${config.successfulStatus.max}).`
      : unavailableReason,
    "Verifique o status do destino e corrija erros de URL, acesso ou servidor.",
    "problem",
  );

  const excessive = analysis.redirectCount > config.maxAcceptableRedirects;
  add(
    "redirects",
    "Redirect count e chain",
    excessive ? "fail" : hasTerminalResponse ? "pass" : "unknown",
    excessive || hasTerminalResponse
      ? `${analysis.redirectCount} redirect(s) seguido(s); limite aceitável: ${config.maxAcceptableRedirects}.`
      : unavailableReason,
    "Revise a cadeia de redirects e prefira o destino final quando apropriado.",
  );

  const acceptableTime =
    Number.isFinite(analysis.responseTimeMs) &&
    analysis.responseTimeMs >= 0 &&
    analysis.responseTimeMs <= config.maxAcceptableResponseTimeMs;
  add(
    "responseTime",
    "Response time",
    !hasTerminalResponse ? "unknown" : acceptableTime ? "pass" : "fail",
    hasTerminalResponse
      ? `Inspeção total: ${analysis.responseTimeMs} ms; limite aceitável: ${config.maxAcceptableResponseTimeMs} ms (inclui DNS, redirects e leitura limitada).`
      : unavailableReason,
    "Verifique a latência e a cadeia de redirects; repita o check para comparar outra amostra.",
  );

  add(
    "urlStructure",
    "URL structure",
    analysis.valid ? "pass" : "fail",
    analysis.valid
      ? "URL HTTP/HTTPS absoluta, dentro do limite de tamanho e sem credenciais embutidas."
      : "A URL não atende à estrutura HTTP/HTTPS aceita pelo analisador.",
    "Informe uma URL HTTP/HTTPS válida, sem credenciais e com até 4096 caracteres.",
    "problem",
  );

  add(
    "tracking",
    "Tracking parameters",
    !analysis.valid ? "unknown" : analysis.tracking.length ? "fail" : "pass",
    !analysis.valid
      ? "Query não classificada porque a URL é inválida."
      : analysis.tracking.length
        ? `${analysis.tracking.length} parâmetro(s) corresponde(m) ao catálogo de tracking.`
        : "Nenhum parâmetro da query inicial corresponde ao catálogo de tracking; outros mecanismos não são avaliados.",
    "Revise o tracking antes de compartilhar. Preserve parâmetros funcionais, desconhecidos e assinaturas.",
  );

  add(
    "availability",
    "Disponibilidade básica",
    !hasTerminalResponse ? "unknown" : successful ? "pass" : "fail",
    successful
      ? "O destino final respondeu com sucesso e a leitura limitada terminou nesta amostra."
      : hasTerminalResponse
        ? "Houve resposta HTTP, mas ela não confirmou disponibilidade básica pela regra configurada."
        : unavailableReason,
    "Confira o destino e repita o check; indisponibilidade nesta amostra não prova que o site esteja offline.",
    "problem",
  );

  // Carry technical failures forward, without importing the legacy scoring policy.
  for (const issue of analysis.issues.filter(
    (issue) => issue.severity === "error",
  )) {
    problems.push({
      code: issue.code,
      message: issue.message,
      recommendation: issue.recommendation,
    });
  }
  if (analysis.unknownParameters.length)
    warnings.push({
      code: "UNKNOWN_PARAMETERS",
      message:
        "Há parâmetros de finalidade desconhecida. Eles foram preservados e não reduzem o score.",
      recommendation:
        "Preserve parâmetros desconhecidos até confirmar sua finalidade.",
    });

  const {
    input,
    valid,
    https,
    normalizedUrl,
    protocol,
    hostname,
    domain,
    path,
    query,
    fragment,
    networkStatus,
    httpStatus,
    responseTimeMs,
    redirectCount,
    redirectChain,
    finalDestination,
    tracking,
    functionalParameters,
    unknownParameters,
  } = analysis;
  return {
    policyVersion: config.version,
    healthScore: checks.reduce((sum, check) => sum + check.points, 0),
    maxScore: 100,
    scope:
      "Health técnico de uma amostra. Os checks e sinais encontrados não garantem segurança do conteúdo nem avaliam phishing ou malware.",
    checks,
    problems,
    warnings,
    recommendations: [
      ...new Set(
        [...problems, ...warnings].map((finding) => finding.recommendation),
      ),
    ],
    availability: successful
      ? "available"
      : hasTerminalResponse
        ? "not-confirmed"
        : "not-checked",
    measurements: {
      input,
      valid,
      https,
      normalizedUrl,
      protocol,
      hostname,
      domain,
      path,
      query,
      fragment,
      networkStatus,
      httpStatus,
      responseTimeMs,
      redirectCount,
      redirectChain,
      finalDestination,
      tracking,
      functionalParameters,
      unknownParameters,
    },
  };
}
