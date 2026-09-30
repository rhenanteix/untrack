import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import { ApiError } from "./api-response";

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_GET_BYTES = 64 * 1024;

interface RequestResult {
  status: number;
  contentType: string | null;
  location: string | null;
}

export interface UrlCheckResult {
  reachable: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  redirects: number;
  method: "HEAD" | "GET";
}

function isPublicAddress(address: string): boolean {
  const parsed = ipaddr.process(address);
  return parsed.range() === "unicast";
}

async function resolvePublicAddress(
  hostname: string,
): Promise<{ address: string; family: 4 | 6 }> {
  let addresses: Array<{ address: string; family: number }>;
  try {
    const lookupAll = lookup as unknown as (
      name: string,
      options: { all: true; verbatim: true },
    ) => Promise<Array<{ address: string; family: number }>>;
    addresses = await lookupAll(hostname, { all: true, verbatim: true });
  } catch {
    throw new ApiError(
      422,
      "URL_UNREACHABLE",
      "Não foi possível acessar esta URL.",
    );
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new ApiError(422, "UNSAFE_URL", "Esta URL não pode ser verificada.");
  }

  const selected = addresses[0];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

async function requestOnce(
  url: URL,
  method: "HEAD" | "GET",
): Promise<RequestResult> {
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    Boolean(url.username) ||
    Boolean(url.password)
  ) {
    throw new ApiError(422, "UNSAFE_URL", "Esta URL não pode ser verificada.");
  }

  const resolved = await resolvePublicAddress(url.hostname);
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: resolved.address,
        family: resolved.family,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        servername: url.protocol === "https:" ? url.hostname : undefined,
        headers: {
          Host: url.host,
          Accept: "*/*",
          "Accept-Encoding": "identity",
          "User-Agent": "ArrumeMeuLink/1.0 URL checker",
        },
      },
      (response) => {
        const result = {
          status: response.statusCode ?? 0,
          contentType: response.headers["content-type"] ?? null,
          location: response.headers.location ?? null,
        };

        if (method === "HEAD") {
          response.resume();
          resolve(result);
          return;
        }

        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes >= MAX_GET_BYTES) response.destroy();
        });
        response.on("end", () => resolve(result));
        response.on("close", () => resolve(result));
        response.on("error", reject);
      },
    );

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("request timeout"));
    });
    request.on("error", reject);
    request.end();
  });
}

async function followRedirects(
  initialUrl: string,
  method: "HEAD" | "GET",
): Promise<Omit<UrlCheckResult, "method">> {
  let current = new URL(initialUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestOnce(current, method);
    const isRedirect = response.status >= 300 && response.status < 400;

    if (!isRedirect || !response.location) {
      return {
        reachable: response.status >= 200 && response.status < 400,
        status: response.status,
        finalUrl: current.toString(),
        contentType: response.contentType,
        redirects,
      };
    }

    if (redirects === MAX_REDIRECTS) {
      throw new ApiError(
        422,
        "TOO_MANY_REDIRECTS",
        "A URL possui redirecionamentos demais.",
      );
    }

    try {
      current = new URL(response.location, current);
    } catch {
      throw new ApiError(
        422,
        "INVALID_REDIRECT",
        "A URL redireciona para um endereço inválido.",
      );
    }
  }

  throw new ApiError(
    422,
    "URL_UNREACHABLE",
    "Não foi possível acessar esta URL.",
  );
}

export async function checkUrl(input: string): Promise<UrlCheckResult> {
  try {
    const head = await followRedirects(input, "HEAD");
    if (head.status !== 405 && head.status !== 501)
      return { ...head, method: "HEAD" };
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNSAFE_URL") throw error;
  }

  try {
    return { ...(await followRedirects(input, "GET")), method: "GET" };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      422,
      "URL_UNREACHABLE",
      "Não foi possível acessar esta URL.",
    );
  }
}
