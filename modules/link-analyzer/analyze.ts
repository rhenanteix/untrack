import { getDomain } from "tldts";
import { getTrackerCategory } from "@/modules/links/tracker-categories";
import {
  MAX_URL_LENGTH,
  webUrlSchema,
} from "@/modules/validation/url-validation";
import { inspectNetwork } from "./network";
import type { LinkAnalysis, AnalysisIssue } from "./types";

const FUNCTIONAL = new Map([
  ["q", "Busca"],
  ["query", "Busca"],
  ["search", "Busca"],
  ["page", "Paginação"],
  ["limit", "Paginação"],
  ["offset", "Paginação"],
  ["sort", "Ordenação"],
  ["order", "Ordenação"],
  ["filter", "Filtro"],
  ["id", "Identificador de recurso"],
  ["lang", "Idioma"],
  ["locale", "Idioma"],
]);

/** Analyzes without deleting, rewriting or forwarding client credentials. */
export async function analyzeLink(input: string): Promise<LinkAnalysis> {
  const start = performance.now();
  const result: LinkAnalysis = {
    input,
    valid: false,
    normalizedUrl: null,
    protocol: null,
    hostname: null,
    domain: null,
    path: null,
    query: null,
    fragment: null,
    https: false,
    tracking: [],
    functionalParameters: [],
    unknownParameters: [],
    networkStatus: "skipped",
    httpStatus: null,
    redirectChain: [],
    redirectCount: 0,
    responseTimeMs: 0,
    finalDestination: null,
    issues: [],
    recommendations: [],
    healthScore: 100,
  };
  const addIssue = (
    code: string,
    severity: AnalysisIssue["severity"],
    message: string,
    recommendation: string,
    penalty: number,
  ) => {
    result.issues.push({ code, severity, message, recommendation, penalty });
  };
  const finish = () => {
    result.responseTimeMs = Math.round(performance.now() - start);
    result.healthScore = Math.max(
      0,
      100 - result.issues.reduce((sum, issue) => sum + issue.penalty, 0),
    );
    result.recommendations = [
      ...new Set(result.issues.map((issue) => issue.recommendation)),
    ];
    return result;
  };

  let url: URL;
  try {
    if (input.length > MAX_URL_LENGTH) throw new Error("length");
    url = new URL(input.trim());
  } catch {
    addIssue(
      "INVALID_URL",
      "error",
      "URL inválida ou maior que 4096 caracteres.",
      "Informe uma URL HTTP ou HTTPS absoluta e válida.",
      100,
    );
    return finish();
  }
  Object.assign(result, {
    normalizedUrl: url.href,
    protocol: url.protocol.slice(0, -1),
    hostname: url.hostname,
    domain: getDomain(url.hostname, { allowPrivateDomains: true }),
    path: url.pathname,
    query: url.search.slice(1),
    fragment: url.hash.slice(1),
    https: url.protocol === "https:",
  });
  result.valid = webUrlSchema.safeParse(input).success;
  if (!result.valid) {
    addIssue(
      "UNSUPPORTED_URL",
      "error",
      "Protocolo não permitido ou URL com credenciais.",
      "Use HTTP ou HTTPS sem usuário e senha na URL.",
      100,
    );
    return finish();
  }
  for (const [name, value] of url.searchParams) {
    const tracker = getTrackerCategory(name);
    const functional = FUNCTIONAL.get(name); // Functional parameter names are case-sensitive.
    if (tracker)
      result.tracking.push({
        name,
        value,
        reason: `Tracking reconhecido pelo catálogo: ${tracker}.`,
      });
    else if (functional)
      result.functionalParameters.push({
        name,
        value,
        reason: `${functional}: classificação heurística pelo nome; preservar.`,
      });
    else
      result.unknownParameters.push({
        name,
        value,
        reason:
          "Finalidade desconhecida; preservar para não alterar o funcionamento do link.",
      });
  }
  if (!result.https)
    addIssue(
      "HTTP_NOT_SECURE",
      "warning",
      "A URL inicial não utiliza HTTPS.",
      "Prefira HTTPS quando disponível.",
      15,
    );
  if (result.tracking.length)
    addIssue(
      "TRACKING_PARAMETERS",
      "warning",
      `${result.tracking.length} parâmetro(s) de tracking identificado(s).`,
      "Revise os parâmetros de tracking antes de compartilhar; links assinados podem depender da query original.",
      10,
    );
  if (result.unknownParameters.length)
    addIssue(
      "UNKNOWN_PARAMETERS",
      "info",
      "Há parâmetros cuja função não é conhecida.",
      "Preserve parâmetros desconhecidos; confirme sua finalidade antes de qualquer remoção.",
      0,
    );

  const network = await inspectNetwork(url);
  Object.assign(result, {
    networkStatus: network.status,
    httpStatus: network.httpStatus,
    redirectChain: network.redirectChain,
    redirectCount: network.redirectCount,
    finalDestination: network.finalDestination,
  });
  if (network.error)
    addIssue(
      network.error.code,
      "error",
      network.error.message,
      network.status === "blocked"
        ? "Utilize um destino público HTTP/HTTPS; endereços internos não são acessados."
        : "Verifique o destino e tente novamente; a inspeção de rede ficou incompleta.",
      network.status === "blocked" ? 100 : 50,
    );
  if (
    network.status === "completed" &&
    network.httpStatus !== null &&
    network.httpStatus >= 400
  )
    addIssue(
      "HTTP_ERROR",
      "error",
      `O destino respondeu HTTP ${network.httpStatus}.`,
      "Corrija a URL ou verifique a disponibilidade e as permissões do destino.",
      40,
    );
  if (network.redirectCount)
    addIssue(
      "REDIRECTS",
      "warning",
      `${network.redirectCount} redirecionamento(s) seguido(s).`,
      "Considere compartilhar o destino final após verificar se os redirects são necessários.",
      Math.min(20, network.redirectCount * 5),
    );
  if (
    network.redirectChain.some(
      (hop) =>
        hop.url.startsWith("https:") && hop.destination?.startsWith("http:"),
    )
  )
    addIssue(
      "HTTPS_DOWNGRADE",
      "warning",
      "Um redirecionamento troca HTTPS por HTTP.",
      "Mantenha HTTPS em todos os destinos da cadeia.",
      20,
    );
  return finish();
}
