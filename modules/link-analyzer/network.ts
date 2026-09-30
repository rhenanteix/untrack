import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import type { RedirectHop } from "./types";

export const NETWORK_LIMITS = {
  timeoutMs: 10_000,
  maxResponseBytes: 64 * 1024,
  maxHeaderBytes: 16 * 1024,
  maxRedirects: 5,
} as const;

export class AnalysisNetworkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const unsafe = () =>
  new AnalysisNetworkError(
    "UNSAFE_URL",
    "Destino bloqueado pela proteção SSRF.",
  );

export function validateDestination(url: URL): string {
  const hostname = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata" ||
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    (!isIP(hostname) && !hostname.includes("."))
  )
    throw unsafe();
  if (isIP(hostname) && !isPublicAddress(hostname)) throw unsafe();
  return hostname;
}

export function isPublicAddress(address: string): boolean {
  try {
    // Azure's platform virtual IP is globally numbered but is not a public destination.
    return (
      ipaddr.process(address).range() === "unicast" &&
      address !== "168.63.129.16" &&
      ipaddr.process(address).toString() !== "168.63.129.16"
    );
  } catch {
    return false;
  }
}

async function resolveDestination(hostname: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await new Promise<Array<{ address: string; family: number }>>(
        (resolve, reject) => {
          const abort = () => reject(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
          lookup(hostname, { all: true, verbatim: true })
            .then(resolve, reject)
            .finally(() => {
              signal.removeEventListener("abort", abort);
            });
        },
      );
  signal.throwIfAborted();
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw unsafe();
  return addresses[0];
}

async function requestOnce(
  url: URL,
  signal: AbortSignal,
  onHeaders: (status: number) => void,
): Promise<{ status: number; location?: string }> {
  const hostname = validateDestination(url);
  const resolved = await resolveDestination(hostname, signal);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname,
        family: resolved.family,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: "GET",
        agent: false,
        signal,
        maxHeaderSize: NETWORK_LIMITS.maxHeaderBytes,
        // Keep the original hostname for Host and TLS certificate verification,
        // but pin DNS to the address already checked (no DNS rebinding window).
        lookup: (_hostname, _options, callback) =>
          callback(null, resolved.address, resolved.family),
        headers: {
          Host: url.host,
          Accept: "*/*",
          "Accept-Encoding": "identity",
          "User-Agent": "ArrumeMeuLink/1.0 Link Analyzer",
        },
      },
      (response) => {
        const result = {
          status: response.statusCode ?? 0,
          location: response.headers.location,
        };
        onHeaders(result.status);
        const tooLarge = () => {
          const error = new AnalysisNetworkError(
            "RESPONSE_TOO_LARGE",
            "A resposta excedeu o limite de 64 KiB.",
          );
          reject(error);
          response.destroy();
          request.destroy();
        };
        response.on("error", reject);
        response.on("aborted", () =>
          reject(
            new AnalysisNetworkError(
              "NETWORK_ERROR",
              "A resposta foi interrompida.",
            ),
          ),
        );
        // Redirect bodies are irrelevant; close immediately instead of downloading them.
        if ([301, 302, 303, 307, 308].includes(result.status)) {
          resolve(result);
          response.destroy();
          return;
        }
        if (
          Number(response.headers["content-length"]) >
          NETWORK_LIMITS.maxResponseBytes
        ) {
          tooLarge();
          return;
        }
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > NETWORK_LIMITS.maxResponseBytes) tooLarge();
        });
        response.on("end", () => resolve(result));
      },
    );
    request.on("error", reject);
    request.end();
  });
}

export interface NetworkAnalysis {
  status: "completed" | "blocked" | "failed";
  httpStatus: number | null;
  redirectChain: RedirectHop[];
  redirectCount: number;
  finalDestination: string | null;
  error?: { code: string; message: string };
}

export async function inspectNetwork(initial: URL): Promise<NetworkAnalysis> {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new AnalysisNetworkError(
          "TIMEOUT",
          "Limite total de 10 segundos excedido.",
        ),
      ),
    NETWORK_LIMITS.timeoutMs,
  );
  const result: NetworkAnalysis = {
    status: "failed",
    httpStatus: null,
    redirectChain: [],
    redirectCount: 0,
    finalDestination: null,
  };
  const visited = new Set<string>();
  let current = new URL(initial);
  try {
    for (;;) {
      current.hash = "";
      if (visited.has(current.href))
        throw new AnalysisNetworkError(
          "REDIRECT_LOOP",
          "Loop de redirecionamento detectado.",
        );
      visited.add(current.href);
      const response = await requestOnce(
        current,
        controller.signal,
        (status) => {
          result.redirectCount = Math.max(0, visited.size - 1);
          result.httpStatus = status;
        },
      );
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        result.status = "completed";
        result.finalDestination = current.href;
        return result;
      }
      const hop: RedirectHop = {
        url: current.href,
        status: response.status,
        destination: null,
      };
      result.redirectChain.push(hop);
      if (!response.location)
        throw new AnalysisNetworkError(
          "INVALID_REDIRECT",
          "Redirecionamento sem Location.",
        );
      let next: URL;
      try {
        next = new URL(response.location, current);
      } catch {
        throw new AnalysisNetworkError(
          "INVALID_REDIRECT",
          "Destino de redirecionamento inválido.",
        );
      }
      hop.destination = next.href;
      validateDestination(next);
      if (result.redirectChain.length > NETWORK_LIMITS.maxRedirects)
        throw new AnalysisNetworkError(
          "TOO_MANY_REDIRECTS",
          "Limite de 5 redirecionamentos excedido.",
        );
      current = next;
    }
  } catch (error) {
    const failure = controller.signal.aborted
      ? controller.signal.reason
      : error;
    result.error =
      failure instanceof AnalysisNetworkError
        ? { code: failure.code, message: failure.message }
        : {
            code: "NETWORK_ERROR",
            message:
              "Não foi possível concluir o acesso (DNS, conexão ou TLS).",
          };
    result.status = result.error.code === "UNSAFE_URL" ? "blocked" : "failed";
    return result;
  } finally {
    clearTimeout(timer);
  }
}
