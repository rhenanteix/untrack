import { URL } from "url";

function ipv4ToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function ipv6ToParts(ip: string): number[] {
  const parts = ip.split(":");
  const result: number[] = [];
  for (const part of parts) {
    const val = parseInt(part, 16) || 0;
    result.push((val >> 8) & 0xff, val & 0xff);
  }
  return result;
}

function compareIpv6(ip: string, start: string, end: string): boolean {
  const ipParts = ipv6ToParts(ip);
  const startParts = ipv6ToParts(start);
  const endParts = ipv6ToParts(end);
  for (let i = 0; i < 16; i++) {
    if (ipParts[i] < startParts[i]) return false;
    if (ipParts[i] > endParts[i]) return false;
  }
  return true;
}

const PRIVATE_IPV4_RANGES = [
  { start: ipv4ToNumber("10.0.0.0"), end: ipv4ToNumber("10.255.255.255") },
  { start: ipv4ToNumber("172.16.0.0"), end: ipv4ToNumber("172.31.255.255") },
  { start: ipv4ToNumber("192.168.0.0"), end: ipv4ToNumber("192.168.255.255") },
  { start: ipv4ToNumber("127.0.0.0"), end: ipv4ToNumber("127.255.255.255") },
  { start: ipv4ToNumber("169.254.0.0"), end: ipv4ToNumber("169.254.255.255") },
];

const PRIVATE_IPV6_RANGES = [
  { start: "::1", end: "::1" },
  { start: "fe80::", end: "febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff" },
  { start: "fc00::", end: "fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff" },
];

const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata",
  "metadata.azure.com",
  "169.254.169.254",
  "[fd00:ec2::254]",
]);

function isPrivateIpv4(ip: string): boolean {
  try {
    const num = ipv4ToNumber(ip);
    return PRIVATE_IPV4_RANGES.some((range) => num >= range.start && num <= range.end);
  } catch {
    return true;
  }
}

function isPrivateIpv6(ip: string): boolean {
  return PRIVATE_IPV6_RANGES.some((range) => compareIpv6(ip, range.start, range.end));
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    return isPrivateIpv6(ip);
  }
  return isPrivateIpv4(ip);
}

export async function resolveHostname(hostname: string): Promise<string[]> {
  try {
    const { Resolver } = await import("dns/promises");
    const resolver = new Resolver();
    return await resolver.resolve4(hostname);
  } catch {
    try {
      const { Resolver } = await import("dns/promises");
      const resolver = new Resolver();
      return await resolver.resolve6(hostname);
    } catch {
      return [];
    }
  }
}

export async function validateDestinationUrl(url: string, allowPrivate = false): Promise<{ safe: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { safe: false, reason: "INVALID_URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "INVALID_PROTOCOL" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (METADATA_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: "METADATA_ENDPOINT" };
  }

  const ips = await internals.resolveHostname(hostname);
  if (ips.length === 0) {
    return { safe: false, reason: "DNS_RESOLUTION_FAILED" };
  }

  if (!allowPrivate) {
    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        return { safe: false, reason: "PRIVATE_IP" };
      }
    }
  }

  return { safe: true };
}

export async function validateRedirectChain(url: string, maxRedirects = 5, allowPrivate = false): Promise<{ safe: boolean; finalUrl?: string; reason?: string; chain?: string[] }> {
  const chain: string[] = [url];
  let currentUrl = url;

  for (let i = 0; i < maxRedirects; i++) {
    const validation = await validateDestinationUrl(currentUrl, allowPrivate);
    if (!validation.safe) {
      return { safe: false, reason: validation.reason, chain };
    }

    try {
      const response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });

      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status >= 400) {
        return { safe: true, finalUrl: currentUrl, chain };
      }

      const nextUrl = new URL(location, currentUrl).toString();
      if (chain.includes(nextUrl)) {
        return { safe: false, reason: "REDIRECT_LOOP", chain };
      }

      chain.push(nextUrl);
      currentUrl = nextUrl;
    } catch {
      return { safe: false, reason: "FETCH_FAILED", chain };
    }
  }

  return { safe: false, reason: "TOO_MANY_REDIRECTS", chain };
}

export { isPrivateIp, METADATA_HOSTNAMES };

export const internals = {
  resolveHostname,
};