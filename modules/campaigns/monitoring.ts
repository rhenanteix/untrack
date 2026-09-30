import { getPrisma } from "@/lib/prisma";
import { Actor } from "@/modules/workspaces/context";
import { ApiError } from "@/lib/api-response";
import { audit } from "@/modules/workspaces/context";
import { lookup } from "node:dns/promises";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";
import type { MonitorStatus } from "./schemas";

const MAX_REDIRECTS = 10;
const REQUEST_TIMEOUT_MS = 10_000;

function isPrivateAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    const range = parsed.range();
    if (range !== "unicast") return true;
    const privateRanges = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10"];
    for (const cidr of privateRanges) {
      const [rangeStr] = cidr.split("/");
      const prefix = parseInt(cidr.split("/")[1] || "32", 10);
      if (ipaddr.parse(address).match(ipaddr.parse(rangeStr), prefix)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ApiError(422, "UNSAFE_URL", "URL não pode ser verificada: endereço privado ou loopback.");
  }
  return { address: addresses[0].address, family: addresses[0].family as 4 | 6 };
}

async function fetchWithRedirects(url: URL): Promise<{
  httpStatus: number | null;
  finalUrl: string;
  redirectChain: Array<{ url: string; status: number; destination: string | null }>;
  responseTimeMs: number;
}> {
  let current = url;
  const chain: Array<{ url: string; status: number; destination: string | null }> = [];
  const start = performance.now();
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new ApiError(422, "UNSAFE_URL", "Protocolo não permitido.");
    }
    if (current.username || current.password) {
      throw new ApiError(422, "UNSAFE_URL", "Credenciais na URL não são permitidas.");
    }
      const hostname = current.hostname;
      if (!hostname) throw new ApiError(422, "INVALID_URL", "URL inválida.");
      const resolved = await resolvePublicAddress(hostname);
      const transport = current.protocol === "https:" ? https : http;
      const result = await new Promise<{ status: number; location: string | null; finalUrl: string }>((resolve, reject) => {
        const req = transport.request(
          {
            protocol: current.protocol,
            hostname: resolved.address,
            family: resolved.family,
            port: current.port || undefined,
            path: `${current.pathname}${current.search}`,
            method: "HEAD",
            servername: current.protocol === "https:" ? hostname : undefined,
            headers: { Host: hostname, Accept: "*/*", "Accept-Encoding": "identity", "User-Agent": "Untrack/1.0" },
          },
          (res) => {
            const status = res.statusCode ?? 0;
            const location = res.headers.location ?? null;
            const finalUrl = current.toString();
            res.resume();
            resolve({ status, location, finalUrl });
          },
        );
        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
          req.destroy(new Error("timeout"));
          reject(new ApiError(422, "TIMEOUT", "Timeout na verificação."));
        });
        req.on("error", () => reject(new ApiError(422, "NETWORK_ERROR", "Erro de rede.")));
        req.end();
      });
    chain.push({ url: current.toString(), status: result.status, destination: result.location });
    const isRedirect = result.status >= 300 && result.status < 400 && Boolean(result.location) && result.location !== current.toString();
    if (!isRedirect) {
      return { httpStatus: result.status, finalUrl: result.finalUrl, redirectChain: chain, responseTimeMs: Math.round(performance.now() - start) };
    }
    let nextUrl: URL;
    try {
      nextUrl = new URL(result.location!, current);
    } catch {
      throw new ApiError(422, "INVALID_REDIRECT", "Redirect inválido.");
    }
    current = nextUrl;
  }
  throw new ApiError(422, "TOO_MANY_REDIRECTS", "Muitos redirects.");
}

async function fetchCertificate(hostname: string): Promise<{ expiresAt: Date | null; issuer: string | null }> {
  return new Promise((resolve) => {
    const socket = tls.connect(443, hostname, { servername: hostname, timeout: REQUEST_TIMEOUT_MS }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || Object.keys(cert).length === 0) {
        return resolve({ expiresAt: null, issuer: null });
      }
      const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
      const issuer = typeof cert.issuer === "string" ? cert.issuer : (() => { const i = cert.issuer as Record<string, string> | undefined; return i?.O || i?.CN || null; })();
      resolve({ expiresAt: validTo, issuer });
    });
    socket.on("error", () => resolve({ expiresAt: null, issuer: null }));
    socket.setTimeout(REQUEST_TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ expiresAt: null, issuer: null });
    });
  });
}

export async function checkDestination(urlString: string): Promise<{
  status: MonitorStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  finalUrl: string | null;
  redirectChain: Array<{ url: string; status: number; destination: string | null }>;
  connectionError: string | null;
  certExpiresAt: Date | null;
  certIssuer: string | null;
}> {
  const start = performance.now();
  try {
    const url = new URL(urlString);
    const network = await fetchWithRedirects(url);
    let certExpiresAt: Date | null = null;
    let certIssuer: string | null = null;
    try {
      const hostname = url.hostname;
      if (url.protocol === "https:") {
        const cert = await fetchCertificate(hostname);
        certExpiresAt = cert.expiresAt;
        certIssuer = cert.issuer;
      }
    } catch {
      certExpiresAt = null;
      certIssuer = null;
    }
    const responseTimeMs = Math.round(performance.now() - start);
    let status: MonitorStatus = "up";
    if (network.httpStatus === null) status = "unknown";
    else if (network.httpStatus >= 500) status = "down";
    else if (network.httpStatus >= 400) status = "degraded";
    else if (responseTimeMs > 5000) status = "degraded";
    return {
      status,
      httpStatus: network.httpStatus,
      responseTimeMs,
      finalUrl: network.finalUrl,
      redirectChain: network.redirectChain,
      connectionError: null,
      certExpiresAt,
      certIssuer,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    return {
      status: "down",
      httpStatus: null,
      responseTimeMs: Math.round(performance.now() - start),
      finalUrl: null,
      redirectChain: [],
      connectionError: message,
      certExpiresAt: null,
      certIssuer: null,
    };
  }
}

export async function recordMonitorCheck(actor: Actor, campaignId: string, channelId?: string, url?: string) {
  const prisma = getPrisma();
  const existingChannel = channelId ? await prisma.campaignChannel.findFirst({ where: { id: channelId, campaignId, workspaceId: actor.workspaceId } }) : null;
  const targetUrl = url || existingChannel?.destinationUrl || "";
  if (!targetUrl) throw new ApiError(400, "INVALID_URL", "URL de destino não informada.");
  const result = await checkDestination(targetUrl);
  const check = await prisma.campaignMonitorCheck.create({
    data: {
      workspaceId: actor.workspaceId,
      campaignId,
      channelId: channelId ?? null,
      url: targetUrl,
      httpStatus: result.httpStatus,
      responseTimeMs: result.responseTimeMs,
      finalUrl: result.finalUrl,
      redirectChain: result.redirectChain,
      connectionError: result.connectionError,
      certExpiresAt: result.certExpiresAt,
      certIssuer: result.certIssuer,
      status: result.status,
    },
  });
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "monitor.check", check.id, { campaignId, channelId, status: result.status });
  });
  return check;
}
