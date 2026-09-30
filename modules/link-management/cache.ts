import { Redis } from "@upstash/redis";
import type { ShortLink } from "@prisma/client";
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, retry: { retries: 0 } }) : null;
const key = (domain: string, slug: string) => `untrack:redirect:${domain}:${slug}`;
async function bounded<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 150); })]); } catch { return null; } finally { clearTimeout(timer); }
}
export async function invalidateLinkCache(domain: string, slug: string) {
  if (redis) await bounded(redis.del(key(domain, slug)));
}
export async function cachedDestination(link: ShortLink): Promise<string> {
  if (!redis) return link.destinationUrl;
  const cached = await bounded(redis.get<{ version: string; destination: string }>(key(link.domainKey, link.slug)));
  // DB revision is checked on every redirect: cache outages/races cannot resurrect a destination.
  if (cached?.version === link.updatedAt.toISOString() && cached.destination === link.destinationUrl) return cached.destination;
  const ttl = Math.min(60, link.expiresAt ? Math.floor((link.expiresAt.getTime() - Date.now()) / 1000) : 60);
  if (ttl > 0) await bounded(redis.set(key(link.domainKey, link.slug), { version: link.updatedAt.toISOString(), destination: link.destinationUrl }, { ex: ttl }));
  return link.destinationUrl;
}
